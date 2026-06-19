import { NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { checkRateLimitForRequest } from "@/lib/rate-limit";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { validateSameOriginRequest } from "@/lib/csrf";
import { readJsonObject } from "@/lib/api-request";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;

export const POST = withApiRoute(
  "newsletter.POST",
  async (request: NextRequest) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    try {
      const rateLimit = await checkRateLimitForRequest(request, {
        scope: "newsletter",
        maxRequests: 3,
        windowMs: 60 * 60_000,
      });

      if (!rateLimit.allowed) {
        return apiError(
          "RATE_LIMITED",
          "Too many subscription attempts. Please try again later.",
          429,
          {
            headers: { "Retry-After": String(rateLimit.retryAfter) },
          },
        );
      }

      const body = await readJsonObject(request);
      if (!body) {
        return apiError("INVALID_JSON", "Request body must be valid JSON", 400);
      }

      const email = body.email;
      const normalizedEmail =
        typeof email === "string" ? email.toLowerCase().trim() : "";

      if (
        !normalizedEmail ||
        normalizedEmail.length > MAX_EMAIL_LENGTH ||
        !EMAIL_PATTERN.test(normalizedEmail)
      ) {
        return apiError(
          "INVALID_EMAIL",
          "Please provide a valid email address",
          400,
        );
      }

      const supabase = createPublicClient();

      const { data: existing, error: lookupError } = await supabase
        .from("newsletter_subscribers")
        .select("id, status")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (lookupError && lookupError.code !== "42P01") {
        return apiInternalError("SUBSCRIPTION_LOOKUP_FAILED", lookupError);
      }

      if (existing) {
        if (existing.status === "active") {
          return apiOk({ message: "Already subscribed" });
        }
        if (existing.status === "unsubscribed") {
          const { error: resubError } = await supabase
            .from("newsletter_subscribers")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (resubError) {
            return apiInternalError("SUBSCRIPTION_UPDATE_FAILED", resubError);
          }
          return apiOk({ message: "Resubscribed" });
        }
      }

      const { error } = await supabase.from("newsletter_subscribers").insert({
        email: normalizedEmail,
        status: "active",
      });

      if (error) {
        if (error.code === "42P01") {
          return apiError(
            "MIGRATION_REQUIRED",
            "Initial database migration has not been applied.",
            503,
          );
        }
        if (error.code === "23505") {
          return apiOk({ message: "Already subscribed" });
        }
        return apiInternalError("SUBSCRIPTION_FAILED", error);
      }

      return apiOk({ message: "Subscribed" });
    } catch (err) {
      return apiInternalError("SUBSCRIPTION_FAILED", err);
    }
  },
);
