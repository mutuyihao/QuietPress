# Project Audit

> Archive note: this document keeps historical audit context. Some open findings have since been fixed in code. Use `README.md`, `docs/setup.md`, `docs/architecture.md`, and `docs/release-checklist.md` as the current release source of truth.

Last reviewed: 2026-06-11 (Session 5)

## Product Constraint

- Admin scope is intentionally single-admin. There is no near-term requirement for multiple admin accounts, roles, permissions, invitations, or admin user management.

## Fifth Session Findings (2026-06-11)

Comprehensive optimization & upgrade assessment across 6 dimensions: Code Quality, Performance, Security, UX/Accessibility, Maintainability, Scalability. 29 findings total — 10 previously tracked items status-updated, 19 new issues identified (AUD-104 ~ AUD-122).

### Previously Tracked — Now Fixed (confirmed in code)

| ID      | Severity | Status    | Area           | Finding                                                                            |
| ------- | -------- | --------- | -------------- | ---------------------------------------------------------------------------------- |
| AUD-051 | Critical | **Fixed** | Security       | SQL injection in search API — now uses `search_posts` RPC with parameterized query |
| AUD-052 | Critical | **Fixed** | Security       | Comment XSS — `sanitize-html` with empty allowlist now applied server-side         |
| AUD-053 | High     | **Fixed** | Performance    | Image optimization disabled — `remotePatterns` configured, `unoptimized` removed   |
| AUD-054 | High     | **Fixed** | Performance    | N+1 query in attachTags — nested select `post_tags(tags(*))` now used              |
| AUD-056 | High     | **Fixed** | Performance/UX | No pagination — `PaginatedResult` with `page`/`pageSize` implemented               |
| AUD-057 | High     | **Fixed** | Performance    | getSiteSettings duplicate calls — `React.cache()` dedup applied                    |
| AUD-059 | High     | **Fixed** | DevOps         | Docker standalone output — `output: 'standalone'` configured                       |
| AUD-066 | Medium   | **Fixed** | Feature        | No rich text editor — MDXEditor (`@mdxeditor/editor`) integrated                   |
| AUD-067 | Medium   | **Fixed** | Feature        | No media library — media-library + media-picker-dialog components exist            |
| AUD-079 | Medium   | **Fixed** | DevOps         | No Docker HEALTHCHECK — health check configured in Dockerfile                      |

### Previously Tracked — Still Open (confirmed in code)

| ID      | Severity | Status    | Area           | Finding                                                                                                                                     |
| ------- | -------- | --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-055 | High     | **Fixed** | Performance    | Markdown cache now uses bounded entries plus TTL expiry.                                                                                    |
| AUD-061 | High     | **Fixed** | Code Quality   | Custom API routes now use `{ ok, data/error }` response helpers; OAuth/MCP keep protocol-required JSON shapes.                              |
| AUD-062 | High     | **Fixed** | Code Quality   | Server Actions now return structured `ActionResult` and catch repository/auth errors.                                                       |
| AUD-068 | Medium   | **Fixed** | Security/Scale | Rate limiter now uses Supabase `rate_limits` RPC with in-memory fallback; identifiers are hashed.                                           |
| AUD-072 | Medium   | **Fixed** | Security       | CSP + security headers — fully configured in `next.config.mjs`                                                                              |
| AUD-077 | Medium   | **Fixed** | Code Quality   | Supabase storage provider is no longer cached with request-bound clients; S3/R2 cache remains env-only.                                     |
| AUD-078 | Medium   | Deferred  | Code Quality   | No test framework — intentionally deferred in this repair pass per scope.                                                                   |
| AUD-094 | High     | **Fixed** | Code Quality   | Global lint disables removed; remaining `<img>` cases have local documented exceptions.                                                     |
| AUD-074 | Medium   | **Fixed** | Security       | Admin content/settings/storage/password/comment/media/migration actions now write audit logs.                                               |
| AUD-103 | Low      | **Fixed** | UX/A11y        | Search dialog combobox/listbox semantics, 404 recovery links, tab state ARIA, toggle/collapse ARIA, and explicit native button types added. |

### New Findings (AUD-104 ~ AUD-122)

#### Critical

None.

#### High

| ID      | Severity | Status    | Area            | Finding                                                                                                                                        |
| ------- | -------- | --------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-104 | High     | **Fixed** | Code Quality    | Shared post/tag/settings Zod field schemas now live in `lib/validation.ts` and are reused by MCP tools.                                        |
| AUD-105 | High     | **Fixed** | Performance     | Slug dedup now queries only matching slug prefixes instead of loading all posts.                                                               |
| AUD-106 | High     | **Fixed** | Security        | Admin password policy now requires 12+ chars with lower/upper/number/symbol.                                                                   |
| AUD-107 | High     | **Fixed** | Security        | Comment IP values are hashed with a private salt; migration backfills legacy plaintext values.                                                 |
| AUD-108 | High     | **Fixed** | Maintainability | Media upload and cache revalidation logic split into `lib/blog/media-service.ts` and `lib/blog/revalidation.ts`; public service API preserved. |
| AUD-109 | High     | **Fixed** | Scalability     | Admin post listing now uses paginated repository queries and admin pagination UI.                                                              |

#### Medium

| ID      | Severity | Status    | Area            | Finding                                                                                                                                  |
| ------- | -------- | --------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-110 | Medium   | **Fixed** | Code Quality    | Repository row/update payloads now use local typed shapes; remaining `Record<string, unknown>` is limited to dynamic MCP JSON summaries. |
| AUD-111 | Medium   | **Fixed** | Code Quality    | Locale now comes from `NEXT_PUBLIC_LOCALE` via shared date/locale helper.                                                                |
| AUD-112 | Medium   | **Fixed** | Performance     | Sitemap now paginates through all published posts instead of hard-capping at 1000.                                                       |
| AUD-113 | Medium   | **Fixed** | Performance     | Public comments now load through a PostgreSQL recursive JSON RPC with JS fallback for missing migrations.                                |
| AUD-114 | Medium   | **Fixed** | Security        | Unsafe custom API methods now validate same-origin `Origin`/`Referer`; protocol endpoints remain protocol-compatible.                    |
| AUD-115 | Medium   | **Fixed** | UX              | Admin batch publish/archive/delete now uses `useOptimistic` with refresh on failure.                                                     |
| AUD-116 | Medium   | **Fixed** | Maintainability | CI now runs `format:check`, `lint`, `typecheck`, and `build`; test framework remains deferred under AUD-078.                             |
| AUD-117 | Medium   | **Fixed** | Maintainability | Prettier added with `format`/`format:check`; CI enforces `format:check`.                                                                 |
| AUD-118 | Medium   | **Fixed** | Maintainability | Unused duplicate `styles/globals.css` entry point removed.                                                                               |

#### Low

| ID      | Severity | Status    | Area         | Finding                                                                                                                                      |
| ------- | -------- | --------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-119 | Low      | **Fixed** | Code Quality | TypeScript target updated to ES2022.                                                                                                         |
| AUD-120 | Low      | **Fixed** | Scalability  | Single-item blog service operations now revalidate post/tag/comment/settings paths separately; full-site import remains intentionally broad. |
| AUD-121 | Low      | **Fixed** | Scalability  | Server-side image processing now resizes/compresses images to WebP for uploads and migration imports.                                        |
| AUD-122 | Low      | **Fixed** | Scalability  | Security/performance migration adds rate-limit, audit, post/comment/view/media indexes and admin summary RPC.                                |

### Session 5 Summary

| Severity  | Open After Repair Pass | Notes                                               |
| --------- | ---------------------- | --------------------------------------------------- |
| Critical  | 0                      | -                                                   |
| High      | 0                      | -                                                   |
| Medium    | 1                      | Deferred test framework                             |
| Low       | 0                      | -                                                   |
| **Total** | **1**                  | Test framework intentionally not added in this pass |

Detailed issue tracking and fix plan: [project-plan.md](./project-plan.md)

## Fourth Session Findings (2026-06-01)

Comprehensive project audit conducted across 6 dimensions: Performance, UX, Code Quality, Security, Feature Completeness, and Scalability. 40 new issues identified (AUD-051 ~ AUD-090).

### Critical

| ID      | Severity | Status | Area     | Finding                                                                                     |
| ------- | -------- | ------ | -------- | ------------------------------------------------------------------------------------------- |
| AUD-051 | Critical | Open   | Security | SQL injection in search API — user input directly interpolated into Supabase `.or()` filter |
| AUD-052 | Critical | Open   | Security | Comment content XSS — no server-side HTML sanitization on comment input                     |

### High

| ID      | Severity | Status | Area                 | Finding                                                                                                           |
| ------- | -------- | ------ | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| AUD-053 | High     | Open   | Performance          | Next.js Image optimization disabled (`images.unoptimized: true`); no WebP/AVIF, no responsive srcset              |
| AUD-054 | High     | Open   | Performance          | N+1 query pattern in `attachTags()` — 3 queries per post list load instead of Supabase nested select              |
| AUD-055 | High     | Open   | Performance          | Markdown rendering (`marked` + `sanitize-html`) runs on every SSR request with no cache                           |
| AUD-056 | High     | Open   | Performance/UX/Scale | No pagination — `getPublishedPosts()` fetches all posts without LIMIT                                             |
| AUD-057 | High     | Open   | Performance          | `getSiteSettings()` called 2-3 times per request (RootLayout + PublicLayout + page)                               |
| AUD-058 | High     | Open   | Performance/UX       | Search API no debounce — fetch on every keystroke                                                                 |
| AUD-059 | High     | Open   | DevOps               | Docker standalone output not configured — Dockerfile copies `.next/standalone` but `output: 'standalone'` missing |
| AUD-060 | High     | Open   | Code Quality         | Repository layer uses `any` types — no Supabase type generation                                                   |
| AUD-061 | High     | Open   | Code Quality         | Inconsistent API error handling — mixed `try/catch`, varying response shapes                                      |
| AUD-062 | High     | Open   | Code Quality         | Server Actions throw `Error` instead of returning structured results                                              |
| AUD-063 | High     | Open   | Code Quality         | `updatePostSchema = createPostSchema` — update requires all fields, prevents partial updates                      |
| AUD-064 | High     | Open   | UX                   | Search lacks keyword highlighting, history, empty-state suggestions, ⌘K hint                                      |
| AUD-065 | High     | Open   | UX                   | No mobile navigation menu — header links overflow on small screens                                                |

### Medium

| ID      | Severity | Status | Area                | Finding                                                                             |
| ------- | -------- | ------ | ------------------- | ----------------------------------------------------------------------------------- |
| AUD-066 | Medium   | Open   | Feature/Admin       | No rich text editor — plain textarea only                                           |
| AUD-067 | Medium   | Open   | Feature/Admin       | No media library management page                                                    |
| AUD-068 | Medium   | Open   | Security/Scale      | Rate limiter uses in-memory Map — fails in multi-instance, no max size              |
| AUD-069 | Medium   | Open   | Feature/UX          | Comment section missing Markdown, likes, admin reply, email notifications           |
| AUD-070 | Medium   | Open   | Security/Feature    | Newsletter UI is hidden; retained API still has no email verification if re-enabled |
| AUD-071 | Medium   | Open   | Security/Data       | View counter can be inflated — only sessionStorage dedup                            |
| AUD-072 | Medium   | Open   | Security            | No CSP or security headers configured                                               |
| AUD-073 | Medium   | Open   | Scalability         | No database index strategy documented or verified                                   |
| AUD-074 | Medium   | Open   | Security/Compliance | No audit logging for admin actions                                                  |
| AUD-075 | Medium   | Open   | Feature/Admin       | Scheduled publishing has no editor UI (date/time picker)                            |
| AUD-076 | Medium   | Open   | Code Quality        | Post URL generation not centralized — duplicated across 6+ files                    |
| AUD-077 | Medium   | Open   | Security/Code       | Storage provider caches request-bound Supabase client globally                      |
| AUD-078 | Medium   | Open   | Code Quality        | No test framework configured                                                        |
| AUD-079 | Medium   | Open   | DevOps              | No Docker HEALTHCHECK probe configured                                              |
| AUD-080 | Medium   | Open   | UX                  | Tag pages missing post count                                                        |

### Low

| ID      | Severity | Status | Area          | Finding                                                                 |
| ------- | -------- | ------ | ------------- | ----------------------------------------------------------------------- |
| AUD-081 | Low      | Open   | UX            | No breadcrumb navigation on post pages                                  |
| AUD-082 | Low      | Open   | UX            | Dark mode toggle has no transition animation                            |
| AUD-083 | Low      | Open   | UX            | 404 page missing search suggestions                                     |
| AUD-084 | Low      | Open   | UX/A11y       | No font size adjustment for reading                                     |
| AUD-085 | Low      | Open   | UX            | No image lightbox for post images                                       |
| AUD-086 | Low      | Open   | Feature       | No article bookmark/favorite feature                                    |
| AUD-087 | Low      | Open   | Feature       | No article import/export                                                |
| AUD-088 | Low      | Open   | Feature/Admin | No Open Graph preview in editor                                         |
| AUD-089 | Low      | Open   | Feature/Admin | No newsletter analytics dashboard; newsletter entry is currently hidden |
| AUD-090 | Low      | Open   | Feature/Admin | Revision history no diff or restore                                     |

### Session 4 Summary

| Severity  | Count  |
| --------- | ------ |
| Critical  | 2      |
| High      | 13     |
| Medium    | 15     |
| Low       | 10     |
| **Total** | **40** |

Detailed issue tracking: [issue-tracker.md](./issue-tracker.md)
Fix plan and milestones: [fix-plan.md](./fix-plan.md)

## Third Session Resolved (2026-06-01)

| ID      | Severity | Status       | Area    | Finding                                                                                                                                                                                          |
| ------- | -------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AUD-020 | Medium   | **Fixed**    | Admin   | Image upload via `/api/admin/upload` — drag-and-drop + click-to-upload in post editor. Cover image and inline Markdown image insertion. Supabase Storage bucket `blog-images` migration created. |
| AUD-029 | Low      | **Fixed**    | Feature | Article revision history — `post_revisions` table, auto-save on create/update, admin viewer with version list and content inspection. Max 50 revisions per post.                                 |
| AUD-031 | Low      | **Fixed**    | Feature | Media upload component with preview, drag-and-drop, file type/size validation. Cover image preview after URL or upload.                                                                          |
| AUD-032 | Low      | **Deferred** | Feature | Newsletter subscription implementation is retained, but the public entry is hidden until email sending, confirmation, and unsubscribe flows are implemented.                                     |
| AUD-037 | Low      | **Fixed**    | Feature | Comment system — threaded/nested replies, pending→approved→spam workflow, admin moderation page (`/admin/comments`), RLS-enforced.                                                               |
| AUD-026 | Low      | **Fixed**    | DevOps  | Dockerfile (multi-stage, standalone output) + GitHub Actions CI workflow (lint + build).                                                                                                         |

## Second Session Resolved

| ID      | Severity | Status    | Area        | Finding                                                                                               |
| ------- | -------- | --------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| AUD-019 | Medium   | **Fixed** | Admin       | Trend chart (7/14/30 day area chart) with analytics API. View events migration for per-view tracking. |
| AUD-027 | Low      | **Fixed** | Deprecation | middleware.ts → proxy.ts migration per Next.js 16 convention.                                         |
| AUD-028 | Low      | **Fixed** | DevOps      | `/api/health` endpoint with DB connectivity check.                                                    |
| AUD-030 | Low      | **Fixed** | Feature     | Batch operations — select-all checkboxes, batch publish/archive/delete in admin.                      |
| AUD-033 | Low      | **Fixed** | Feature     | Related posts based on shared-tag scoring (getRelatedPosts).                                          |
| AUD-034 | Low      | **Fixed** | Feature     | Server-side full-text search via `?q=` param with Supabase ilike.                                     |
| AUD-035 | Low      | **Fixed** | UX          | Post editor auto-save to localStorage (3s debounce) with draft restore/clear.                         |
| AUD-036 | Low      | **Fixed** | Data        | view_events table migration for analytics. ViewCounter logs events client-side.                       |

## First Session Resolved

| ID      | Severity | Status    | Area        | Finding                                                                 |
| ------- | -------- | --------- | ----------- | ----------------------------------------------------------------------- |
| AUD-011 | Critical | **Fixed** | Performance | N+1 queries. Batch tag fetch: 2 queries regardless of post count.       |
| AUD-012 | High     | **Fixed** | Performance | Middleware skipped auth for public routes.                              |
| AUD-013 | High     | **Fixed** | Security    | Login rate limiting: 5 req/min per IP.                                  |
| AUD-014 | High     | **Fixed** | Validation  | Zod schemas on all server actions.                                      |
| AUD-015 | High     | **Fixed** | Performance | ISR caching: homepage/tags=1h, post/about=24h.                          |
| AUD-016 | High     | **Fixed** | SEO         | JSON-LD: Organization, WebSite, Article, BreadcrumbList.                |
| AUD-017 | Medium   | **Fixed** | Security    | View counter dedup via sessionStorage, 30-min cooldown.                 |
| AUD-018 | Medium   | **Fixed** | Feature     | Scheduled post publishing: `/api/cron/publish-scheduled` + CRON_SECRET. |
| AUD-021 | Medium   | **Fixed** | Code        | Search uses useRouter().push() instead of window.location.              |
| AUD-022 | Low      | **Fixed** | CSS         | `var(--muted)/30` fixed to `color-mix()`.                               |
| AUD-023 | Low      | **Fixed** | Deps        | Unused `gray-matter` removed.                                           |
| AUD-024 | Low      | **Fixed** | Code        | Social platforms deduplication via zod-typed fields.                    |
| AUD-025 | Low      | **Fixed** | SEO         | Twitter Card + og:image dimensions in metadata.                         |

## Historical Resolved Issues

| ID                | Severity | Status | Area     | Finding                                                                          |
| ----------------- | -------- | ------ | -------- | -------------------------------------------------------------------------------- |
| AUD-001 ~ AUD-010 | Various  | Fixed  | Multiple | Initial baseline fixes: authorization, XSS, routing, ESLint, site settings, etc. |

## Active Issues

All active issues and the unified execution plan now live in the consolidated document:

- **[project-plan.md](./project-plan.md)** — 整合版项目问题与修复计划（合并自 issue-tracker.md、fix-plan.md、optimization-backlog.md、other-model.md）

### Previously Active Issues (AUD-041 ~ AUD-050)

| ID      | Severity | Status      | Area             | Finding                                                                                                                                                          |
| ------- | -------- | ----------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-041 | High     | In Progress | Security         | Admin Markdown previews render raw `marked` output. Public rendering is sanitized, but editor/settings previews must use the same sanitizer. → **AUD-091**       |
| AUD-042 | High     | In Progress | Security         | Uploaded images currently allow SVG in code and Supabase Storage policy. Public SVG uploads increase XSS and external-resource risk. → **AUD-092**               |
| AUD-043 | High     | In Progress | Security         | Analytics RPC functions are `SECURITY DEFINER`; execution privileges should be explicitly revoked from public roles and granted only where needed. → **AUD-093** |
| AUD-044 | High     | In Progress | Quality          | `pnpm lint` fails with React hook, `any`, and unused-variable issues, so CI is not a reliable release gate yet. → **AUD-094**                                    |
| AUD-045 | Medium   | Pending     | Abuse prevention | Public comments, newsletter, search, and view-event endpoints need durable rate limiting and bot/spam controls. → **AUD-068**                                    |
| AUD-046 | Medium   | Pending     | Content workflow | Scheduled publishing endpoint exists, but the editor does not expose scheduled publish time as a first-class workflow. → **AUD-075**                             |
| AUD-047 | Medium   | Pending     | Routing          | Post URL generation needs one shared helper so homepage, related posts, search, sitemap, RSS, and JSON-LD cannot drift. → **AUD-076**                            |
| AUD-048 | Medium   | Pending     | Storage          | Supabase storage provider caching should not retain request-bound Supabase clients across users/requests. → **AUD-077**                                          |
| AUD-049 | Medium   | Pending     | Search           | Current search uses basic `ilike`; high-quality Chinese search needs `pg_trgm`/full-text indexes, ranking, and no-result query tracking. → **AUD-064**           |
| AUD-050 | Low      | Pending     | Admin            | Revision history supports viewing but not diffing or restoring a previous version. → **AUD-090**                                                                 |

### Previously Active Issues (Lower Priority)

| ID      | Severity | Status  | Area     | Finding                                                          |
| ------- | -------- | ------- | -------- | ---------------------------------------------------------------- |
| AUD-038 | Low      | Pending | Testing  | No test framework (unit/integration/E2E). → **AUD-078**          |
| AUD-039 | Low      | Pending | Security | No CSP header configured. → **AUD-072**                          |
| AUD-040 | Low      | Pending | Admin    | No analytics dashboard for newsletter subscribers. → **AUD-089** |

## Project Stats

| Metric              | Before (Session 1)             | After (Session 3)                             |
| ------------------- | ------------------------------ | --------------------------------------------- |
| N+1 queries         | Yes (101 queries for 50 posts) | No (2 queries)                                |
| Middleware overhead | getUser() on every request     | Only admin routes                             |
| ISR caching         | None                           | 5 pages cached                                |
| Validation          | None                           | Zod on all actions                            |
| Rate limiting       | None                           | Login 5/min per IP                            |
| Structured data     | None                           | 4 JSON-LD types                               |
| View dedup          | None                           | sessionStorage 30min                          |
| Scheduled posts     | Unimplemented                  | CRON endpoint                                 |
| Batch operations    | None                           | Select-all + batch actions                    |
| Full-text search    | Client-side filter             | Server-side ilike                             |
| Auto-save           | None                           | localStorage 3s debounce                      |
| Related posts       | None                           | Tag-based scoring                             |
| Image upload        | Manual URL only                | Drag-and-drop + paste                         |
| Revision history    | None                           | Auto-save + viewer                            |
| Comments            | None                           | Threaded + admin moderation                   |
| Newsletter          | None                           | API + data model retained; public form hidden |
| Docker/CI           | None                           | Dockerfile + GitHub Actions                   |
| Health check        | None                           | /api/health                                   |
| middleware→proxy    | Deprecated                     | Migrated                                      |
| CSS validation      | Invalid color-mix              | Fixed                                         |
| Search router       | window.location                | useRouter()                                   |
| Unused deps         | gray-matter                    | Removed                                       |

## Operational Notes

- Supabase RLS enforces all policies at DB level. Application checks are defense-in-depth.
- **Current initial-release migration**: run `supabase/migrations/202606020001_initial_release.sql` on a fresh Supabase project.
- Scheduled publishing: set `CRON_SECRET` env var, call `GET /api/cron/publish-scheduled` via cron service with `Authorization: Bearer <CRON_SECRET>`.
- Image upload: requires Supabase Storage bucket `blog-images` created via `supabase/migrations/202606020001_initial_release.sql`.
- Comments use "pending" moderation by default — admins must approve via `/admin/comments`.
- ISR: homepage/tags=1h, post/about=24h. On-demand revalidation on content changes.
- Login rate limit: 5/min per IP (in-memory). For multi-instance, migrate to Upstash Redis.
- Admin management and role systems are intentionally out of scope because the product has a single-admin operating model.
