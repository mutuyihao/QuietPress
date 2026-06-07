# 发布检查清单

本文档用于 QuietPress 发布到 GitHub、Vercel Template 或生产环境前的最终检查。

## 代码门禁

- [ ] `.env` 和 `.env.local` 不会提交。
- [ ] `.env.example` 覆盖所有需要公开说明的变量。
- [ ] `pnpm lint` 通过。
- [ ] `pnpm build` 通过。
- [ ] `/api/health` 在目标环境返回 `healthy`。
- [ ] Vercel 一键部署 bootstrap 成功，或手动 Supabase migration 已执行。
- [ ] 第一个管理员可以登录 `/admin`。
- [ ] Vercel bootstrap 创建的临时密码已在 `/admin/account` 修改。
- [ ] 上传图片、发布文章、评论审核、站点设置保存均通过手动 smoke test。

## GitHub 仓库

- [ ] 仓库名和描述使用 `QuietPress`。
- [ ] README Deploy Button 使用正确的 canonical `repository-url`。
- [ ] README 明确 Deploy Button 是快照式复制；可持续更新路径应引导用户 fork/import，并启用 `sync-upstream` workflow。
- [ ] 默认分支为 `main`。
- [ ] 启用 branch protection，要求 CI 通过后合并。
- [ ] 启用 Dependabot 或至少定期检查依赖更新。
- [ ] 仓库公开/私有状态符合预期。
- [ ] 公开发布前完成许可证决策。

## CI 检查

当前 workflow 位于 `.github/workflows/ci.yml`：

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm build`

CI 使用占位 Supabase 环境变量。如果后续构建阶段需要真实 Supabase 数据，请在 GitHub Actions repository secrets 中配置真实值，并在 workflow 中引用。

## 部署环境变量

生产环境至少需要：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
ADMIN_EMAIL=
```

Vercel Supabase Marketplace 也可能使用新版变量名：

```env
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
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
- 图片上传支持 Supabase Storage、S3 兼容服务和 Cloudflare R2。
- Vercel 一键部署可以自动初始化 Supabase 和第一个管理员账号。
- 包含 Docker 和 GitHub Actions CI。

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
