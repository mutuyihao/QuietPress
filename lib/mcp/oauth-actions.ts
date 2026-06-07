'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createAuthorizationCode, getMcpClientByClientId, getMcpEnabled, requestedScopesWithinClient } from '@/lib/mcp/store'
import type { McpScope } from '@/lib/mcp/scopes'
import { createServiceClient } from '@/lib/supabase/service'

function requireString(formData: FormData, key: string): string {
  const value = String(formData.get(key) || '').trim()
  if (!value) throw new Error(`${key} is required.`)
  return value
}

function appendOAuthError(redirectUri: string, error: string, state: string): string {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  if (state) url.searchParams.set('state', state)
  return url.toString()
}

export async function approveMcpAuthorizationAction(formData: FormData) {
  const { user } = await requireAdmin()
  const service = createServiceClient()

  const enabled = await getMcpEnabled(service)
  if (!enabled) {
    throw new Error('Remote MCP is disabled.')
  }

  const responseType = requireString(formData, 'response_type')
  const clientId = requireString(formData, 'client_id')
  const redirectUri = requireString(formData, 'redirect_uri')
  const codeChallenge = requireString(formData, 'code_challenge')
  const codeChallengeMethod = requireString(formData, 'code_challenge_method')
  const scope = String(formData.get('scope') || '')
  const state = String(formData.get('state') || '')
  const resource = requireString(formData, 'resource')

  if (responseType !== 'code') {
    throw new Error('Only response_type=code is supported.')
  }
  if (codeChallengeMethod !== 'S256') {
    throw new Error('Only PKCE S256 is supported.')
  }

  const client = await getMcpClientByClientId(service, clientId)
  if (!client || !client.enabled) {
    throw new Error('OAuth client is not available.')
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    throw new Error('Redirect URI is not registered for this client.')
  }

  let scopes: McpScope[]
  try {
    scopes = requestedScopesWithinClient(scope, client)
  } catch {
    redirect(appendOAuthError(redirectUri, 'invalid_scope', state))
  }

  const code = await createAuthorizationCode(service, {
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
    scopes,
    resource,
  })

  const url = new URL(redirectUri)
  url.searchParams.set('code', code)
  if (state) url.searchParams.set('state', state)

  redirect(url.toString())
}
