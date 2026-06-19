# 发布检查清单

本文档用于 QuietPress 发布到 GitHub、Vercel Template 或生产环境前的最终检查。

## 代码门禁

- [ ] `.env` 和 `.env.local` 不会提交。
- [ ] `.env.example` 覆盖所有需要公开说明的变量。
- [ ] `pnpm format:check` 通过。
- [ ] `pnpm lint` 通过。
- [ ] `pnpm typecheck` 通过。
- [ ] `pnpm test:run` 通过。
- [ ] `pnpm test:release` 通过。
- [ ] 本地 `$env:SKIP_SUPABASE_BOOTSTRAP='1'; pnpm build` 通过。
- [ ] 构建输出没有动态字体加载超时或远程字体获取失败。
- [ ] `/api/health` 在目标环境返回 `healthy`。
- [ ] Vercel 一键部署 bootstrap 成功，或手动 Supabase migration 已执行。
- [ ] 如果启用 AI/MCP，确认 `/admin/ai-access` 可打开，`/.well-known/oauth-authorization-server` 包含 `registration_endpoint`。
- [ ] 第一个管理员可以登录 `/admin`。
- [ ] Vercel bootstrap 创建的临时密码已在 `/admin/account` 修改。
- [ ] 上传图片、发布文章、评论审核、站点设置保存均通过手动 smoke test。

## GitHub 仓库

- [ ] 仓库名和描述使用 `QuietPress`。
- [ ] README Deploy Button 使用正确的 canonical `repository-url`。
- [ ] README 明确 Deploy Button 是快照式复制，不会自动跟随 canonical 仓库更新。
- [ ] 默认分支为 `main`。
- [ ] 启用 branch protection，要求 CI 通过后合并。
- [ ] Dependabot 已启用，并覆盖 npm 依赖和 GitHub Actions。
- [ ] `Dependency Audit` workflow 可手动触发，且最近一次 `pnpm audit --audit-level high` 无未处理高危漏洞。
- [ ] 仓库公开/私有状态符合预期。
- [ ] 公开发布前完成许可证决策；未添加许可证前不得对外宣称开源授权。

## CI 检查

当前 workflow 位于 `.github/workflows/ci.yml`：

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:run`
- `pnpm test:release`
- `SKIP_SUPABASE_BOOTSTRAP=1 pnpm build`
- `pnpm audit --audit-level high`（位于单独的 `Dependency Audit` workflow）

CI 使用占位 Supabase 环境变量，并显式设置 `SKIP_SUPABASE_BOOTSTRAP=1`，避免 pull request 或普通 push 构建触碰真实 Supabase。生产运行期会通过 `instrumentation.ts` 校验服务端 secret、`IP_HASH_SECRET`、`CRON_SECRET` 和存储 provider 配置；如果后续构建阶段需要真实 Supabase 数据，请在 GitHub Actions repository secrets 中配置真实值，并在 workflow 中引用。

## 部署环境变量

生产环境至少需要：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_LOCALE=
IP_HASH_SECRET=
```

Supabase public key 二选一：

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

服务端 Supabase secret 二选一。AI/MCP、OAuth、DCR、审计和 Vercel bootstrap 需要：

```env
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
```

Vercel bootstrap 需要，通常由 Vercel Supabase Marketplace 自动注入：

```env
ADMIN_EMAIL=
POSTGRES_URL_NON_POOLING=
```

如果启用计划发布：

```env
CRON_SECRET=
```

如果使用 S3/R2：

```env
STORAGE_PROVIDER=
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_PUBLIC_URL_BASE=
S3_REGION=
```

## 首发版本建议

建议首发版本：`v0.1.0`

发布说明重点：

- QuietPress 是 Next.js + Supabase 个人博客 CMS 模板。
- 包含公开文章、标签、关于页、RSS、Sitemap 和后台管理。
- 后台支持文章、标签、评论、媒体、存储设置和站点设置。
- 后台支持迁移包导入/导出和 AI/MCP 授权管理。
- Remote MCP 支持 OAuth PKCE、Dynamic Client Registration、scope 授权、审计和撤销。
- 图片上传支持 Supabase Storage、S3 兼容服务和 Cloudflare R2。
- Vercel 一键部署可以自动初始化 Supabase 和第一个管理员账号。
- 包含 Docker 和 GitHub Actions CI。
- 包含 Vitest 单元测试门禁，覆盖发布关键纯逻辑和安全边界。

不应声称：

- 支持多管理员、角色权限、邀请或多作者管理。
- 有完整自动化测试覆盖。
- 限流适合多实例生产强一致防护。
- 邮件订阅通知已经可用。
- 修订历史支持 diff/restore。

## 发布后 smoke test

- [ ] 首页可访问。
- [ ] 文章详情页可访问。
- [ ] `/rss.xml` 可访问。
- [ ] `/sitemap.xml` 可访问。
- [ ] `/auth/login` 可登录。
- [ ] `/admin` 可访问。
- [ ] 新建草稿成功。
- [ ] 发布文章后首页出现。
- [ ] 上传图片成功。
- [ ] 评论提交进入 `pending`。
- [ ] 后台可以审核评论。
- [ ] `/api/health` 返回 `healthy`。
- [ ] 如果启用 AI/MCP，未登录访问 `/api/mcp` 返回 `401` 和 `WWW-Authenticate`。
- [ ] 如果启用 AI/MCP，DCR 注册后后台 OAuth Clients 出现 dynamic client。
- [ ] 如果启用 AI/MCP，使用 MCP 客户端完成读取文章或创建草稿的 smoke test。
