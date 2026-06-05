# Setup

本文档描述本地开发、Supabase 初始化、首次管理员和部署准备。所有命令默认在项目根目录运行。

## 前置要求

- Node.js 22+
- pnpm 10.28.2
- Supabase 项目
- 可选：Docker、Supabase CLI

## 本地启动

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

访问 `http://localhost:3000` 查看公开站点，访问 `/auth/login` 登录后台。

## Supabase 初始化

1. 创建 Supabase 项目。
2. 在 Supabase Auth 中创建自己的管理员邮箱/密码用户。
3. 在 Supabase SQL Editor 中执行 `supabase/migrations/202606020001_initial_release.sql`。
4. 确认 `public.admin_profiles` 初始为空。
5. 使用该管理员邮箱登录 `/auth/login`，系统会在首次登录时通过 `claim_first_admin` RPC 认领第一个管理员。

如果使用 Supabase CLI：

```powershell
supabase db push
```

## 必需环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
```

`NEXT_PUBLIC_SITE_URL` 用于 RSS、Sitemap、JSON-LD、canonical URL 等绝对链接生成。本地默认可以使用 `http://localhost:3000`，生产环境应改成站点正式域名。

## 存储配置

默认上传到 Supabase Storage 的 `blog-images` bucket。该 bucket 由 `202606020001_initial_release.sql` 创建。

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

`S3_REGION` 默认是 `auto`，适合 Cloudflare R2；AWS S3 建议使用实际区域，例如 `us-east-1`。

## Cron 配置

计划发布接口：

```text
GET /api/cron/publish-scheduled
Authorization: Bearer <CRON_SECRET>
```

生产环境需要设置：

```env
CRON_SECRET=your-cron-secret
```

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

如果自动认领失败，可以手动绑定自己的 Supabase Auth 用户：

```sql
insert into public.admin_profiles (user_id, email, role)
select id, email, 'admin'
from auth.users
where email = 'your-admin@example.com'
on conflict (user_id) do update
set email = excluded.email,
    role = 'admin';
```

## 部署

### Vercel

One-click path:

1. Click the README "Deploy with Vercel" button.
2. Let Vercel create/connect the Supabase Marketplace resource.
3. Fill only `ADMIN_EMAIL` in the Vercel form.
4. Vercel build runs `pnpm bootstrap:vercel` before `next build`, applying `supabase/migrations/202606020001_initial_release.sql` automatically.
5. Sign in at `/auth/login` with `ADMIN_EMAIL` and the temporary password `GuguBlog@2026!`.
6. Change the temporary password at `/admin/account`.

Set `SKIP_SUPABASE_BOOTSTRAP=1` only when you need to bypass build-time migration/admin bootstrap for a specific deployment.

1. 推送仓库到 GitHub。
2. 在 Vercel 导入仓库。
3. 配置 `.env.example` 中需要的生产环境变量。
4. 确认 Supabase Auth redirect URL 包含生产域名。
5. 部署后访问 `/api/health`，确认返回 `healthy`。

### Docker

```powershell
docker build -t gugu-blog .
docker run --env-file .env.local -p 3000:3000 gugu-blog
```

Dockerfile 使用 Next.js standalone 输出，容器内置 `/api/health` 健康检查。
