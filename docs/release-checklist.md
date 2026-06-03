# GitHub First Release Checklist

本文档用于第一次发布到 GitHub 前的最终检查。当前项目目录尚未初始化 Git 仓库。

## 发布前代码检查

- [ ] `.env` 和 `.env.local` 不会提交。
- [ ] `.env.example` 覆盖所有需要公开说明的变量。
- [ ] `pnpm lint` 通过。
- [ ] `pnpm build` 通过。
- [ ] `/api/health` 在本地或部署环境返回 `healthy`。
- [ ] `supabase/migrations/202606020001_initial_release.sql` 已在目标 Supabase 项目执行。
- [ ] 第一个管理员可以登录 `/admin`。
- [ ] 上传图片、发布文章、评论审核、站点设置保存均通过手动 smoke test。

## 仓库初始化

```powershell
git init
git branch -M main
git status --short
```

首次提交建议：

```powershell
git add .
git commit -m "Initial release"
```

创建 GitHub 仓库后：

```powershell
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

## GitHub 仓库设置

- [ ] 仓库名、描述和 README 正确。
- [ ] 默认分支为 `main`。
- [ ] 启用 branch protection，要求 CI 通过后合并。
- [ ] 启用 Dependabot 或至少定期检查依赖更新。
- [ ] 确认是否公开仓库。
- [ ] 选择并添加许可证；未选择许可证前默认保留所有权利。

## CI 检查

当前 workflow 位于 `.github/workflows/ci.yml`：

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm build`

CI 使用占位 Supabase 环境变量。如果构建阶段需要真实 Supabase 数据，请在 GitHub Actions repository secrets 中配置真实值，并在 workflow 中引用。

## 部署环境变量

生产环境至少需要：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
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

- Next.js + Supabase 个人博客。
- 公开文章、标签、关于页、RSS、Sitemap。
- 后台文章、标签、评论、媒体、存储、站点设置。
- 图片上传支持 Supabase/S3/R2。
- Docker 和 GitHub Actions CI。

## 不应在首发中声称的内容

- 不要声称支持多管理员或角色权限。
- 不要声称有完整测试覆盖。
- 不要声称限流适合多实例生产强一致防护。
- 不要声称邮件订阅已完成邮件发送、双重确认或退订流程。
- 不要声称修订历史支持 diff/restore。

## 发布后 smoke test

- [ ] 首页可访问。
- [ ] 文章详情可访问。
- [ ] `/rss.xml` 可访问。
- [ ] `/sitemap.xml` 可访问。
- [ ] `/auth/login` 可登录。
- [ ] `/admin` 可访问。
- [ ] 新建草稿成功。
- [ ] 发布文章后首页出现。
- [ ] 上传图片成功。
- [ ] 评论提交进入 pending。
- [ ] 后台审核评论成功。
- [ ] `/api/health` 返回 `healthy`。
