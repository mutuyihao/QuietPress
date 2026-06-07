export const MCP_SCOPES = [
  'posts:read',
  'posts:write',
  'posts:publish',
  'posts:delete',
  'tags:write',
  'media:write',
  'comments:moderate',
  'settings:write',
  'migration:read',
  'migration:write',
  'analytics:read',
] as const

export type McpScope = (typeof MCP_SCOPES)[number]

export const MCP_SCOPE_LABELS: Record<McpScope, string> = {
  'posts:read': 'Read posts',
  'posts:write': 'Create and edit posts',
  'posts:publish': 'Publish and archive posts',
  'posts:delete': 'Delete posts',
  'tags:write': 'Manage tags',
  'media:write': 'Upload media',
  'comments:moderate': 'Moderate comments',
  'settings:write': 'Update public site settings',
  'migration:read': 'Export migration packages',
  'migration:write': 'Import migration packages',
  'analytics:read': 'Read analytics summaries',
}

const MCP_SCOPE_SET = new Set<string>(MCP_SCOPES)
const OAUTH_COMPATIBILITY_SCOPES = new Set(['offline_access'])

export function splitScopeString(value: string | null | undefined): string[] {
  if (!value) return []
  return Array.from(new Set(
    value
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
  ))
}

export function parseScopeString(value: string | null | undefined): McpScope[] {
  return Array.from(new Set(
    splitScopeString(value).filter((scope): scope is McpScope => MCP_SCOPE_SET.has(scope)),
  ))
}

export function getUnknownMcpScopes(value: string | null | undefined): string[] {
  return splitScopeString(value).filter((scope) => !MCP_SCOPE_SET.has(scope) && !OAUTH_COMPATIBILITY_SCOPES.has(scope))
}

export function normalizeScopes(scopes: Iterable<string>): McpScope[] {
  return Array.from(new Set(
    Array.from(scopes).filter((scope): scope is McpScope => MCP_SCOPE_SET.has(scope)),
  ))
}

export function assertKnownScopes(scopes: string[]): McpScope[] {
  const unknown = scopes.filter((scope) => !MCP_SCOPE_SET.has(scope))
  if (unknown.length > 0) {
    throw new Error(`Unknown scope(s): ${unknown.join(', ')}`)
  }
  return normalizeScopes(scopes)
}

export function hasScope(grantedScopes: readonly string[], requiredScope: McpScope): boolean {
  return grantedScopes.includes(requiredScope)
}

export function hasEveryScope(grantedScopes: readonly string[], requiredScopes: readonly McpScope[]): boolean {
  return requiredScopes.every((scope) => hasScope(grantedScopes, scope))
}
