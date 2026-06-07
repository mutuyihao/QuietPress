import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { approveMcpAuthorizationAction } from '@/lib/mcp/oauth-actions'
import { getMcpClientByClientId, getMcpEnabled, requestedScopesWithinClient } from '@/lib/mcp/store'
import { createServiceClient } from '@/lib/supabase/service'
import { getDefaultSiteUrl } from '@/lib/env'
import { getAdminSession } from '@/lib/admin-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthorizePageProps {
  searchParams?: Promise<{
    response_type?: string
    client_id?: string
    redirect_uri?: string
    scope?: string
    state?: string
    code_challenge?: string
    code_challenge_method?: string
    resource?: string
  }>
}

async function getRequestOrigin(): Promise<string> {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') || 'http'
  return host ? `${protocol}://${host}` : getDefaultSiteUrl()
}

function getAuthorizePath(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  return `/oauth/authorize?${search.toString()}`
}

export default async function OAuthAuthorizePage({ searchParams }: AuthorizePageProps) {
  const params = await searchParams
  const origin = await getRequestOrigin()
  const resource = params?.resource || `${origin.replace(/\/+$/, '')}/api/mcp`
  const session = await getAdminSession()

  if (!session) {
    const login = new URL('/auth/login', origin)
    login.searchParams.set('next', getAuthorizePath({ ...(params || {}), resource }))
    redirect(login.toString())
  }

  let error: string | null = null
  let clientName = ''
  let selectedScopes: string[] = []

  try {
    const service = createServiceClient()
    const enabled = await getMcpEnabled(service)
    if (!enabled) throw new Error('Remote MCP is disabled.')
    if (params?.response_type !== 'code') throw new Error('Only response_type=code is supported.')
    if (!params?.client_id) throw new Error('client_id is required.')
    if (!params?.redirect_uri) throw new Error('redirect_uri is required.')
    if (!params?.code_challenge) throw new Error('code_challenge is required.')
    if (params?.code_challenge_method !== 'S256') throw new Error('Only code_challenge_method=S256 is supported.')

    const client = await getMcpClientByClientId(service, params.client_id)
    if (!client || !client.enabled) throw new Error('OAuth client is not available.')
    if (!client.redirect_uris.includes(params.redirect_uri)) {
      throw new Error('redirect_uri is not registered for this client.')
    }

    clientName = client.name
    selectedScopes = requestedScopesWithinClient(params.scope || '', client)
  } catch (err) {
    error = err instanceof Error ? err.message : 'Invalid authorization request.'
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Authorize AI blog access</CardTitle>
          <CardDescription>
            Review the OAuth request before allowing this MCP client to operate QuietPress.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Client:</span> {clientName}</p>
                <p className="break-all"><span className="font-medium">Redirect URI:</span> {params?.redirect_uri}</p>
                <p className="break-all"><span className="font-medium">Resource:</span> {resource}</p>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-2 text-sm font-medium text-foreground">Requested scopes</p>
                <div className="flex flex-wrap gap-2">
                  {selectedScopes.map((scope) => (
                    <span key={scope} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>

              <form action={approveMcpAuthorizationAction} className="flex justify-end gap-2">
                <input type="hidden" name="response_type" value={params?.response_type || ''} />
                <input type="hidden" name="client_id" value={params?.client_id || ''} />
                <input type="hidden" name="redirect_uri" value={params?.redirect_uri || ''} />
                <input type="hidden" name="scope" value={params?.scope || ''} />
                <input type="hidden" name="state" value={params?.state || ''} />
                <input type="hidden" name="code_challenge" value={params?.code_challenge || ''} />
                <input type="hidden" name="code_challenge_method" value={params?.code_challenge_method || ''} />
                <input type="hidden" name="resource" value={resource} />
                <Button asChild variant="outline">
                  <a href="/admin/ai-access">Cancel</a>
                </Button>
                <Button type="submit">Authorize</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
