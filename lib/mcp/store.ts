import type { SupabaseClient } from '@supabase/supabase-js'
import { createOpaqueToken, hashToken, verifyPkceS256 } from '@/lib/mcp/crypto'
import { MCP_SCOPES, assertKnownScopes, normalizeScopes, parseScopeString, type McpScope } from '@/lib/mcp/scopes'

export const MCP_ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const MCP_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
const MCP_AUTH_CODE_TTL_SECONDS = 10 * 60

export interface McpClientRecord {
  id: string
  client_id: string
  name: string
  redirect_uris: string[]
  scopes: McpScope[]
  enabled: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface McpTokenRecord {
  id: string
  client_id: string
  user_id: string
  scopes: McpScope[]
  resource: string
  expires_at: string
  refresh_expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
  client?: Pick<McpClientRecord, 'client_id' | 'name' | 'enabled'>
}

export interface McpAuditLogRecord {
  id: string
  user_id: string | null
  client_id: string | null
  scopes: McpScope[]
  tool_name: string
  resource_type: string | null
  resource_id: string | null
  input_summary: Record<string, unknown>
  result_summary: Record<string, unknown>
  request_id: string
  ip_hash: string | null
  user_agent_hash: string | null
  status: 'success' | 'error'
  error: string | null
  created_at: string
}

export interface McpAccessContext {
  tokenId: string
  userId: string
  clientId: string
  clientName: string
  scopes: McpScope[]
  resource: string
}

interface AuthorizationCodeRow {
  id: string
  code_hash: string
  client_id: string
  user_id: string
  redirect_uri: string
  code_challenge: string
  code_challenge_method: string
  scopes: string[]
  resource: string
  expires_at: string
  consumed_at: string | null
}

function expiresAt(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function mapClient(row: Record<string, unknown>): McpClientRecord {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    name: String(row.name),
    redirect_uris: toStringArray(row.redirect_uris),
    scopes: normalizeScopes(toStringArray(row.scopes)),
    enabled: Boolean(row.enabled),
    created_by: typeof row.created_by === 'string' ? row.created_by : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapToken(row: Record<string, unknown>): McpTokenRecord {
  const client = row.mcp_oauth_clients && typeof row.mcp_oauth_clients === 'object'
    ? row.mcp_oauth_clients as Record<string, unknown>
    : null

  return {
    id: String(row.id),
    client_id: String(row.client_id),
    user_id: String(row.user_id),
    scopes: normalizeScopes(toStringArray(row.scopes)),
    resource: String(row.resource),
    expires_at: String(row.expires_at),
    refresh_expires_at: typeof row.refresh_expires_at === 'string' ? row.refresh_expires_at : null,
    revoked_at: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    last_used_at: typeof row.last_used_at === 'string' ? row.last_used_at : null,
    created_at: String(row.created_at),
    client: client
      ? {
          client_id: String(client.client_id),
          name: String(client.name),
          enabled: Boolean(client.enabled),
        }
      : undefined,
  }
}

export async function getMcpEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('mcp_enabled')
    .eq('id', 'main')
    .maybeSingle()

  if (error) return false
  return Boolean(data?.mcp_enabled)
}

export async function setMcpEnabled(supabase: SupabaseClient, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('site_settings')
    .upsert({ id: 'main', mcp_enabled: enabled, updated_at: new Date().toISOString() })

  if (error) throw new Error(error.message)
}

export async function listMcpClients(supabase: SupabaseClient): Promise<McpClientRecord[]> {
  const { data, error } = await supabase
    .from('mcp_oauth_clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []).map((row) => mapClient(row))
}

export async function getMcpClientByClientId(
  supabase: SupabaseClient,
  clientId: string,
): Promise<McpClientRecord | null> {
  const { data, error } = await supabase
    .from('mcp_oauth_clients')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapClient(data) : null
}

export async function createMcpClient(
  supabase: SupabaseClient,
  input: {
    name: string
    redirectUris: string[]
    scopes: string[]
    createdBy: string
  },
): Promise<McpClientRecord> {
  const scopes = assertKnownScopes(input.scopes.length > 0 ? input.scopes : [...MCP_SCOPES])
  const clientId = `qp_${createOpaqueToken(24)}`

  const { data, error } = await supabase
    .from('mcp_oauth_clients')
    .insert({
      client_id: clientId,
      name: input.name,
      redirect_uris: input.redirectUris,
      scopes,
      created_by: input.createdBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return mapClient(data)
}

export async function setMcpClientEnabled(
  supabase: SupabaseClient,
  clientId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('mcp_oauth_clients')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('client_id', clientId)

  if (error) throw new Error(error.message)
}

export async function listMcpTokens(supabase: SupabaseClient): Promise<McpTokenRecord[]> {
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('*, mcp_oauth_clients(client_id, name, enabled)')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return (data || []).map((row) => mapToken(row))
}

export async function revokeMcpToken(supabase: SupabaseClient, tokenId: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)

  if (error) throw new Error(error.message)
}

export async function revokeMcpTokenByRawToken(supabase: SupabaseClient, token: string): Promise<void> {
  const tokenHash = hashToken(token)
  const { error } = await supabase
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .or(`token_hash.eq.${tokenHash},refresh_token_hash.eq.${tokenHash}`)

  if (error) throw new Error(error.message)
}

export async function createAuthorizationCode(
  supabase: SupabaseClient,
  input: {
    clientId: string
    userId: string
    redirectUri: string
    codeChallenge: string
    scopes: McpScope[]
    resource: string
  },
): Promise<string> {
  const code = createOpaqueToken(32)
  const { error } = await supabase
    .from('mcp_oauth_authorization_codes')
    .insert({
      code_hash: hashToken(code),
      client_id: input.clientId,
      user_id: input.userId,
      redirect_uri: input.redirectUri,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
      scopes: input.scopes,
      resource: input.resource,
      expires_at: expiresAt(MCP_AUTH_CODE_TTL_SECONDS),
    })

  if (error) throw new Error(error.message)
  return code
}

export async function exchangeAuthorizationCode(
  supabase: SupabaseClient,
  input: {
    code: string
    clientId: string
    redirectUri: string
    codeVerifier: string
    resource: string
  },
): Promise<{
  accessToken: string
  refreshToken: string
  scopes: McpScope[]
  expiresIn: number
}> {
  const codeHash = hashToken(input.code)
  const { data, error } = await supabase
    .from('mcp_oauth_authorization_codes')
    .select('*')
    .eq('code_hash', codeHash)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Invalid authorization code')

  const codeRow = data as AuthorizationCodeRow
  if (codeRow.consumed_at) throw new Error('Authorization code already used')
  if (new Date(codeRow.expires_at).getTime() <= Date.now()) throw new Error('Authorization code expired')
  if (codeRow.client_id !== input.clientId) throw new Error('Authorization code client mismatch')
  if (codeRow.redirect_uri !== input.redirectUri) throw new Error('Authorization code redirect URI mismatch')
  if (codeRow.resource !== input.resource) throw new Error('Authorization code resource mismatch')
  if (codeRow.code_challenge_method !== 'S256') throw new Error('Unsupported PKCE method')
  if (!verifyPkceS256(input.codeVerifier, codeRow.code_challenge)) throw new Error('Invalid PKCE verifier')

  const { error: consumeError } = await supabase
    .from('mcp_oauth_authorization_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', codeRow.id)

  if (consumeError) throw new Error(consumeError.message)

  return issueMcpToken(supabase, {
    clientId: codeRow.client_id,
    userId: codeRow.user_id,
    scopes: normalizeScopes(codeRow.scopes),
    resource: codeRow.resource,
  })
}

export async function issueMcpToken(
  supabase: SupabaseClient,
  input: {
    clientId: string
    userId: string
    scopes: McpScope[]
    resource: string
  },
): Promise<{
  accessToken: string
  refreshToken: string
  scopes: McpScope[]
  expiresIn: number
}> {
  const accessToken = createOpaqueToken(40)
  const refreshToken = createOpaqueToken(40)
  const { error } = await supabase
    .from('mcp_oauth_tokens')
    .insert({
      token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      client_id: input.clientId,
      user_id: input.userId,
      scopes: input.scopes,
      resource: input.resource,
      expires_at: expiresAt(MCP_ACCESS_TOKEN_TTL_SECONDS),
      refresh_expires_at: expiresAt(MCP_REFRESH_TOKEN_TTL_SECONDS),
    })

  if (error) throw new Error(error.message)

  return {
    accessToken,
    refreshToken,
    scopes: input.scopes,
    expiresIn: MCP_ACCESS_TOKEN_TTL_SECONDS,
  }
}

export async function rotateRefreshToken(
  supabase: SupabaseClient,
  input: {
    refreshToken: string
    clientId: string
    resource: string
  },
): Promise<{
  accessToken: string
  refreshToken: string
  scopes: McpScope[]
  expiresIn: number
}> {
  const refreshHash = hashToken(input.refreshToken)
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('*, mcp_oauth_clients(client_id, name, enabled)')
    .eq('refresh_token_hash', refreshHash)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Invalid refresh token')

  const existing = mapToken(data)
  if (existing.revoked_at) throw new Error('Refresh token revoked')
  if (!existing.refresh_expires_at || new Date(existing.refresh_expires_at).getTime() <= Date.now()) {
    throw new Error('Refresh token expired')
  }
  if (existing.client_id !== input.clientId) throw new Error('Refresh token client mismatch')
  if (existing.resource !== input.resource) throw new Error('Refresh token resource mismatch')
  if (existing.client && !existing.client.enabled) throw new Error('OAuth client disabled')

  const { data: adminProfile, error: adminError } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', existing.user_id)
    .maybeSingle()

  if (adminError || !adminProfile) throw new Error('Admin access has been revoked')

  await revokeMcpToken(supabase, existing.id)
  return issueMcpToken(supabase, {
    clientId: existing.client_id,
    userId: existing.user_id,
    scopes: existing.scopes,
    resource: existing.resource,
  })
}

export async function validateMcpAccessToken(
  supabase: SupabaseClient,
  token: string,
  resource: string,
): Promise<McpAccessContext | null> {
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('*, mcp_oauth_clients(client_id, name, enabled)')
    .eq('token_hash', hashToken(token))
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const tokenRecord = mapToken(data)
  if (tokenRecord.revoked_at) return null
  if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) return null
  if (tokenRecord.resource !== resource) return null
  if (tokenRecord.client && !tokenRecord.client.enabled) return null

  const { data: adminProfile, error: adminError } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', tokenRecord.user_id)
    .maybeSingle()

  if (adminError || !adminProfile) return null

  await supabase
    .from('mcp_oauth_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRecord.id)

  return {
    tokenId: tokenRecord.id,
    userId: tokenRecord.user_id,
    clientId: tokenRecord.client_id,
    clientName: tokenRecord.client?.name || tokenRecord.client_id,
    scopes: tokenRecord.scopes,
    resource: tokenRecord.resource,
  }
}

export async function insertMcpAuditLog(
  supabase: SupabaseClient,
  input: {
    userId: string | null
    clientId: string | null
    scopes: readonly string[]
    toolName: string
    resourceType?: string | null
    resourceId?: string | null
    inputSummary?: Record<string, unknown>
    resultSummary?: Record<string, unknown>
    requestId: string
    ipHash?: string | null
    userAgentHash?: string | null
    status: 'success' | 'error'
    error?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from('mcp_oauth_audit_logs').insert({
    user_id: input.userId,
    client_id: input.clientId,
    scopes: normalizeScopes(input.scopes),
    tool_name: input.toolName,
    resource_type: input.resourceType ?? null,
    resource_id: input.resourceId ?? null,
    input_summary: input.inputSummary ?? {},
    result_summary: input.resultSummary ?? {},
    request_id: input.requestId,
    ip_hash: input.ipHash ?? null,
    user_agent_hash: input.userAgentHash ?? null,
    status: input.status,
    error: input.error ?? null,
  })

  if (error) throw new Error(error.message)
}

export async function listMcpAuditLogs(supabase: SupabaseClient): Promise<McpAuditLogRecord[]> {
  const { data, error } = await supabase
    .from('mcp_oauth_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return (data || []).map((row) => ({
    id: String(row.id),
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    client_id: typeof row.client_id === 'string' ? row.client_id : null,
    scopes: normalizeScopes(toStringArray(row.scopes)),
    tool_name: String(row.tool_name),
    resource_type: typeof row.resource_type === 'string' ? row.resource_type : null,
    resource_id: typeof row.resource_id === 'string' ? row.resource_id : null,
    input_summary: row.input_summary && typeof row.input_summary === 'object' ? row.input_summary as Record<string, unknown> : {},
    result_summary: row.result_summary && typeof row.result_summary === 'object' ? row.result_summary as Record<string, unknown> : {},
    request_id: String(row.request_id),
    ip_hash: typeof row.ip_hash === 'string' ? row.ip_hash : null,
    user_agent_hash: typeof row.user_agent_hash === 'string' ? row.user_agent_hash : null,
    status: row.status === 'success' ? 'success' : 'error',
    error: typeof row.error === 'string' ? row.error : null,
    created_at: String(row.created_at),
  }))
}

export function scopesToString(scopes: readonly string[]): string {
  return normalizeScopes(scopes).join(' ')
}

export function requestedScopesWithinClient(requested: string, client: McpClientRecord): McpScope[] {
  const scopes = parseScopeString(requested)
  const selected = scopes.length > 0 ? scopes : client.scopes
  const disallowed = selected.filter((scope) => !client.scopes.includes(scope))

  if (disallowed.length > 0) {
    throw new Error(`Scope not allowed by client: ${disallowed.join(', ')}`)
  }

  return selected
}
