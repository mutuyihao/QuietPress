import { NextRequest, NextResponse } from 'next/server'
import { exchangeAuthorizationCode, getMcpClientByClientId, getMcpEnabled, rotateRefreshToken, scopesToString } from '@/lib/mcp/store'
import { assertMcpResource, getMcpResourceUrl, isRegisteredRedirectUri } from '@/lib/mcp/oauth'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status },
  )
}

function getResource(request: NextRequest, value: string | null): string {
  return value || getMcpResourceUrl(request.nextUrl.origin)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const grantType = String(formData.get('grant_type') || '')
    const clientId = String(formData.get('client_id') || '')
    const resource = getResource(request, String(formData.get('resource') || ''))

    if (!clientId) return oauthError('invalid_request', 'client_id is required')
    try {
      assertMcpResource(request.nextUrl.origin, resource)
    } catch (error) {
      return oauthError('invalid_target', error instanceof Error ? error.message : 'Invalid resource')
    }

    const service = createServiceClient()
    const enabled = await getMcpEnabled(service)
    if (!enabled) return oauthError('temporarily_unavailable', 'Remote MCP is disabled', 503)

    const client = await getMcpClientByClientId(service, clientId)
    if (!client || !client.enabled) return oauthError('invalid_client', 'OAuth client is not available', 401)

    if (grantType === 'authorization_code') {
      const code = String(formData.get('code') || '')
      const redirectUri = String(formData.get('redirect_uri') || '')
      const codeVerifier = String(formData.get('code_verifier') || '')

      if (!code || !redirectUri || !codeVerifier) {
        return oauthError('invalid_request', 'code, redirect_uri, and code_verifier are required')
      }
      if (!isRegisteredRedirectUri(redirectUri, client.redirect_uris)) {
        return oauthError('invalid_grant', 'redirect_uri is not registered for this client')
      }

      const token = await exchangeAuthorizationCode(service, {
        code,
        clientId,
        redirectUri,
        codeVerifier,
        resource,
      })

      return NextResponse.json({
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        token_type: 'Bearer',
        expires_in: token.expiresIn,
        scope: scopesToString(token.scopes),
      })
    }

    if (grantType === 'refresh_token') {
      const refreshToken = String(formData.get('refresh_token') || '')
      if (!refreshToken) return oauthError('invalid_request', 'refresh_token is required')

      const token = await rotateRefreshToken(service, {
        refreshToken,
        clientId,
        resource,
      })

      return NextResponse.json({
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        token_type: 'Bearer',
        expires_in: token.expiresIn,
        scope: scopesToString(token.scopes),
      })
    }

    return oauthError('unsupported_grant_type', 'Only authorization_code and refresh_token are supported')
  } catch (error) {
    return oauthError('invalid_grant', error instanceof Error ? error.message : 'Token exchange failed')
  }
}
