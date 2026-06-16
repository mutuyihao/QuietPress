import { NextRequest, NextResponse } from "next/server";
import {
  createMcpClient,
  getMcpEnabled,
  scopesToString,
} from "@/lib/mcp/store";
import {
  MCP_DEFAULT_GRANT_TYPES,
  MCP_DEFAULT_RESPONSE_TYPES,
  MCP_TOKEN_AUTH_METHOD,
  normalizeOAuthRedirectUris,
  normalizeOAuthScopes,
} from "@/lib/mcp/oauth";
import { MCP_SCOPES } from "@/lib/mcp/scopes";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimitForRequest } from "@/lib/rate-limit";
import { withApiRoute } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_DCR_BODY_BYTES = 64 * 1024;
const MAX_CONTACTS = 10;
const MAX_CONTACT_LENGTH = 256;
const MAX_CLIENT_NAME_LENGTH = 120;

type DcrMetadata = Record<string, unknown>;

function dcrError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status },
  );
}

function readOptionalString(metadata: DcrMetadata, key: string): string | null {
  const value = metadata[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string.`);
  }
  return value.trim();
}

function readStringArray(metadata: DcrMetadata, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array.`);
  }

  const strings = value
    .map((item) => {
      if (typeof item !== "string")
        throw new Error(`${key} entries must be strings.`);
      return item.trim();
    })
    .filter(Boolean);

  return strings;
}

function normalizeClientName(value: string | null): string {
  const name = value || "Remote MCP Client";
  if (name.length > MAX_CLIENT_NAME_LENGTH) {
    throw new Error(
      `client_name must be ${MAX_CLIENT_NAME_LENGTH} characters or shorter.`,
    );
  }
  return name;
}

function normalizeHttpsUrl(value: string | null, key: string): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`${key} must use HTTPS.`);
  }
  if (url.username || url.password || url.hash) {
    throw new Error(`${key} must not include credentials or a fragment.`);
  }
  return url.toString();
}

function normalizeContacts(metadata: DcrMetadata): string[] {
  const value = metadata.contacts;
  if (value === undefined || value === null) return [];
  const contacts = readStringArray(metadata, "contacts");
  if (contacts.length > MAX_CONTACTS)
    throw new Error(`contacts supports at most ${MAX_CONTACTS} entries.`);
  for (const contact of contacts) {
    if (contact.length > MAX_CONTACT_LENGTH)
      throw new Error(
        `contacts entries must be ${MAX_CONTACT_LENGTH} characters or shorter.`,
      );
  }
  return Array.from(new Set(contacts));
}

function normalizeGrantTypes(metadata: DcrMetadata): string[] {
  const value = metadata.grant_types;
  if (value === undefined || value === null)
    return [...MCP_DEFAULT_GRANT_TYPES];
  const grantTypes = readStringArray(metadata, "grant_types");
  const unsupported = grantTypes.filter(
    (grantType) =>
      !MCP_DEFAULT_GRANT_TYPES.includes(
        grantType as (typeof MCP_DEFAULT_GRANT_TYPES)[number],
      ),
  );
  if (unsupported.length > 0)
    throw new Error(`Unsupported grant_type: ${unsupported.join(", ")}`);
  if (!grantTypes.includes("authorization_code"))
    throw new Error("grant_types must include authorization_code.");
  return Array.from(new Set(grantTypes));
}

function normalizeResponseTypes(metadata: DcrMetadata): string[] {
  const value = metadata.response_types;
  if (value === undefined || value === null)
    return [...MCP_DEFAULT_RESPONSE_TYPES];
  const responseTypes = readStringArray(metadata, "response_types");
  const unsupported = responseTypes.filter(
    (responseType) =>
      !MCP_DEFAULT_RESPONSE_TYPES.includes(
        responseType as (typeof MCP_DEFAULT_RESPONSE_TYPES)[number],
      ),
  );
  if (unsupported.length > 0)
    throw new Error(`Unsupported response_type: ${unsupported.join(", ")}`);
  if (!responseTypes.includes("code"))
    throw new Error("response_types must include code.");
  return Array.from(new Set(responseTypes));
}

function normalizeTokenEndpointAuthMethod(value: string | null): string {
  const method = value || MCP_TOKEN_AUTH_METHOD;
  if (method !== MCP_TOKEN_AUTH_METHOD) {
    throw new Error(
      "Only public OAuth clients with token_endpoint_auth_method=none are supported.",
    );
  }
  return method;
}

function getClientMetadata(metadata: DcrMetadata): Record<string, unknown> {
  const allowedKeys = [
    "application_type",
    "software_id",
    "software_version",
    "software_statement",
    "subject_type",
  ];

  return Object.fromEntries(
    allowedKeys
      .map((key) => [key, metadata[key]])
      .filter(([, value]) => typeof value === "string" && value.length <= 512),
  );
}

export const POST = withApiRoute(
  "oauth.register.POST",
  async (request: NextRequest) => {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_DCR_BODY_BYTES) {
      return dcrError(
        "invalid_request",
        "Dynamic client registration body is too large.",
        413,
      );
    }

    const limit = await checkRateLimitForRequest(request, {
      scope: "mcp-dcr",
      windowMs: 60 * 60_000,
      maxRequests: 20,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          error_description: "Too many dynamic client registration requests.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfter) },
        },
      );
    }

    try {
      const service = createServiceClient();
      const enabled = await getMcpEnabled(service);
      if (!enabled)
        return dcrError(
          "temporarily_unavailable",
          "Remote MCP is disabled.",
          503,
        );

      const metadata = (await request.json()) as DcrMetadata;
      if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata)
      ) {
        return dcrError(
          "invalid_request",
          "Registration metadata must be a JSON object.",
        );
      }

      const redirectUris = normalizeOAuthRedirectUris(
        readStringArray(metadata, "redirect_uris"),
      );
      const grantTypes = normalizeGrantTypes(metadata);
      const responseTypes = normalizeResponseTypes(metadata);
      const tokenEndpointAuthMethod = normalizeTokenEndpointAuthMethod(
        readOptionalString(metadata, "token_endpoint_auth_method"),
      );
      const scopes = normalizeOAuthScopes(
        readOptionalString(metadata, "scope"),
        MCP_SCOPES,
      );

      const client = await createMcpClient(service, {
        name: normalizeClientName(readOptionalString(metadata, "client_name")),
        redirectUris,
        scopes,
        registrationType: "dynamic",
        clientUri: normalizeHttpsUrl(
          readOptionalString(metadata, "client_uri"),
          "client_uri",
        ),
        logoUri: normalizeHttpsUrl(
          readOptionalString(metadata, "logo_uri"),
          "logo_uri",
        ),
        contacts: normalizeContacts(metadata),
        tokenEndpointAuthMethod,
        grantTypes,
        responseTypes,
        clientMetadata: getClientMetadata(metadata),
      });

      return NextResponse.json(
        {
          client_id: client.client_id,
          client_id_issued_at: Math.floor(
            new Date(client.created_at).getTime() / 1000,
          ),
          client_name: client.name,
          client_uri: client.client_uri,
          logo_uri: client.logo_uri,
          contacts: client.contacts,
          redirect_uris: client.redirect_uris,
          grant_types: client.grant_types,
          response_types: client.response_types,
          token_endpoint_auth_method: client.token_endpoint_auth_method,
          scope: scopesToString(client.scopes),
        },
        { status: 201 },
      );
    } catch (error) {
      logger.warn("oauth dynamic client registration failed", { err: error });
      return dcrError(
        "invalid_client_metadata",
        "Invalid dynamic client registration request.",
      );
    }
  },
);
