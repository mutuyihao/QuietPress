# AI / MCP 操作博客指南

QuietPress 可以作为公网 Remote MCP 服务，让支持 MCP 的 AI 客户端在管理员授权后读取、编辑和管理博客内容。该功能默认关闭，需要管理员在后台手动启用。

## 功能范围

AI 客户端通过 `GET/POST /api/mcp` 连接 QuietPress。服务端使用 MCP Streamable HTTP，认证使用 OAuth Authorization Code + PKCE，并支持 Dynamic Client Registration(DCR)。

当前开放能力：

- 文章：搜索、读取、创建草稿、更新、发布、下线、删除。
- 标签：读取和管理标签。
- 评论：读取待审核评论、审核通过、拒绝。
- 媒体：读取媒体清单、从公网 URL 拉取图片并上传到当前存储 provider。
- 站点设置：读取和更新数据库中的公开站点配置字段。
- 迁移：导出迁移包、预检迁移包、执行迁移导入。
- 统计：读取后台分析摘要。
- Prompts：博客初稿、文章改写、SEO 检查、内容日历、评论回复建议。

不会开放：

- 管理员账号管理。
- 数据库任意 SQL。
- 环境变量、Supabase/S3/R2 密钥读取或修改。
- 存储 provider secret 配置。

## 端点

MCP：

```text
GET /api/mcp
POST /api/mcp
```

OAuth 和发现：

```text
GET  /.well-known/oauth-protected-resource
GET  /.well-known/oauth-authorization-server
POST /oauth/register
GET  /oauth/authorize
POST /oauth/token
POST /oauth/revoke
```

未携带 token 访问 `/api/mcp` 会返回 `401`，并通过 `WWW-Authenticate` 指向 protected-resource metadata。Bearer token 只接受 `Authorization` header，不接受 URL query 参数。

## 权限 Scopes

| Scope | 能力 |
| --- | --- |
| `posts:read` | 搜索和读取文章 |
| `posts:write` | 创建草稿、更新文章 |
| `posts:publish` | 发布和下线文章 |
| `posts:delete` | 删除文章 |
| `tags:write` | 管理标签 |
| `media:write` | 从 URL 上传图片 |
| `comments:moderate` | 审核评论 |
| `settings:write` | 更新公开站点设置 |
| `migration:read` | 导出迁移包 |
| `migration:write` | 预检和执行迁移导入 |
| `analytics:read` | 读取统计摘要 |

发布、删除、设置修改和迁移导入等高风险工具要求 `confirm: true` 和 `idempotency_key`。

## 启用步骤

1. 确认已执行所有数据库迁移，包括 `202606070002_quietpress_mcp_oauth.sql` 和 `202606070003_mcp_dynamic_client_registration.sql`。
2. 确认服务端环境变量包含 `SUPABASE_SERVICE_ROLE_KEY` 或 Vercel Marketplace 注入的 `SUPABASE_SECRET_KEY`。
3. 部署到 HTTPS 域名。生产环境不要通过明文 HTTP 暴露远程 MCP。
4. 登录后台，进入 `/admin/ai-access`。
5. 点击 `Enable MCP`。
6. 在 AI 客户端中添加 Remote MCP URL：`https://your-domain.com/api/mcp`。
7. 客户端会通过 metadata 自动发现 OAuth 端点，并通过 `/oauth/register` 自注册 client。
8. 浏览器会跳转到 QuietPress 授权页，管理员登录后确认 scopes。
9. 授权成功后，客户端使用 access token 调用 MCP tools。
10. 在 `/admin/ai-access` 查看 OAuth clients、active grants 和 audit logs。

## 客户端接入

### 标准 Remote MCP 客户端

支持 OAuth discovery 和 DCR 的客户端只需要配置 MCP URL：

```text
https://your-domain.com/api/mcp
```

QuietPress 会自动提供：

- Protected Resource Metadata。
- Authorization Server Metadata。
- Dynamic Client Registration。
- Authorization Code + PKCE。
- Refresh token rotation。

### Codex 配置示例

`~/.codex/config.toml`：

```toml
[mcp_servers.quietpress]
enabled = true
url = "https://your-domain.com/api/mcp"
oauth_resource = "https://your-domain.com/api/mcp"
scopes = [
  "posts:read",
  "posts:write",
  "posts:publish",
  "tags:write",
  "media:write",
  "comments:moderate"
]
default_tools_approval_mode = "prompt"
tool_timeout_sec = 120
```

如果客户端要求固定 OAuth callback，可以同时配置固定 callback URL，并在手工 OAuth client 中登记完全一致的 redirect URI。

### Claude / Gemini / 其它客户端

对支持 Remote MCP OAuth discovery 的客户端，使用同一个 MCP URL：

```text
https://your-domain.com/api/mcp
```

如果客户端提示“不支持动态 client registration”或要求手动填写 OAuth client：

1. 进入 `/admin/ai-access`。
2. 在 `Create OAuth Client` 中填写客户端名称。
3. 填写客户端要求的 redirect URI。生产 redirect URI 必须是 HTTPS；本地客户端允许 `http://localhost`、`http://127.0.0.1` 或 `http://[::1]` loopback。
4. 勾选允许的 scopes。
5. 创建后复制 `client_id` 到客户端。

## 手动 DCR 调试

可以用下面的请求验证 `/oauth/register`：

```bash
curl -X POST https://your-domain.com/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Local MCP Client",
    "redirect_uris": ["http://localhost:14567/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
    "scope": "posts:read posts:write"
  }'
```

成功时返回 `201` 和 `client_id`。DCR 创建的 client 会显示在 `/admin/ai-access` 的 OAuth Clients 列表中。

## 审计和撤销

每次 MCP tool 调用都会写入 `mcp_oauth_audit_logs`，包含：

- 管理员 user id。
- OAuth client id。
- 授权 scopes。
- tool 名称。
- 输入摘要和结果摘要。
- request id。
- IP hash 和 user-agent hash。
- 成功或失败状态。

撤销方式：

- 在 `/admin/ai-access` 的 Active Grants 中撤销单个 token。
- 禁用某个 OAuth client，阻止该 client 的后续访问。
- 关闭 Remote MCP，整体停止 `/api/mcp` 授权访问。

## 安全行为

- 功能默认关闭。
- access token 和 refresh token 只存 hash。
- access token 短期有效，refresh token 轮换。
- token 的 `resource` 必须精确匹配当前站点的 `/api/mcp`。
- token 不允许通过 URL query 传递。
- scope 不足时返回 `403`。
- 媒体 URL 上传会拒绝非 HTTP(S)、localhost、内网 IP、非图片 MIME、超大文件和超时下载。
- 站点设置工具只更新数据库中的公开配置字段，不读取或修改环境变量和密钥。

## 故障排查

- `401 Unauthorized`: 客户端未登录、token 过期、token 被撤销，或 Remote MCP 未完成 OAuth 流程。
- `403 Forbidden`: token 有效，但缺少工具要求的 scope。
- `invalid_target`: OAuth `resource` 不是当前站点的 `/api/mcp`。
- `invalid_client_metadata`: DCR 请求中的 redirect URI、scope、grant type 或 client metadata 不符合要求。
- `redirect_uri is not registered`: 手工 client 的 redirect URI 和客户端发起授权时的 redirect URI 不完全一致。
- `Remote MCP is disabled`: 后台 `/admin/ai-access` 尚未启用 MCP。

## 发布前检查

- `pnpm lint` 通过。
- `pnpm build` 通过。
- 未登录访问 `/api/mcp` 返回 `401` 和 `WWW-Authenticate`。
- `/.well-known/oauth-protected-resource` 返回当前站点的 `/api/mcp` resource。
- `/.well-known/oauth-authorization-server` 包含 `registration_endpoint`。
- DCR 注册成功后，后台 OAuth Clients 列表出现 dynamic client。
- 使用一个 MCP 客户端完成“创建草稿 -> 管理员授权发布 scope -> 发布文章 -> 前台可见”的完整流程。
