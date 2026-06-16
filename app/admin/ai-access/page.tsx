import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createMcpClientAction,
  revokeMcpTokenAction,
  setMcpClientEnabledAction,
  setMcpEnabledAction,
} from "@/lib/mcp/admin-actions";
import { MCP_SCOPE_LABELS, MCP_SCOPES } from "@/lib/mcp/scopes";
import {
  getMcpEnabled,
  listMcpAuditLogs,
  listMcpClients,
  listMcpTokens,
} from "@/lib/mcp/store";
import { createServiceClient } from "@/lib/supabase/service";
import { DEFAULT_LOCALE } from "@/lib/date-format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function formatDate(value: string | null | undefined): string {
  if (!value) return "从未";
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminAiAccessPage() {
  await requireAdmin();

  let data: {
    enabled: boolean;
    clients: Awaited<ReturnType<typeof listMcpClients>>;
    tokens: Awaited<ReturnType<typeof listMcpTokens>>;
    logs: Awaited<ReturnType<typeof listMcpAuditLogs>>;
  } | null = null;
  let setupError: string | null = null;

  try {
    const service = createServiceClient();
    const [enabled, clients, tokens, logs] = await Promise.all([
      getMcpEnabled(service),
      listMcpClients(service),
      listMcpTokens(service),
      listMcpAuditLogs(service),
    ]);

    data = { enabled, clients, tokens, logs };
  } catch (error) {
    setupError = error instanceof Error ? error.message : "加载 MCP 设置失败。";
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">AI 授权</h1>
        <p className="admin-page-description">
          启用 Remote MCP，管理 OAuth 客户端、授权、撤销和 AI 工具调用审计。
        </p>
      </div>

      {setupError ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950">
              <AlertTriangle className="h-4 w-4" />
              MCP 初始化未完成
            </CardTitle>
            <CardDescription className="text-amber-900">
              {setupError}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-950">
            请在服务端环境变量中配置 <code>SUPABASE_SERVICE_ROLE_KEY</code> 或{" "}
            <code>SUPABASE_SECRET_KEY</code>，并执行最新 Supabase 数据库迁移。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Remote MCP</CardTitle>
              <CardDescription>
                在确认 OAuth 客户端、授权范围和审计预期前，建议保持关闭。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={setMcpEnabledAction}
                className="flex flex-wrap items-center gap-3"
              >
                <input
                  type="hidden"
                  name="enabled"
                  value={data?.enabled ? "false" : "true"}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    状态：{data?.enabled ? "已启用" : "已关闭"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MCP 端点：<code>/api/mcp</code> - DCR：
                    <code>/oauth/register</code>
                  </p>
                </div>
                <Button
                  type="submit"
                  variant={data?.enabled ? "destructive" : "default"}
                >
                  {data?.enabled ? "关闭 MCP" : "启用 MCP"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>创建 OAuth 客户端</CardTitle>
              <CardDescription>
                手动客户端使用 Authorization Code + PKCE；标准 MCP
                客户端也可以通过 Dynamic Client Registration 自动注册。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createMcpClientAction} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">客户端名称</Label>
                    <Input
                      id="clientName"
                      name="name"
                      placeholder="Claude Desktop, ChatGPT, Cursor"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="redirectUris">回调地址</Label>
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
                    <label
                      key={scope}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox name="scopes" value={scope} defaultChecked />
                      <span>{MCP_SCOPE_LABELS[scope]}</span>
                    </label>
                  ))}
                </div>

                <Button type="submit">创建客户端</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OAuth 客户端</CardTitle>
              <CardDescription>
                Client ID 可以提供给 AI 客户端，不会暴露 service-role 密钥。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无客户端。</p>
              ) : (
                data?.clients.map((client) => (
                  <div
                    key={client.client_id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div>
                          <p className="font-medium text-foreground">
                            {client.name}
                          </p>
                          <p className="break-all text-xs text-muted-foreground">
                            {client.client_id}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          注册方式：
                          {client.registration_type === "dynamic"
                            ? "动态注册"
                            : "手动创建"}
                        </p>
                        <p className="break-all text-xs text-muted-foreground">
                          回调地址：{client.redirect_uris.join(", ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          授权范围：{client.scopes.join(" ")}
                        </p>
                      </div>
                      <form action={setMcpClientEnabledAction}>
                        <input
                          type="hidden"
                          name="client_id"
                          value={client.client_id}
                        />
                        <input
                          type="hidden"
                          name="enabled"
                          value={client.enabled ? "false" : "true"}
                        />
                        <Button
                          type="submit"
                          variant={client.enabled ? "outline" : "default"}
                          size="sm"
                        >
                          {client.enabled ? "禁用" : "启用"}
                        </Button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>有效授权</CardTitle>
              <CardDescription>
                如果不再信任某个 AI 客户端，请立即撤销对应授权。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无有效授权。</p>
              ) : (
                data?.tokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {token.client?.name || token.client_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        过期时间 {formatDate(token.expires_at)} - 最近使用{" "}
                        {formatDate(token.last_used_at)}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {token.scopes.join(" ")}
                      </p>
                    </div>
                    <form action={revokeMcpTokenAction}>
                      <input type="hidden" name="token_id" value={token.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        撤销
                      </Button>
                    </form>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>最近审计日志</CardTitle>
              <CardDescription>
                MCP 工具调用的成功和失败记录会显示在这里。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data?.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无审计事件。</p>
              ) : (
                data?.logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <p className="font-medium text-foreground">
                        {log.tool_name} -{" "}
                        {log.status === "success" ? "成功" : "失败"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                    {log.error && (
                      <p className="mt-1 text-xs text-destructive">
                        {log.error}
                      </p>
                    )}
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      请求 {log.request_id} - 客户端 {log.client_id || "未知"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
