# QuietPress

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmutuyihao%2Fblog&project-name=quietpress&repository-name=quietpress&env=ADMIN_EMAIL&envDescription=Enter%20the%20email%20address%20for%20the%20first%20admin%20account.&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%7D%5D) 点击左侧 `Deploy` 按钮，即可在 Vercel 一键部署 QuietPress。

QuietPress 是一个基于 Next.js App Router 和 Supabase 的个人博客 CMS 模板，支持 Vercel 一键部署。它包含公开博客、后台管理、Markdown 写作、图片上传、评论审核、阅读统计、RSS、Sitemap、站点设置和多存储后端。

Vercel Deploy Button 会通过 Vercel Marketplace 创建或连接 Supabase，并在构建阶段按文件名顺序自动执行 `supabase/migrations/*.sql`、记录已执行 migration、创建第一个管理员账号。部署时只需要填写 `ADMIN_EMAIL`。初始临时密码为 `QuietPress@2026!`，首次登录后请到 `/admin/account` 修改。

English summary: QuietPress is a one-click deployable personal blog CMS built with Next.js and Supabase.

## 功能

- 公开站点：分页文章列表、文章详情、标签页、关于页、RSS、Sitemap、Robots。
- 内容渲染：Markdown 渲染、HTML 消毒、文章目录、代码块增强、相关文章、分享按钮。
- 后台管理：文章 CRUD、草稿/发布/归档、批量发布/归档/删除、标签管理、评论审核、媒体库、存储管理、站点设置。
- 迁移工具：导出/导入 QuietPress v1 迁移包，支持文章、标签、站点设置和媒体 URL 重拉。
- AI 操作：内置 Remote MCP 服务，支持 OAuth PKCE、Dynamic Client Registration、scope 授权、审计和撤销。
- 上传与存储：默认使用 Supabase Storage，也支持 S3 兼容服务和 Cloudflare R2。
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

打开 `http://localhost:3000` 查看公开站点，访问 `/auth/login` 登录后台。

本地开发仍需要准备 Supabase 项目并执行数据库初始化。Vercel 一键部署会自动执行 bootstrap；手动本地流程见 [docs/setup.md](docs/setup.md)。

## 环境变量

最小本地配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` 可用 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 替代；`SUPABASE_SERVICE_ROLE_KEY` 可用 `SUPABASE_SECRET_KEY` 替代。QuietPress 同时兼容新旧 Supabase key 命名。

可选配置：

- `STORAGE_PROVIDER`: `supabase`, `s3`, `r2`，默认 `supabase`。
- `DEFAULT_SUPABASE_STORAGE_QUOTA_MB`: Supabase 存储配额展示值，默认 `1024`。
- `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL_BASE`: S3/R2 上传必需。
- `S3_REGION`: 可选，默认 `auto`。
- `CRON_SECRET`: 保护 `/api/cron/publish-scheduled`。
- `POSTGRES_URL_NON_POOLING`: Vercel bootstrap 执行数据库迁移必需，通常由 Vercel Supabase Marketplace 自动注入。
- `SKIP_SUPABASE_BOOTSTRAP=1`: 临时跳过 Vercel 构建期迁移和管理员初始化，仅用于排障。

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
docker build -t quietpress .
docker run --env-file .env.local -p 3000:3000 quietpress
```

## 文档

- [docs/setup.md](docs/setup.md): 本地开发、Supabase 初始化、Vercel 一键部署、Docker 和故障排查。
- [docs/ai-mcp-access.md](docs/ai-mcp-access.md): AI/MCP 操作博客的功能说明、OAuth 接入、客户端配置和安全指南。
- [docs/architecture.md](docs/architecture.md): 架构、路由、数据模型、缓存、安全边界、部署模型和已知限制。
- [docs/release-checklist.md](docs/release-checklist.md): 发布门禁和部署后 smoke test。
- [CHANGELOG.md](CHANGELOG.md): 版本记录。
- [SECURITY.md](SECURITY.md): 安全边界和漏洞报告。

历史审计文档保留在 `docs/project-audit.md` 和 `docs/project-plan.md`，当前状态以 README、setup、architecture 和 release checklist 为准。

## 模板说明

Deploy Button 的 `repository-url` 必须写死 canonical 仓库地址，Vercel 不会自动识别用户当前 fork。如果仓库迁移或改名，需要同步更新按钮 URL。

Deploy Button 是快照式一键部署：Vercel 会把 canonical 仓库克隆/复制到部署者自己的 Git 账号，再把 Vercel Project 连接到这个新仓库。这个新仓库不会天然跟随 `mutuyihao/blog` 的后续更新；只有部署者仓库本身产生新 commit 时，Vercel 才会自动重新构建。

如果希望部署后继续获取源仓库更新，需要在自己的仓库里手动合并或重新部署新版模板。QuietPress 不再提供自动同步机制，避免给一键部署用户造成“会自动更新”的误解。

QuietPress 当前有意保持单管理员模式，不包含多作者、多管理员、角色权限、邀请机制、邮件订阅发送、修订历史 diff/restore。

## 许可证

尚未选择开源许可证。公开发布前需要明确许可证；在未添加许可证前，默认保留所有权利。
