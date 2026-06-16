# 设置与部署

本文档描述本地开发、Supabase 初始化、Vercel 一键部署、Docker 和故障排查。所有命令默认在项目根目录运行。

## 前置要求

- Node.js 22+
- pnpm 10.28.2
- 本地或手动部署时需要 Supabase 项目
- 可选：Docker、Supabase CLI

## 本地启动

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

访问 `http://localhost:3000` 查看公开站点，访问 `/auth/login` 登录后台。

## 本地 Supabase 初始化

Vercel Deploy Button 会自动运行 bootstrap。下面步骤只用于本地开发或手动部署。

1. 创建 Supabase 项目。
2. 按 `.env.example` 填写 `.env.local`。
3. 在 Supabase SQL Editor 中按文件名顺序执行 `supabase/migrations/*.sql`。
4. 在 Supabase Auth 中创建自己的管理员邮箱/密码用户，或者使用第一个 Auth 用户登录后通过 `claim_first_admin` 认领管理员。
5. 首次登录成功后，确认 `public.admin_profiles` 中只有一个管理员。

如果使用 Supabase CLI：

```powershell
supabase db push
```

## 必需环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_LOCALE=zh-CN
ADMIN_EMAIL=admin@example.com
```

`NEXT_PUBLIC_SITE_URL` 用于 RSS、Sitemap、JSON-LD、canonical URL 等绝对链接生成。本地默认可以使用 `http://localhost:3000`，生产环境应改成正式域名。
`NEXT_PUBLIC_LOCALE` 用于页面 lang、RSS language 和日期格式；默认 `zh-CN`。

QuietPress 同时兼容 Supabase 新旧 key 命名：

- 浏览器公开 key：`NEXT_PUBLIC_SUPABASE_ANON_KEY` 或 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- 服务端 secret key：`SUPABASE_SERVICE_ROLE_KEY` 或 `SUPABASE_SECRET_KEY`。AI/MCP、OAuth、DCR、审计和 Vercel bootstrap 都需要它。
- Vercel bootstrap 数据库连接：`POSTGRES_URL_NON_POOLING`。通常由 Vercel Supabase Marketplace 自动注入。
- 隐私哈希盐：生产建议设置 `IP_HASH_SECRET`，用于评论 IP、限流指纹和审计 IP/UA 哈希。修改该值会让历史哈希和限流桶无法再与新请求匹配。

## 存储配置

默认上传到 Supabase Storage 的 `blog-images` bucket。初始 migration 会创建 bucket 和对应 Storage policy。

可选值：

- `STORAGE_PROVIDER=supabase`
- `STORAGE_PROVIDER=s3`
- `STORAGE_PROVIDER=r2`

S3/R2 必需：

```env
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=your-bucket-name
S3_PUBLIC_URL_BASE=https://cdn.example.com
```

可选：

```env
S3_REGION=auto
```

`S3_REGION=auto` 适合 Cloudflare R2；AWS S3 建议使用实际区域，例如 `us-east-1`。

## Cron 配置

计划发布接口：

```text
GET /api/cron/publish-scheduled
Authorization: Bearer <CRON_SECRET>
```

生产环境如果启用计划发布，需要设置：

```env
CRON_SECRET=your-cron-secret
```

## Vercel 部署

### 一键部署路径

1. 点击 README 里的 "Deploy with Vercel" 按钮。
2. 让 Vercel 创建或连接 Supabase Marketplace resource。
3. 在 Vercel 表单里只填写 `ADMIN_EMAIL`。
4. Vercel build 会在 `next build` 前运行 `pnpm bootstrap:vercel`。
5. bootstrap 会按文件名顺序自动执行 `supabase/migrations/*.sql`，并在 `public.quietpress_migrations` 中记录已执行文件，后续构建会跳过相同 checksum 的 migration。
6. bootstrap 会用 `ADMIN_EMAIL` 创建第一个管理员账号。
7. 访问 `/auth/login`，使用 `ADMIN_EMAIL` 和临时密码 `QuietPress@2026!` 登录。
8. 登录后到 `/admin/account` 修改临时密码。
9. 访问 `/api/health`，确认返回 `healthy`。

只有在特定部署需要临时绕过 migration/admin bootstrap 时，才设置 `SKIP_SUPABASE_BOOTSTRAP=1`。新项目首次部署不要开启它。

### 手动导入 Vercel

如果不使用 Deploy Button：

1. 推送仓库到 GitHub。
2. 在 Vercel 导入仓库。
3. 创建或连接 Supabase 项目。
4. 按 `.env.example` 配置生产环境变量。
5. 确认 Supabase Auth redirect URL 包含生产域名。
6. 部署后访问 `/api/health`。

### 跟随源仓库更新

Vercel Deploy Button 会把 QuietPress 的 canonical 仓库克隆/复制到部署者自己的 GitHub/GitLab/Bitbucket 账号，然后 Vercel Project 连接的是这个新仓库。它不是 upstream 跟踪关系，所以 canonical 仓库更新时，复制出来的仓库不会自动收到 commit，也不会自动触发 Vercel rebuild。

需要接收 QuietPress 后续更新时，需要在部署者自己的仓库中手动合并新版代码，或重新部署新版模板并迁移内容。项目不再内置自动同步机制，避免一键部署用户误以为源仓库更新会自动合并到自己的仓库。

## Docker

```powershell
docker build -t quietpress .
docker run --env-file .env.local -p 3000:3000 quietpress
```

Dockerfile 使用 Next.js standalone 输出，容器内置 `/api/health` healthcheck。

## 首次管理员故障排查

确认 bootstrap RPC 存在：

```sql
select proname
from pg_proc
where proname = 'claim_first_admin';
```

确认是否已有管理员：

```sql
select user_id, email, role, created_at
from public.admin_profiles;
```

如果手动认领失败，可以绑定已有 Supabase Auth 用户：

```sql
insert into public.admin_profiles (user_id, email, role)
select id, email, 'admin'
from auth.users
where email = 'your-admin@example.com'
on conflict (user_id) do update
set email = excluded.email,
    role = 'admin';
```
