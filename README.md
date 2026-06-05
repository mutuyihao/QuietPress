# Gugu Blog

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmutuyihao%2Fblog&project-name=gugu-blog&repository-name=gugu-blog&env=ADMIN_EMAIL&envDescription=Enter%20the%20email%20address%20for%20the%20first%20admin%20account.&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%7D%5D)

Vercel one-click deployment creates/connects Supabase through Vercel Marketplace, runs the initial SQL migration during build, and creates the first admin from `ADMIN_EMAIL`. The temporary initial password is `GuguBlog@2026!`; change it at `/admin/account` after the first login.

一个基于 Next.js App Router 和 Supabase 的个人博客系统，包含公开博客、后台管理、图片上传、评论审核、阅读统计、RSS、站点设置和多存储后端。

## 功能

- 公开站点：分页文章列表、文章详情、标签页、关于页、RSS、Sitemap、Robots。
- 内容渲染：Markdown 渲染、HTML 消毒、文章目录、代码块增强、相关文章、分享按钮。
- 后台管理：文章 CRUD、草稿/发布/计划发布/归档、批量发布/归档/删除、标签管理、评论审核、媒体库、存储管理、站点设置。
- 上传与存储：Supabase Storage、AWS S3 兼容服务、Cloudflare R2；上传端会校验文件内容 MIME，当前允许 JPEG、PNG、WebP、GIF。
- 数据与安全：Supabase Auth、RLS、单管理员启动流程、Zod 输入校验、评论服务端消毒、基础限流、安全响应头、Cron 密钥保护。
- 运维准备：GitHub Actions CI、Docker standalone 镜像、`/api/health` 健康检查。

## 技术栈

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4, Radix UI, lucide-react
- Supabase Auth, Postgres, Storage, RLS
- pnpm 10.28.2
- Docker multi-stage standalone build

## 快速开始

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

然后打开 `http://localhost:3000/auth/login`。

首次运行前需要创建 Supabase 项目，并执行 `supabase/migrations/202606020001_initial_release.sql`。详细步骤见 [docs/setup.md](docs/setup.md)。

## 环境变量

最小配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
```

可选配置：

- `STORAGE_PROVIDER`: `supabase`, `s3`, `r2`，默认 `supabase`。
- `DEFAULT_SUPABASE_STORAGE_QUOTA_MB`: Supabase 存储配额展示值，默认 `1024`。
- `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL_BASE`: S3/R2 上传必需。
- `S3_REGION`: 可选，默认 `auto`。
- `CRON_SECRET`: 保护 `/api/cron/publish-scheduled`。

完整说明见 [.env.example](.env.example)。

## 常用命令

```powershell
pnpm dev
pnpm lint
pnpm build
pnpm start
```

Docker:

```powershell
docker build -t gugu-blog .
docker run --env-file .env.local -p 3000:3000 gugu-blog
```

## 文档

- [docs/setup.md](docs/setup.md): 本地开发、Supabase 初始化、首次管理员、部署说明。
- [docs/architecture.md](docs/architecture.md): 架构、路由、数据模型、缓存、安全和已知限制。
- [docs/release-checklist.md](docs/release-checklist.md): 第一次发布到 GitHub 的检查清单。
- [CHANGELOG.md](CHANGELOG.md): 版本记录。
- [SECURITY.md](SECURITY.md): 安全边界和漏洞报告。

历史审计文档保留在 `docs/project-audit.md` 和 `docs/project-plan.md`，当前发布状态以 README、架构文档和发布检查清单为准。

## 发布状态

当前目录尚未初始化 Git 仓库。首次发布前请按 [docs/release-checklist.md](docs/release-checklist.md) 完成 Git 初始化、首个提交、远程仓库创建、CI 验证和许可证决策。

## 许可证

尚未选择开源许可证。公开发布前需要明确许可证；在未添加许可证前，默认保留所有权利。
