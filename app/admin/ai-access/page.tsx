import { AlertTriangle } from 'lucide-react'
import { requireAdmin } from '@/lib/admin-auth'
import { createMcpClientAction, revokeMcpTokenAction, setMcpClientEnabledAction, setMcpEnabledAction } from '@/lib/mcp/admin-actions'
import { MCP_SCOPE_LABELS, MCP_SCOPES } from '@/lib/mcp/scopes'
import { getMcpEnabled, listMcpAuditLogs, listMcpClients, listMcpTokens } from '@/lib/mcp/store'
import { createServiceClient } from '@/lib/supabase/service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default async function AdminAiAccessPage() {
  await requireAdmin()

  let data:
    | {
        enabled: boolean
        clients: Awaited<ReturnType<typeof listMcpClients>>
        tokens: Awaited<ReturnType<typeof listMcpTokens>>
        logs: Awaited<ReturnType<typeof listMcpAuditLogs>>
      }
    | null = null
  let setupError: string | null = null

  try {
    const service = createServiceClient()
    const [enabled, clients, tokens, logs] = await Promise.all([
      getMcpEnabled(service),
      listMcpClients(service),
      listMcpTokens(service),
      listMcpAuditLogs(service),
    ])

    data = { enabled, clients, tokens, logs }
  } catch (error) {
    setupError = error instanceof Error ? error.message : 'Failed to load MCP settings.'
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">AI Access</h1>
        <p className="admin-page-description">
          Enable Remote MCP, register OAuth clients, revoke grants, and inspect AI tool audit logs.
        </p>
      </div>

      {setupError ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950">
              <AlertTriangle className="h-4 w-4" />
              MCP setup required
            </CardTitle>
            <CardDescription className="text-amber-900">
              {setupError}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-950">
            Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to the server environment and apply the latest Supabase migrations.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Remote MCP</CardTitle>
              <CardDescription>
                Keep this disabled until OAuth clients, scopes, and audit expectations are reviewed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={setMcpEnabledAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="enabled" value={data?.enabled ? 'false' : 'true'} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Status: {data?.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Endpoint: <code>/api/mcp</code> - DCR: <code>/oauth/register</code>
                  </p>
                </div>
                <Button type="submit" variant={data?.enabled ? 'destructive' : 'default'}>
                  {data?.enabled ? 'Disable MCP' : 'Enable MCP'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create OAuth Client</CardTitle>
              <CardDescription>
                Manual clients use Authorization Code + PKCE. Standards-based MCP clients can also self-register through Dynamic Client Registration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createMcpClientAction} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client name</Label>
                    <Input id="clientName" name="name" placeholder="Claude Desktop, ChatGPT, Cursor" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="redirectUris">Redirect URIs</Label>
                    <Textarea
                      id="redirectUris"
                      name="redirect_uris"
                      placeholder="https://client.example.com/oauth/callback"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {MCP_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <Checkbox name="scopes" value={scope} defaultChecked />
                      <span>{MCP_SCOPE_LABELS[scope]}</span>
                    </label>
                  ))}
                </div>

                <Button type="submit">Create client</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OAuth Clients</CardTitle>
              <CardDescription>
                Client IDs are safe to share with AI clients; no service-role secret is exposed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients yet.</p>
              ) : data?.clients.map((client) => (
                <div key={client.client_id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="font-medium text-foreground">{client.name}</p>
                        <p className="break-all text-xs text-muted-foreground">{client.client_id}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Registration: {client.registration_type === 'dynamic' ? 'Dynamic Client Registration' : 'Manual'}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">
                        Redirects: {client.redirect_uris.join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Scopes: {client.scopes.join(' ')}
                      </p>
                    </div>
                    <form action={setMcpClientEnabledAction}>
                      <input type="hidden" name="client_id" value={client.client_id} />
                      <input type="hidden" name="enabled" value={client.enabled ? 'false' : 'true'} />
                      <Button type="submit" variant={client.enabled ? 'outline' : 'default'} size="sm">
                        {client.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Grants</CardTitle>
              <CardDescription>
                Revoke tokens immediately if an AI client is no longer trusted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active grants.</p>
              ) : data?.tokens.map((token) => (
                <div key={token.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{token.client?.name || token.client_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(token.expires_at)} - Last used {formatDate(token.last_used_at)}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{token.scopes.join(' ')}</p>
                  </div>
                  <form action={revokeMcpTokenAction}>
                    <input type="hidden" name="token_id" value={token.id} />
                    <Button type="submit" variant="destructive" size="sm">Revoke</Button>
                  </form>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Audit Logs</CardTitle>
              <CardDescription>
                Successful and failed MCP tool calls are recorded here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data?.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events yet.</p>
              ) : data?.logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <p className="font-medium text-foreground">
                      {log.tool_name} - {log.status}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                  </div>
                  {log.error && <p className="mt-1 text-xs text-destructive">{log.error}</p>}
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    request {log.request_id} - client {log.client_id || 'unknown'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
