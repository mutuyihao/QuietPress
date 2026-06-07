import { MCP_SCOPES, getUnknownMcpScopes, normalizeScopes, splitScopeString, type McpScope } from '@/lib/mcp/scopes'

export const MCP_DEFAULT_GRANT_TYPES = ['authorization_code', 'refresh_token'] as const
export const MCP_DEFAULT_RESPONSE_TYPES = ['code'] as const
export const MCP_TOKEN_AUTH_METHOD = 'none'

const MAX_REDIRECT_URIS = 20
const MAX_URI_LENGTH = 2048
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function getMcpResourceUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/api/mcp`
}

export function assertMcpResource(origin: string, resource: string): string {
  const expected = getMcpResourceUrl(origin)
  if (resource !== expected) {
    throw new Error('resource must match the MCP endpoint')
  }
  return expected
}

export function normalizeOAuthRedirectUri(uri: string): string {
  if (!uri || uri.length > MAX_URI_LENGTH) {
    throw new Error('Redirect URI is empty or too long.')
  }

  const parsed = new URL(uri)
  const isLoopback = LOOPBACK_HOSTS.has(parsed.hostname)
  const isAllowedProtocol = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && isLoopback)

  if (!isAllowedProtocol) {
    throw new Error(`Redirect URI must be HTTPS or loopback HTTP: ${uri}`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`Redirect URI must not include credentials: ${uri}`)
  }
  if (parsed.hash) {
    throw new Error(`Redirect URI must not include a fragment: ${uri}`)
  }

  return parsed.toString()
}

export function normalizeOAuthRedirectUris(values: readonly string[]): string[] {
  const redirects = Array.from(new Set(
    values
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => normalizeOAuthRedirectUri(value)),
  ))

  if (redirects.length === 0) {
    throw new Error('At least one redirect URI is required.')
  }
  if (redirects.length > MAX_REDIRECT_URIS) {
    throw new Error(`At most ${MAX_REDIRECT_URIS} redirect URIs are allowed.`)
  }

  return redirects
}

export function isRegisteredRedirectUri(redirectUri: string, registeredRedirectUris: readonly string[]): boolean {
  return registeredRedirectUris.includes(normalizeOAuthRedirectUri(redirectUri))
}

export function normalizeOAuthScopes(value: string | null | undefined, fallback: readonly McpScope[] = MCP_SCOPES): McpScope[] {
  const unknown = getUnknownMcpScopes(value)
  if (unknown.length > 0) {
    throw new Error(`Unknown scope(s): ${unknown.join(', ')}`)
  }

  const requested = splitScopeString(value).filter((scope) => scope !== 'offline_access')
  return normalizeScopes(requested.length > 0 ? requested : fallback)
}
