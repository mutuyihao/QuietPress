# 博客项目全面优化建议方案

> 范围：仅针对应用代码（Next.js 16 App Router + React 19 + Supabase + Tailwind v4，部署于 Vercel）。**明确排除 `docs/` 目录**。
> 方法：3 个并行探索代理通读源码 → 多代理工作流按维度核验/设计 → 关键结论由本人逐条直接对照源码确认。
> 置信标记：**✅ 已直接核实**（本轮已读源码确认）；**◑ 审计推断**（附 `file:line` 证据，实施前建议抽查一遍）。

---

## 执行摘要

整体评价：架构基础扎实——仓储模式分层、双层缓存（React `cache()` + `unstable_cache`）、RLS、CSRF、Zod 校验、sanitize-html、安全响应头、SEO（JSON-LD/sitemap/RSS/robots）、字体与富文本编辑器懒加载均已到位。主要问题集中在**少数“线上已损坏”的功能**、**N+1 查询与渲染策略未生效**、以及**错误处理/可观测性**。

### 优先级路线图

| 级别   | 数量 | 含义                                              | 建议时间窗        |
| ------ | ---- | ------------------------------------------------- | ----------------- |
| **P0** | 4    | 线上功能已损坏或存在严重安全/隐私缺陷，**立即修** | 第 1 批，1–2 天   |
| **P1** | 13   | 显著影响性能/安全/可维护性，近期应做              | 第 2–3 批，1–2 周 |
| **P2** | 9    | 锦上添花、长期收益                                | 第 4 批，按需     |

### P0 速览（务必先做）

| #    | 标题                                                                              | 维度           | 核实                                |
| ---- | --------------------------------------------------------------------------------- | -------------- | ----------------------------------- |
| P0-1 | 定时发布在 anon+RLS 下 100% 失效（+发布后无缓存失效、无调度声明、密钥非时序比较） | 性能/安全/质量 | ✅                                  |
| P0-2 | 生产环境代码高亮被 CSP 拦截（Prism 从 cdnjs 加载，不在 `script-src` 白名单）      | 前端           | ✅                                  |
| P0-3 | API 错误信息泄露：原始 DB/Postgres 错误直回客户端（含**未认证**的登录路由）       | 安全           | ✅(cron 处已确认同款) / ◑(其余站点) |
| P0-4 | IP 哈希盐回退到公开值（`NEXT_PUBLIC_SITE_URL`/字面量），假名化可被轻易还原        | 安全/隐私      | ✅                                  |

---

## 一、P0：立即修复（线上已损坏 / 严重安全）

### P0-1　修复定时发布链路 ✅

**问题**（合并自三个维度的同一根因）

- `app/api/cron/publish-scheduled/route.ts:14` 用 `createClient()` → `lib/supabase/server.ts:5` 是 **anon key + cookie** 客户端。Vercel Cron 仅携带 `Authorization: Bearer <CRON_SECRET>`、无 Supabase 会话 cookie，故以 **anon 角色**执行。
- RLS 策略 `supabase/migrations/202606020001_initial_release.sql:475-483` 只允许 anon 读 `status='published' and published_at<=now()`，**无任何策略放行 `scheduled`**；因此 `route.ts:16-20` 的 `.eq('status','scheduled')` 恒返回 0 行 → 端点永远 `{published:0}`。**定时发布静默失效（无报错）。** 即便能读到，UPDATE 也会被 admin-only 写策略拦截。
- 发布成功后 `route.ts:30-45` **未调用任何 `revalidatePath/revalidateTag`**：首页 ISR 3600s、文章页 86400s，文章最长 1~24h 不可见。
- `route.ts:9` 用 `authHeader !== \`Bearer ${cronSecret}\`` 非时序安全比较；`route.ts:23,39`回显原始`error.message`；`route.ts:18`select 缺`slug`；仓库根无 `vercel.json`（cron 调度未声明）。

**步骤**

1. 改 `import { createServiceClient } from '@/lib/supabase/service'`，`route.ts:14` → `const supabase = createServiceClient()`（绕过 RLS，与 `app/api/mcp/route.ts` 既有用法一致）。
2. `route.ts:18` select 扩为 `'id, title, slug, published_at'`。
3. update 成功后调用既有 `revalidatePostContent(...posts.map(p=>p.slug))`（`lib/blog/revalidation.ts:23-33`，已覆盖 `/`、`/rss.xml`、`/sitemap.xml`、`posts` tag、各文章详情路径）。
4. 顶部加 `export const dynamic = 'force-dynamic'`；密钥比较改用 `node:crypto` 的 `timingSafeEqual`（先 `sha256` 再比，规避长度泄露）。
5. 错误响应改固定文案（接入 P0-3 的 `apiInternalError`）；用 `logAdminAction`（`lib/audit-log.ts`）记一条 `cron.publish_scheduled` 审计。
6. 新建 `vercel.json`：`{ "crons": [{ "path": "/api/cron/publish-scheduled", "schedule": "*/5 * * * *" }] }`（Vercel 自动带 `Bearer $CRON_SECRET`，与现有校验兼容）。

**预期效果**：定时发布可用性 0% → 100%；文章可见延迟从 1~24h 降到 ≤1 个 cron 周期（≤5min）；RSS/sitemap 同步刷新。
**技术选型**：`createServiceClient` + `vercel.json crons` + `timingSafeEqual`，全部复用既有设施、不放宽 RLS、零新依赖。　**工作量**：小

### P0-2　修复生产代码高亮被 CSP 拦截 ✅

**问题**：`components/code-block-enhancer.tsx:98,104,107` 运行时注入 `https://cdnjs.cloudflare.com/...` 的 Prism 脚本；而 `next.config.mjs:54` 生产 `script-src` = `'self' 'unsafe-inline' https://va.vercel-scripts.com`，**不含 cdnjs**。浏览器按 CSP 拒绝加载 → `window.Prism` 永远 undefined → **所有文章页代码块在生产环境无高亮**（复制按钮逻辑也依赖该回调链）。

**步骤（两选一，建议同日热修 + 后续正解）**

- **同日热修（小）**：在 `next.config.mjs:54` `script-src` 追加 `https://cdnjs.cloudflare.com`，立即恢复高亮。代价：保留外部 CDN 依赖、客户端运行时、首屏高亮闪烁（CLS）。
- **正解（中，推荐）**：移除客户端 Prism，改在服务端 `lib/blog-utils.ts:markdownToHtml()` 内用 **Shiki** 高亮（marked 自定义 `code` 渲染器，`marked.use({async:true})`）。注意 sanitize-html 需放行 `pre/code/span` 的 `class`（用 Shiki 的 CSS-variables/class 主题，避免内联 `style`，对 CSP 更友好），并随包一份小主题 CSS。高亮结果随既有 60min/200 条 markdown 缓存一并缓存。

**预期效果**：代码高亮恢复；正解方案额外移除客户端 ~一次 CDN 往返 + Prism 运行时，消除高亮闪烁，改善 INP/LCP，且不再依赖第三方 CDN（CSP 可继续收紧）。
**技术选型**：Shiki（服务端、构建期主题、生态最佳）> 自托管 prismjs（仍客户端运行）> 仅加 CDN 白名单（最快但治标）。　**工作量**：小（热修）/ 中（正解）

### P0-3　统一修复 API 错误信息泄露 ✅/◑

**问题**：多处把 Supabase/Postgres 原始错误回显给客户端。已直接确认：`app/api/cron/publish-scheduled/route.ts:23,39`。审计定位（◑，附行号）：`app/api/admin/comments/route.ts:32,62,99`、`revisions/route.ts:34`、`analytics/route.ts:41`、`upload/route.ts:147`、`media/route.ts:47,82`、`migration/{import:70,export:39,preview:24}`，经 `getErrorMessage`（`lib/utils.ts:8-12` 直接透传）；**最严重**：未认证可达的 `app/api/auth/login/route.ts:93,106,122` 把 `error.message` 拼进重定向 URL 展示给任意访客，泄露表名/RPC 名/约束名。对照范式：`app/api/comments/route.ts` 全用固定文案（正确）。

**步骤**

1. `lib/api-response.ts` 新增 `apiInternalError(code, err, message='服务器内部错误，请稍后重试')`：生成 `requestId`（复用 `lib/privacy.ts:38 newRequestId()`）、`console.error('[code] requestId=...', err)`、返回带 `(ref: <requestId>)` 的 500。
2. 上述所有泄露点替换为 `apiInternalError(...)`；登录路由三处改固定文案 + `requestId`，原始错误落日志（`authError` 分支已有白名单映射，保留）。
3. 保留“迁移表未建”特判，但把 `error.message.includes('comments')` 改为判 `error.code === '42P01'`（undefined_table）。
4. `app/api/mcp/route.ts:311-315` 仅放行显式业务校验错误，其余统一 `MCP request failed` + 落日志。
5. 验收：`rg "apiError\([^)]*\.message" app/api` 应只剩 Zod 4xx 用户输入反馈。

**预期效果**：未认证可见的 DB 结构泄露面 → 0；所有 5xx 带 `requestId`，与日志一键关联，排障更快。
**技术选型**：扩展既有 `lib/api-response.ts`，零新依赖。　**工作量**：中

### P0-4　IP 哈希盐治理 ✅

**问题**：`lib/privacy.ts:6-12` 盐回退链 `IP_HASH_SECRET → SUPABASE_SERVICE_ROLE_KEY → SUPABASE_SECRET_KEY → NEXT_PUBLIC_SITE_URL → 'quietpress'`。后两级**公开可知**：自托管/Docker 漏配服务端密钥时，`comments.ip_hash`、`*_audit_logs` 中的哈希等价于“已知盐的 SHA-256(IP)”，IPv4 全空间单 GPU 数分钟可整库还原，假名化失效；中间两级把权限最高的 service key 当盐复用，违反密钥单一用途。`.env.example:51` 目前仅把它列为注释可选项。

**步骤**

1. `lib/env.ts` 新增 `getIpHashSecret()`（沿用既有 fail-fast getter 风格）：有值即返；`NODE_ENV==='production'` 且缺失则 `throw`（提示 `openssl rand -hex 32`）；否则返回开发占位盐。
2. `lib/privacy.ts:6-12` `stableHashSalt()` 改为 `return getIpHashSecret()`，删除全部公开/服务密钥回退。
3. `.env.example` 将 `IP_HASH_SECRET` 改为**生产必填**并注明轮换影响；README 同步。
4. 验收：无 `IP_HASH_SECRET` 时生产构建启动即报错；设置后评论/限流正常。

**预期效果**：IP 还原成本从“公开盐下分钟级”升到计算不可行；配置缺失从“静默弱安全”变为“部署期即时失败”。
**技术选型**：复用 `lib/env.ts` 手写 getter，零新依赖。　**工作量**：小

---

## 二、性能优化：数据库查询与缓存（perf-data）

### P1　为 `posts/[slug]`、`tags/[slug]` 添加 `generateStaticParams` ◑

**问题**：全仓 `generateStaticParams` 零结果（`posts/[slug]/page.tsx:18` 仅 `revalidate=86400`，`tags/[slug]/page.tsx:7=3600`），全部按需 ISR。每个新 slug 首访承担完整 SSR：`getPostBySlug` + `getSiteSettings` + `getRelatedPosts`（4 次）≈ 6 次串行 Supabase 往返 + markdown 渲染。
**步骤**：`lib/db/supabase/posts.ts` 加 `listPublishedSlugs()`（只 select `slug`，`.limit(1000)`）；`lib/queries.ts` 按既有 `unstable_cache` 模式包一层；两个页面加 `generateStaticParams`（保持 `dynamicParams=true` 以兼容新文章按需回退）；tags 复用 `getAllTags()`。
**预期效果**：已发布文章页首访 TTFB 从 ~500–1500ms 降到 CDN/ISR 命中的 50–150ms；构建期前移首访查询。　**技术选型**：SSG+ISR 混合。　**工作量**：小

### P1　消除首页 `searchParams` 导致的整页动态渲染 ◑

**问题**：`app/(public)/page.tsx:7` 声明 `revalidate=3600`，但 `:20-22` `await searchParams` 使页面退化为 **dynamic rendering**，ISR 实际失效——首页每请求一次 SSR。`components/pagination.tsx:13-19` 基于 `?page=` 查询串，所有分页 URL 同样动态。
**步骤**：首页改为固定渲染第 1 页（删 `searchParams`）；新建路由段分页 `app/(public)/page/[pageNumber]/page.tsx`（第 1 页 `redirect('/')`、非法值 `notFound()`、`generateStaticParams` 生成 2..N）；`pagination.tsx` 改纯函数 `page===1 ? '/' : \`/page/${page}\``；在 `lib/blog/revalidation.ts`追加`revalidatePath('/page/[pageNumber]','page')`。
**预期效果**：首页 TTFB 从 ~300–800ms 降到 CDN 命中 30–100ms；首页相关 Vercel 函数调用近乎归零。　**技术选型**：路由段分页（可静态化、可收录）。　**工作量**：中

### P1　`listByTag` 由 4 次串行往返压到 2 次 ◑

**问题**：`lib/db/supabase/posts.ts:229-258` 依次查 tags → post_tags 取 id → `.in('id',...)` 查 posts → `attachTags()`（`:69-98`）再查一次；未复用同文件 `:7` 的 `POST_WITH_TAGS_SELECT='*, post_tags(tags(*))'`；大标签下 `.in` 产生超长 IN 列表。
**步骤**：保留 tag 查询；其余三次合并为 `.from('post_tags').select('posts!inner(*, post_tags(tags(*)))').eq('tag_id', tag.id)`（PostgREST inner join 一次取回），复用 `mapNestedPost`，加 `.limit(200)`。
**预期效果**：缓存未命中时往返 4→2，省 ~2 RTT（100–300ms）；消除大 IN。　**技术选型**：嵌套 embed（零迁移）。　**工作量**：小

### P1　`getRelatedPosts` 由 4 次往返压到 2 次 ◑

**问题**：`lib/related-posts.ts:19-61` 四次串行（其中 `:51-61` 的两次手工 join 可由嵌套 select 替代），首查无 `limit`。
**步骤**：`:40-46` 的 posts select 改为 `'*, post_tags(tags(*))'`；删 `:51-74` 两次查询与手工 tagMap，改用 `mapNestedPost`；首查加 `.limit(500)`；缓存配置不变。
**预期效果**：文章页缓存未命中往返 ~6→~4，省 ~2 RTT；减约 25 行代码。　**工作量**：小

### P2　细化缓存 tag：单篇变更不再清空全部文章缓存 ✔

**问题**：`lib/queries.ts:29-35` `getPostBySlug` 只挂粗粒度 `['posts']`，而 `revalidation.ts:28`/`actions.ts:80` 任意单篇改动都 `revalidateTag('posts','max')`，一次清空所有详情+列表+related 缓存。
**已完成**：`getPostBySlug` 已按 slug 构造 keyParts，并切到单篇 `post:${slug}` tag；`revalidatePostContent()` 追加单篇 tag 失效，列表类仍由 `'posts'` 覆盖；为避免 Next 256 字符 tag 限制，超长 slug 统一走哈希 tag。
**预期效果**：以 100 篇计，编辑 1 篇后其余详情缓存命中率 0%→~99%。　**工作量**：小

### P2　管理端搜索/统计停止拉全表全文，下推 DB ◑

**问题**：`lib/blog-service.ts:117-147 searchBlogPosts` → `listAll()`（`posts.ts:130-138`，无分页、含全文）后 JS `includes` 过滤；`:393-422 getBlogAnalyticsSummary` 同样拉全文只为算 5 个计数。
**步骤**：新增 `searchAdmin(query,status,limit)`（窄列 + `.or(title/excerpt/content_markdown ilike)`，按 `search_posts` RPC 同款转义 `%/_/\`）；统计改 `select('status, views_count')` 窄列。
**预期效果**：以 200 篇×10KB 计，单次传输 ~2MB→<60KB（~97%↓），响应降到 <100ms 量级，复杂度不再随文章数恶化。　**工作量**：中

### P2　`view-event` 去掉冗余存在性预查询 ◑

**问题**：`app/api/view-event/route.ts:31-41` 在调 RPC 前先做一次存在性 select，而 `increment_post_views` RPC（`initial_release.sql:264-277`）内部 UPDATE 已带相同条件——每次浏览多一次 DB 往返（该接口限流 120/min/IP）。
**步骤**：新增迁移让 RPC 返回 `found` boolean；路由删预查询，`found===false` 返回现有 404。
**预期效果**：每次浏览 DB 往返 3→2（-33%），峰值下 posts 读 QPS 降 1/3。　**工作量**：小

---

## 三、前端：资源加载 / 页面响应 / 移动端 / 交互 / SEO（frontend）

> 本维度由探索代理详尽报告 + 本人直接核对关键文件得出。

### P1　补齐错误边界（当前全站零 `error.tsx`）✅

**问题**：Glob 确认 `app/` 下仅有 `loading.tsx`（1 个）与 `not-found.tsx`（2 个），**无任何 `error.tsx`/`global-error.tsx`**。任意渲染/数据异常在生产环境只会落到 Next 默认的 “Application error” 白屏，无品牌化兜底、无重试入口。
**步骤**：新增 `app/error.tsx`（`'use client'`，含 `reset()` 重试与返回首页）、`app/global-error.tsx`（兜 root layout 异常，需自带 `<html><body>`）、`app/admin/error.tsx`（后台专用）。文案/配色复用既有 `not-found.tsx` 与设计系统。可顺带把 `app/(public)/error.tsx` 单列，区分公共页与后台。
**预期效果**：异常从“白屏”变为可重试的友好页；配合 P0-3 的 `requestId` 可在错误页展示工单号。　**技术选型**：Next App Router 原生 error boundary。　**工作量**：小

### P1　动态 OG 图生成（社交分享 SEO 缺口）◑

**问题**：`app/layout.tsx:43,49` 仅当配置了 `default_og_image_url` 才有站点级 OG 图；文章页用封面，但**无封面的文章 + 首页/标签页在未配默认图时无 OG 图**，社交分享卡片退化为纯文字。
**步骤**：新增 `app/opengraph-image.tsx`（站点级）与 `app/(public)/posts/[slug]/opengraph-image.tsx`（文章级，无封面时用标题+站点名渲染 1200×630），用 `next/og` 的 `ImageResponse`；`generateMetadata` 自动引用同目录 `opengraph-image`。
**预期效果**：每篇文章/页面都有规范 OG 卡片，提升社交点击率与分享观感。　**技术选型**：`next/og`（内置，无新依赖）。　**工作量**：中

### P1　后台路由补 `loading.tsx` 骨架（感知性能）◑

**问题**：仅 `app/(public)/loading.tsx` 存在；`/admin/*` 导航时无加载态，数据拉取期间白屏。
**步骤**：为 `app/admin/loading.tsx` 及主要子路由（posts、comments、media 等）加骨架，复用公共 loading 的 pulse 占位风格。
**预期效果**：后台导航感知延迟下降，避免“点了没反应”。　**工作量**：小

### P2　分页 SEO：`rel="prev"/"next"` ✅

**问题**：`components/pagination.tsx` 无 `rel` 关系提示（且基于 `?page=` 查询串，随 P1 的 `/page/[n]` 改造一并解决可收录性）。
**步骤**：已在分页页的 `generateMetadata` 用 `pagination.previous/next` 注入 `rel="prev"/"next"` 链接；分页组件可见翻页链接也已补 `rel`。
**预期效果**：帮助搜索引擎理解分页序列。　**工作量**：小

### P2　削减客户端 bundle 与图片优化 ◑

**问题**：`sonner` 被多个 admin 组件静态导入；`components/post-editor.tsx:380` 封面预览用原生 `<img>`；`<head>` 未对 Supabase 存储域名 `preconnect`。
**步骤**：toast 通过统一封装按需 import；封面预览改 `next/image`（或至少 `loading="lazy"`）；在 `layout.tsx` `<head>` 加 `<link rel="preconnect">` 指向 Supabase/S3 公共域。
**预期效果**：后台首包略减；首图 LCP 略升；图片懒加载。　**工作量**：小

---

## 四、安全加固（security）

> P0-1（cron 时序比较）、P0-3（错误泄露）、P0-4（IP 盐）见上。以下为其余项。

### P1　`proxy.ts` 中间件覆盖 `/api/admin`（边缘统一拦截）◑

**问题**：`lib/supabase/proxy.ts:33` 的 `isAdminRoute` 只匹配 `/admin`，`/api/admin/*` 完全依赖各路由自调 `getAdminSession`（单层防御，新增路由漏写即暴露）；`:43-47` 未登录重定向丢弃了原始路径（`next` 回跳能力闲置）。
**步骤**：`:33` 扩为同时匹配 `/admin` 与 `/api/admin`；API 未授权返回 401 JSON（形状对齐 `ApiErrorBody`），页面保留 redirect 并补 `next` 参数（`login route` 的 `safeRedirectPath` 已防开放重定向）；各路由内 `getAdminSession` 作为第二层保留。
**预期效果**：admin API 防护变“边缘拦截 + 路由二次校验”双层；未授权扫描请求不再进入路由体；登录后回跳成功率 0%→100%。　**工作量**：小

### P1　admin 高成本端点接入既有 durable 限流 ◑

**问题**：公共端点均已限流，但 `/api/admin/*` 全部零限流：`upload` 每请求跑 sharp 转码 + 存储写入；`migration/import|export` 全量读写库；`analytics` 两个聚合 RPC。会话失窃或前端失控重试可无限刷，放大 Vercel/Supabase 账单。`lib/rate-limit.ts:66-99` + `check_rate_limit` RPC 已具备多实例一致的限流，未被复用。
**步骤**：以 `session.user.id` 为标识接入 `checkRateLimitIdentifier`——upload `admin-upload` 30/min；migration `admin-migration` 5/10min；analytics `admin-analytics` 60/min；返回 429 + `Retry-After`（写法参考 `comments/route.ts:142-153`）。
**预期效果**：单账号可触发的转码/迁移降到有限速率，最坏账单与 DB 负载压低一个数量级。　**工作量**：小

### P1　CSP 收紧：`/admin`、`/auth` 启用 per-request nonce + `strict-dynamic` ◑

**问题**：`next.config.mjs:54` 生产 `script-src` 含 `'unsafe-inline'`，使 CSP 对脚本注入型 XSS 基本失效；任何注入点都可执行内联脚本窃取 admin 会话（与“admin API 零限流”叠加风险）。全站静态 CSP 无法带 nonce，但 `/admin`、`/auth` 本就是动态渲染，可零代价 nonce 化。
**步骤**：在 `proxy.ts` 对 `/admin`、`/auth` 生成 per-request nonce 并注入请求头 `x-nonce` + 覆盖 CSP（`script-src 'nonce-...' 'strict-dynamic'`）；`next.config.mjs:78-85` 拆 source（`/((?!admin|auth).*)` 用现有头，admin/auth 只下发非 CSP 头）；公共页先加 `Content-Security-Policy-Report-Only`（不含 `unsafe-inline`）观察 1–2 周再正式收紧。`style-src 'unsafe-inline'` 为 Tailwind v4 所需，保留。
**预期效果**：admin 面板内联脚本注入面降为 0；对 ISR 缓存命中零影响（仅动态路由 nonce 化）。　**工作量**：中

### P2　限流指纹来源加固（自托管 XFF 可伪造）✅

**问题**：`lib/privacy.ts:23-30 getClientAddress` 取 `x-forwarded-for` 首段。Vercel 上该头由平台改写安全；但项目支持自托管（`output:'standalone'` + Dockerfile），standalone 直跑或挂在追加式反代后时首段由客户端控制，攻击者轮换伪造 XFF 即可绕过登录/评论/MCP 限流。
**步骤**：改为可信代理感知——新增 `TRUSTED_PROXY_HOPS`（默认 1），从 XFF 列表**右侧**取第 N 个；保留 `x-real-ip` 回退；`.env.example` 注明三种部署形态取值。
**预期效果**：自托管下登录撞库速率从“无限速”回到 5/min 硬上限；Vercel 行为不变。　**工作量**：小

---

## 五、代码质量 / 错误处理与日志 / 可扩展性（quality-ops）

### P1　统一三份漂移的缓存失效逻辑到 `lib/blog/revalidation.ts` ◑

**问题**：失效逻辑有三份拷贝且已漂移：(1) `lib/actions.ts:77-81 revalidatePosts()` 缺 `/rss.xml`、`/sitemap.xml`——后台发文后 RSS/sitemap 最长 1h 不刷新；(2) `actions.ts:232-276` 标签操作各自手写 `revalidatePath`；(3) `migration/import/route.ts:13-29` 逐行复制了 `revalidateAllContent`。
**步骤**：删除本地 `revalidatePosts`，统一改用 `revalidatePostContent / revalidateTagContent / revalidateSettingsContent`；迁移导入复用 `revalidateAllContent`。
**预期效果**：发文后 RSS/sitemap 陈旧窗口 → 0；3 份拷贝收敛为 1 处，净删 ~40 行。　**工作量**：小

### P1　新增 `instrumentation.ts` + 环境变量启动校验（fail-fast）◑

**问题**：无 `instrumentation.ts`，`lib/env.ts` 仅惰性 getter。后果：S3 凭据缺失要到首次上传才报错；`CRON_SECRET` 缺失则 cron 永远静默 401；`IP_HASH_SECRET` 缺失退化为弱盐（见 P0-4）无告警。
**步骤**：新建 `lib/env-check.ts`（复用已有 zod 定义 schema，`superRefine` 表达“二选一”，STORAGE*PROVIDER=s3/r2 时校验 S3*\* 五项）；导出 `validateEnvOrThrow()`（生产失败即 throw，开发 warn）；根目录 `instrumentation.ts` 的 `register()` 在 nodejs 运行时调用。
**预期效果**：配置错误暴露时机从“首个请求 500/静默 401”提前到部署启动期。　**工作量**：中

### P1　结构化 JSON 日志 + `requestId` 贯穿 + `withApiRoute` 统一包装 ◑

**问题**：全仓 ~12 处散落非结构化 `console.*`；`app/api/comments/route.ts:131-133,241-243` 两处 catch **完全吞错零日志**，线上评论 500 无线索；`newRequestId()`（`privacy.ts:38`）定义却零调用；`apiError` 不记日志，响应与日志脱节。
**步骤**：新建 `lib/logger.ts`（单行 JSON：`{level,time,msg,...fields}`，error 自动展开 `name/message/stack`）；`api-response.ts` 加 `withApiRoute(routeName, handler)`（生成/透传 `x-request-id`、计时、catch 兜底 `logger.error` + 500）；迁移各 route 导出，删吞错 catch；散落 `console.*` 替换为 logger；`mcp/route.ts:243` 复用统一 requestId。
**预期效果**：API 未处理异常日志覆盖率 ~40%→100%；每条带 `requestId/route/durationMs`，可按 route/code 聚合告警；用户凭响应头 `x-request-id` 一跳定位。　**技术选型**：轻量自研 JSON logger（Vercel 原生解析单行 JSON）> pino（serverless 无收益且增 cold start）。　**工作量**：中

### P1　健康检查扩展：覆盖存储配置、durable 限流、版本信息 ◑

**问题**：`app/api/health/route.ts:5-18` 只查一项（site_settings）。两类隐性降级不可见：存储 env 缺失（首次上传才炸）、durable 限流静默 fallback 到进程内 Map（多实例下形同虚设，仅一条 warn）；响应无版本/commit。
**步骤**：加 `checks.storage`（纯 env 读取）、`checks.auth`（service key 存在性）；`?deep=1` 时探测 `check_rate_limit` RPC 与 service key 真实性（用 `checkRateLimitForRequest` 限流防刷）；响应补 `version`（`VERCEL_GIT_COMMIT_SHA`）/`region`。
**预期效果**：可监控故障面 1 类→4 类；“限流静默退化”MTTD 从用户报障降到探针周期 ≤5min。　**工作量**：小

### P2　迁移媒体导入改并发下载 + `maxDuration` ◑

**问题**：`lib/migration/import.ts:193-209` `for...of` 串行下载（fetch 单文件超时 15s），路由未设 `maxDuration`；50 张图 ~75s 易触顶函数时长导致 504 + 回滚。
**步骤**：`lib/migration/utils.ts` 加 12 行 `mapWithConcurrency`（worker 池，无依赖）；导入循环改 5 并发，per-item 错误隔离不变；路由 `export const maxDuration=300`；汇总日志接入 logger。
**预期效果**：50 张图 ~75s→~15s（-80%），超时失败率显著下降。　**工作量**：小

### P2　继续拆分 `post-editor.tsx` + 面板隔离 ✅

**问题**：`components/post-editor.tsx` 曾集中草稿、本体编辑、发布、封面、标签、SEO 等职责，维护成本高。
**已完成**：已删除两个 `className="hidden"` 死代码块；已抽 `hooks/use-local-draft.ts`（草稿恢复/3s 防抖保存/clearDraft）；已拆出 `publish/cover/tags/seo` 四个受控面板到 `components/post-editor/`；主文件从 421 行收敛到 284 行编排层。未盲目加 `React.memo`，后续如 profiler 证明侧栏重渲染仍有成本，再按实测补。
**预期效果**：主文件职责收敛；侧栏面板拥有清晰 typed props，后续修改发布/封面/标签/SEO 不再挤在一个 400+ 行组件里；hook 可复用到 settings-form。　**工作量**：中

### P2　限流降级加熔断 + 移除模块级 `setInterval` ✔

**问题**：`lib/rate-limit.ts:74-98` 每次调用都先试 RPC，RPC 持续不可用时每请求白付一次注定失败的往返（+50~300ms）且逐请求刷 warn；`:119-122` 模块级 `setInterval` 在 serverless 几乎不触发，dev 热重载反复注册泄漏。
**已完成**：`durableUnavailableUntil` 时间窗熔断、状态切换级 warn、故障期内直接走内存 fallback 已接入；模块级 `setInterval` 已移除，过期清理改为新建 entry 时内联覆盖。
**预期效果**：故障期公共 API 额外延迟从每请求 +50~300ms 降到每 60s 一次；warn 噪音 -99%+。　**工作量**：小

---

## 六、实施路线图（建议分批）

- **第 1 批（P0，1–2 天）**：P0-1 定时发布 → P0-2 代码高亮热修 → P0-3 错误泄露统一封装 → P0-4 IP 盐。先做不互相阻塞，且 P0-3 的 `apiInternalError`/`requestId` 是后续日志体系（P1）的基石。
- **第 2 批（P1 性能与安全核心）**：generateStaticParams、首页/分页静态化、listByTag/related N+1、proxy 中间件、admin 限流、CSP nonce。
- **第 3 批（P1 质量与可观测性）**：统一失效逻辑、instrumentation+env 校验、结构化日志+withApiRoute、健康检查扩展、错误边界、OG 图、admin loading。
- **第 4 批（P2）**：缓存 tag 细化、管理端搜索下推、view-event 去冗余、迁移并发、post-editor 拆分、限流熔断、XFF 加固、分页 rel、bundle 瘦身。

依赖关系：P0-3 → P1 日志体系；P1“首页/分页静态化”→ P2“分页 rel”；P0-2 正解（Shiki）需先确认 sanitize-html 放行规则。

---

## 七、端到端验证方法

1. **定时发布**：插入一篇 `status='scheduled'`、`published_at` 为过去时间的文章；`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/publish-scheduled` 应返回 `published>=1`，首页与 `/rss.xml` 立即出现该文章。
2. **代码高亮**：生产构建后打开含代码块的文章，DevTools Network 确认 Prism（或 Shiki 无网络请求）正常，Console 无 CSP 违规；代码有高亮、复制按钮可用。
3. **渲染策略**：`pnpm build` 输出中 `/`、`/posts/[slug]`、`/tags/[slug]`、`/page/[n]` 标记为静态/ISR；访问二级页响应头 `x-vercel-cache: HIT`。
4. **错误处理**：制造一次数据异常，确认落到 `error.tsx` 友好页；API 5xx 响应体含 `(ref: <requestId>)` 且与日志 `x-request-id` 一致；评论提交失败有单行 JSON 日志。
5. **安全**：无 cookie `GET /api/admin/comments` 返回 401 JSON；连发 31 次 `/api/admin/upload` 第 31 次 429；无 `IP_HASH_SECRET` 时生产启动报错；浏览器在 `/admin` 注入内联脚本被 CSP 拦截。
6. **N+1**：开 Supabase 日志，访问标签页/文章页确认往返次数下降；编辑文章 A 后访问文章 B 不触发 B 的回源查询。
7. **回归**：每批结束跑 `pnpm typecheck && pnpm lint && pnpm build`，并手动回归后台发文/改标签/上传/迁移与前台浏览/搜索/评论/分享。

---

> 说明：标 **◑** 的条目其证据来自源码核对的探索/设计代理（已附 `file:line`），但本轮的独立二次核验代理因服务限流（429）未跑完；实施每条前请按 `file:line` 快速抽查一遍。标 **✅** 的为本轮已直接读源码确认。
