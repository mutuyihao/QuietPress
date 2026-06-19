# 架构

## 概览

QuietPress 是一个 Next.js App Router 应用，公开博客和后台管理共用同一个代码库。Supabase 提供 Auth、Postgres、RLS 和默认对象存储；上传层也支持 S3 兼容服务和 Cloudflare R2。

```text
Browser
  -> Next.js App Router
    -> Server Components / Route Handlers / Server Actions
      -> Supabase Auth + Postgres + Storage
      -> Optional S3/R2 object storage
```

## 目录结构

```text
app/                  Next.js 路由、布局、API route handlers
components/           UI 组件、后台组件、编辑器、媒体库、评论组件
lib/                  查询、验证、仓库层、Supabase 客户端、存储适配器
supabase/migrations/  数据库、RLS、RPC、Storage bucket 迁移
docs/                 项目文档
.github/workflows/   GitHub Actions CI
```

## 公开路由

- `/`: 分页文章列表。
- `/posts/[slug]`: 文章详情，包含 Markdown 渲染、目录、代码块增强、浏览计数、相关文章、评论。
- `/tags`: 标签列表。
- `/tags/[slug]`: 标签文章列表。
- `/about`: 关于页，内容来自后台站点设置。
- `/rss.xml`: RSS 输出。
- `/sitemap.xml`: Sitemap。
- `/robots.txt`: Robots。

## 后台路由

- `/auth/login`: 管理员登录。
- `/admin`: 仪表盘、文章列表、统计图和热门阅读。
- `/admin/account`: 管理员修改密码。
- `/admin/posts/new`: 新建文章。
- `/admin/posts/[id]`: 编辑文章、图片上传、修订历史。
- `/admin/tags`: 标签管理。
- `/admin/comments`: 评论审核。
- `/admin/media`: 媒体库管理。
- `/admin/settings/migration`: QuietPress 迁移包导出、导入预检和执行导入。
- `/admin/ai-access`: Remote MCP 启用、OAuth client 管理、授权撤销和 MCP 调用审计。
- `/admin/storage`: 存储 provider、配额和用量。
- `/admin/settings`: 站点设置、社交链接、关于页、上传压缩参数。

后台访问由 `proxy.ts` 和 `lib/admin-auth.ts` 保护；真正的数据访问仍由 Supabase RLS 防护。

## API 路由

- `GET /api/health`: 健康检查，包含 Supabase 连接状态。
- `GET /api/search`: 公开搜索，调用 `search_posts` RPC，带持久化限流。
- `GET/POST /api/comments`: 评论读取和提交；提交会消毒 HTML，默认进入 pending。
- `POST /api/newsletter`: 邮件订阅接口，当前前台入口隐藏；仅保留邮箱记录能力，不发送邮件。
- `POST /api/view-event`: 浏览事件记录。
- `GET /api/cron/publish-scheduled`: 计划发布，需要 `CRON_SECRET`。
- `POST /api/auth/login`: 登录和首次管理员认领。
- `POST /api/auth/signout`: 退出登录。
- `GET/PATCH/DELETE /api/admin/comments`: 评论审核管理。
- `GET /api/admin/analytics`: 后台统计。
- `GET/DELETE /api/admin/media`: 媒体库。
- `GET /api/admin/migration/export`: 导出 QuietPress v1 迁移包。
- `POST /api/admin/migration/preview`: 解析迁移包并返回冲突预检，不写入数据。
- `POST /api/admin/migration/import`: 按管理员选择写入迁移包内容。
- `POST /api/admin/upload`: 图片上传。
- `GET /api/admin/revisions`: 文章修订历史。
- `GET/POST /api/mcp`: Remote MCP Streamable HTTP 入口。
- `GET /.well-known/oauth-protected-resource`: MCP OAuth protected-resource metadata。
- `GET /.well-known/oauth-authorization-server`: OAuth authorization-server metadata。
- `POST /oauth/register`: OAuth Dynamic Client Registration。
- `GET /oauth/authorize`: Authorization Code + PKCE 授权页。
- `POST /oauth/token`: access token 和 refresh token 签发/轮换。
- `POST /oauth/revoke`: token 撤销。

## 数据模型

核心表：

- `admin_profiles`: 管理员身份。
- `posts`: 文章。
- `tags`: 标签。
- `post_tags`: 文章标签关系。
- `site_settings`: 站点设置。
- `view_events`: 浏览事件。
- `post_revisions`: 文章修订历史。
- `comments`: 评论。
- `newsletter_subscribers`: 邮件订阅者预留表。
- `media_objects`: 媒体库对象记录。
- `quietpress_migrations`: Vercel bootstrap 已执行 migration 记录。
- `mcp_oauth_clients`: MCP OAuth client，包括手工登记和 DCR 自注册 client。
- `mcp_oauth_authorization_codes`: PKCE 授权码，只保存 hash。
- `mcp_oauth_tokens`: access/refresh token hash、resource、scope、过期和撤销状态。
- `mcp_oauth_audit_logs`: MCP tool 调用审计。

核心 RPC：

- `claim_first_admin`: 首次管理员认领。
- `search_posts`: 参数化搜索。
- `increment_post_views`: 浏览数递增。
- `get_daily_views`, `get_top_posts_daily`: 后台统计。
- `get_comment_counts`: 评论计数。
- `get_storage_bucket_usage`: Supabase bucket 用量。

## 内容渲染

Markdown 由 `lib/blog-utils.ts` 处理：

- `marked` 解析 Markdown。
- `shiki` 在服务端渲染代码高亮，客户端只增强复制按钮和语言标签。
- `sanitize-html` 清洗 HTML。
- 标题生成稳定 id。
- Markdown HTML 使用内存 LRU 风格缓存。
- 图片只允许 `http`/`https` scheme，默认 lazy loading。

## 存储

存储适配器位于 `lib/storage`：

- `SupabaseStorage`: 默认 provider，使用 `blog-images` bucket。
- `S3Storage`: S3 兼容 provider，可用于 AWS S3、MinIO、Backblaze B2。
- `r2`: 使用同一个 S3 适配器，Cloudflare R2 endpoint 会启用 path-style。

上传入口会执行：

- 管理员鉴权。
- 文件大小限制，默认 10 MB，可在后台配置。
- MIME 内容嗅探，防止伪造 `file.type`。
- 允许 JPEG、PNG、WebP、GIF。
- 禁止 SVG 上传。

## AI / MCP

MCP 相关代码位于 `lib/mcp` 和 `app/api/mcp`：

- `app/api/mcp/route.ts`: MCP Streamable HTTP JSON-RPC 入口，处理 initialize、tools、resources 和 prompts。
- `lib/mcp/tools.ts`: MCP tools/resources/prompts 定义和 scope 校验。
- `lib/mcp/store.ts`: OAuth client、authorization code、token、audit log 的持久化访问。
- `lib/mcp/oauth.ts`: OAuth resource、redirect URI、scope 和 DCR 兼容校验。
- `app/oauth/*`: OAuth authorize/token/revoke/register 端点。
- `app/admin/ai-access`: 后台启用、client 管理、grant 撤销和审计查看。

Remote MCP 默认关闭。启用后，客户端通过 `/api/mcp` 访问，未授权请求会收到 `WWW-Authenticate`，再通过 metadata discovery 找到 OAuth authorization server。标准客户端可使用 `/oauth/register` 动态注册 public client；不支持 DCR 的客户端可以在后台手工创建 OAuth client。

MCP tool 不直接绕过权限层：每次调用都要求有效 Bearer token、精确匹配的 `resource` audience、管理员仍存在、client 未禁用、scope 满足工具要求。写操作会调用统一 blog service 层，并在内容变更后执行缓存再验证。

## 缓存与再验证

- 公开文章、标签、设置使用 `unstable_cache` 和 cache tags。
- 公开文章列表、文章详情、归档、标签计数、sitemap 和标签 RSS 的数据缓存默认 5 分钟；站点设置和标签基础数据默认 1 小时。
- 首页、分页页、文章页和标签页使用 SSG/ISR；文章和标签 slug 通过 `generateStaticParams` 预生成，新增内容仍允许按需回退。
- Server Actions、MCP 内容写入、迁移导入和计划发布在内容变更后调用 `revalidatePath` 和 `revalidateTag`。

## 安全边界

- Supabase RLS 是最终数据权限边界。
- 后台路由通过 Supabase session 和 `admin_profiles` 校验。
- 单管理员模式是当前产品约束。
- 登录、评论、搜索、浏览事件和 MCP 入口使用 Supabase `rate_limits` 表做持久化限流；服务端配置缺失时降级为进程内存限流。
- 评论 IP、限流指纹和审计 IP/UA 只保存带盐哈希；生产环境必须设置 `IP_HASH_SECRET`，启动校验会拒绝缺失配置。
- 自托管反向代理可通过 `TRUSTED_PROXY_HOPS` 控制从 `X-Forwarded-For` 右侧选取可信客户端 IP。
- 评论和 Markdown 输出有 HTML 消毒。
- 上传端 MIME 内容校验，禁止 SVG。
- `next.config.mjs` 配置 CSP、HSTS、X-Frame-Options、Referrer-Policy、Permissions-Policy 等安全头；`/admin` 和 `/auth` 页面由 `proxy.ts` 下发 per-request nonce CSP。
- Cron 路由必须携带 `Authorization: Bearer <CRON_SECRET>`。
- Remote MCP 默认关闭；启用后只接受 `Authorization` header 中的 Bearer token，不接受 query token。
- MCP OAuth access token 和 refresh token 只保存 hash，access token 短期有效，refresh token 轮换。
- MCP OAuth `resource` 必须精确匹配当前站点 `/api/mcp`，防止错误 audience token 被复用。
- MCP 高风险工具要求 `confirm: true` 和 `idempotency_key`。
- MCP 媒体 URL 上传执行 SSRF 防护、图片 MIME 校验、大小限制和超时控制。

## 部署

Vercel 一键部署：

- 使用 README 的 Deploy Button。
- Deploy Button 会复制 canonical 仓库到部署者自己的 Git 账号；该副本不是 upstream 跟踪仓库。
- 通过 Vercel Marketplace 创建或连接 Supabase。
- 在 `next build` 前运行 `pnpm bootstrap:vercel`。
- 按文件名顺序自动执行 `supabase/migrations/*.sql`，并通过 `public.quietpress_migrations` 跳过已执行且 checksum 一致的 migration。
- 使用 `ADMIN_EMAIL` 创建第一个管理员。
- 初始临时密码为 `QuietPress@2026!`，必须在 `/admin/account` 修改。

可持续更新部署：

- 一键部署产生的仓库不会自动跟随 canonical 仓库更新。
- 后续更新需要部署者手动合并新版代码，或重新部署新版模板并迁移内容。

GitHub Actions：

- 安装 pnpm 10.28.2。
- `pnpm install --frozen-lockfile`。
- `pnpm format:check`。
- `pnpm lint`。
- `pnpm typecheck`。
- `pnpm test:run`。
- `pnpm build`。

Docker：

- 使用 Node 22 Alpine。
- 依赖安装、构建、运行分三阶段。
- 依赖 Next.js `output: 'standalone'`。
- 非 root 用户运行。
- 内置 `/api/health` healthcheck。

## 已知限制

- 没有多管理员、角色、邀请或权限矩阵。
- 当前自动化测试覆盖发布关键纯逻辑和安全边界；浏览器端 E2E 仍以手动 smoke test 为主。
- OAuth/MCP 端点保留协议规定的 JSON 结构；自有 API route 使用 `{ ok, data/error }` envelope。
- 持久化限流依赖 Supabase service role；服务端配置缺失时会降级为进程内存限流。
- 邮件订阅前台入口已隐藏；后端仅保留邮箱记录接口，不包含邮件发送、双重确认或退订流程。
- 文章修订历史支持查看，但尚未支持 diff 和恢复。
- 许可证尚未选择，公开发布前需要决定。
