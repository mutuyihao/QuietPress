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
- `/admin/storage`: 存储 provider、配额和用量。
- `/admin/settings`: 站点设置、社交链接、关于页、上传压缩参数。

后台访问由 `proxy.ts` 和 `lib/admin-auth.ts` 保护；真正的数据访问仍由 Supabase RLS 防护。

## API 路由

- `GET /api/health`: 健康检查，包含 Supabase 连接状态。
- `GET /api/search`: 公开搜索，调用 `search_posts` RPC，带基础限流。
- `GET/POST /api/comments`: 评论读取和提交；提交会消毒 HTML，默认进入 pending。
- `POST /api/newsletter`: 邮件订阅接口，当前前台入口隐藏；仅保留邮箱记录能力，不发送邮件。
- `POST /api/view-event`: 浏览事件记录。
- `GET /api/cron/publish-scheduled`: 计划发布，需要 `CRON_SECRET`。
- `POST /api/auth/login`: 登录和首次管理员认领。
- `POST /api/auth/signout`: 退出登录。
- `GET/PATCH/DELETE /api/admin/comments`: 评论审核管理。
- `GET /api/admin/analytics`: 后台统计。
- `GET/DELETE /api/admin/media`: 媒体库。
- `POST /api/admin/upload`: 图片上传。
- `GET /api/admin/revisions`: 文章修订历史。

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

## 缓存与再验证

- 公开文章、标签、设置使用 `unstable_cache` 和 cache tags。
- 首页和标签页 `revalidate = 3600`。
- 文章和关于页 `revalidate = 86400`。
- Server Actions 在内容变更后调用 `revalidatePath` 和 `revalidateTag`。

## 安全边界

- Supabase RLS 是最终数据权限边界。
- 后台路由通过 Supabase session 和 `admin_profiles` 校验。
- 单管理员模式是当前产品约束。
- 登录、评论、搜索、浏览事件有基础限流。
- 评论/搜索等限流是进程内存实现，不适合多实例强一致防护；多实例生产环境建议迁移到 Redis/Upstash。
- 评论和 Markdown 输出有 HTML 消毒。
- 上传端 MIME 内容校验，禁止 SVG。
- `next.config.mjs` 配置 CSP、HSTS、X-Frame-Options、Referrer-Policy、Permissions-Policy 等安全头。
- Cron 路由必须携带 `Authorization: Bearer <CRON_SECRET>`。

## 部署

Vercel 一键部署：

- 使用 README 的 Deploy Button。
- 通过 Vercel Marketplace 创建或连接 Supabase。
- 在 `next build` 前运行 `pnpm bootstrap:vercel`。
- 自动执行 `supabase/migrations/202606020001_initial_release.sql`。
- 使用 `ADMIN_EMAIL` 创建第一个管理员。
- 初始临时密码为 `QuietPress@2026!`，必须在 `/admin/account` 修改。

GitHub Actions：

- 安装 pnpm 10.28.2。
- `pnpm install --frozen-lockfile`。
- `pnpm lint`。
- `pnpm build`。

Docker：

- 使用 Node 22 Alpine。
- 依赖安装、构建、运行分三阶段。
- 依赖 Next.js `output: 'standalone'`。
- 非 root 用户运行。
- 内置 `/api/health` healthcheck。

## 已知限制

- 没有多管理员、角色、邀请或权限矩阵。
- 没有测试框架；当前发布门禁是 lint + build。
- API 响应格式还未完全统一。
- 评论/搜索等限流是进程内存实现，不适合多实例强一致限流。
- 邮件订阅前台入口已隐藏；后端仅保留邮箱记录接口，不包含邮件发送、双重确认或退订流程。
- 文章修订历史支持查看，但尚未支持 diff 和恢复。
- 许可证尚未选择，公开发布前需要决定。
