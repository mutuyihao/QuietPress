# Project Audit

> Archive note: this document keeps historical audit context. Some open findings have since been fixed in code. Use `README.md`, `docs/setup.md`, `docs/architecture.md`, and `docs/release-checklist.md` as the current release source of truth.

Last reviewed: 2026-06-01 (Session 4)

## Product Constraint

- Admin scope is intentionally single-admin. There is no near-term requirement for multiple admin accounts, roles, permissions, invitations, or admin user management.

## Fourth Session Findings (2026-06-01)

Comprehensive project audit conducted across 6 dimensions: Performance, UX, Code Quality, Security, Feature Completeness, and Scalability. 40 new issues identified (AUD-051 ~ AUD-090).

### Critical

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-051 | Critical | Open | Security | SQL injection in search API — user input directly interpolated into Supabase `.or()` filter |
| AUD-052 | Critical | Open | Security | Comment content XSS — no server-side HTML sanitization on comment input |

### High

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-053 | High | Open | Performance | Next.js Image optimization disabled (`images.unoptimized: true`); no WebP/AVIF, no responsive srcset |
| AUD-054 | High | Open | Performance | N+1 query pattern in `attachTags()` — 3 queries per post list load instead of Supabase nested select |
| AUD-055 | High | Open | Performance | Markdown rendering (`marked` + `sanitize-html`) runs on every SSR request with no cache |
| AUD-056 | High | Open | Performance/UX/Scale | No pagination — `getPublishedPosts()` fetches all posts without LIMIT |
| AUD-057 | High | Open | Performance | `getSiteSettings()` called 2-3 times per request (RootLayout + PublicLayout + page) |
| AUD-058 | High | Open | Performance/UX | Search API no debounce — fetch on every keystroke |
| AUD-059 | High | Open | DevOps | Docker standalone output not configured — Dockerfile copies `.next/standalone` but `output: 'standalone'` missing |
| AUD-060 | High | Open | Code Quality | Repository layer uses `any` types — no Supabase type generation |
| AUD-061 | High | Open | Code Quality | Inconsistent API error handling — mixed `try/catch`, varying response shapes |
| AUD-062 | High | Open | Code Quality | Server Actions throw `Error` instead of returning structured results |
| AUD-063 | High | Open | Code Quality | `updatePostSchema = createPostSchema` — update requires all fields, prevents partial updates |
| AUD-064 | High | Open | UX | Search lacks keyword highlighting, history, empty-state suggestions, ⌘K hint |
| AUD-065 | High | Open | UX | No mobile navigation menu — header links overflow on small screens |

### Medium

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-066 | Medium | Open | Feature/Admin | No rich text editor — plain textarea only |
| AUD-067 | Medium | Open | Feature/Admin | No media library management page |
| AUD-068 | Medium | Open | Security/Scale | Rate limiter uses in-memory Map — fails in multi-instance, no max size |
| AUD-069 | Medium | Open | Feature/UX | Comment section missing Markdown, likes, admin reply, email notifications |
| AUD-070 | Medium | Open | Security/Feature | Newsletter no email verification — anyone can subscribe any address |
| AUD-071 | Medium | Open | Security/Data | View counter can be inflated — only sessionStorage dedup |
| AUD-072 | Medium | Open | Security | No CSP or security headers configured |
| AUD-073 | Medium | Open | Scalability | No database index strategy documented or verified |
| AUD-074 | Medium | Open | Security/Compliance | No audit logging for admin actions |
| AUD-075 | Medium | Open | Feature/Admin | Scheduled publishing has no editor UI (date/time picker) |
| AUD-076 | Medium | Open | Code Quality | Post URL generation not centralized — duplicated across 6+ files |
| AUD-077 | Medium | Open | Security/Code | Storage provider caches request-bound Supabase client globally |
| AUD-078 | Medium | Open | Code Quality | No test framework configured |
| AUD-079 | Medium | Open | DevOps | No Docker HEALTHCHECK probe configured |
| AUD-080 | Medium | Open | UX | Tag pages missing post count |

### Low

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-081 | Low | Open | UX | No breadcrumb navigation on post pages |
| AUD-082 | Low | Open | UX | Dark mode toggle has no transition animation |
| AUD-083 | Low | Open | UX | 404 page missing search suggestions |
| AUD-084 | Low | Open | UX/A11y | No font size adjustment for reading |
| AUD-085 | Low | Open | UX | No image lightbox for post images |
| AUD-086 | Low | Open | Feature | No article bookmark/favorite feature |
| AUD-087 | Low | Open | Feature | No article import/export |
| AUD-088 | Low | Open | Feature/Admin | No Open Graph preview in editor |
| AUD-089 | Low | Open | Feature/Admin | No newsletter analytics dashboard |
| AUD-090 | Low | Open | Feature/Admin | Revision history no diff or restore |

### Session 4 Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 13 |
| Medium | 15 |
| Low | 10 |
| **Total** | **40** |

Detailed issue tracking: [issue-tracker.md](./issue-tracker.md)
Fix plan and milestones: [fix-plan.md](./fix-plan.md)

## Third Session Resolved (2026-06-01)

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-020 | Medium | **Fixed** | Admin | Image upload via `/api/admin/upload` — drag-and-drop + click-to-upload in post editor. Cover image and inline Markdown image insertion. Supabase Storage bucket `blog-images` migration created. |
| AUD-029 | Low | **Fixed** | Feature | Article revision history — `post_revisions` table, auto-save on create/update, admin viewer with version list and content inspection. Max 50 revisions per post. |
| AUD-031 | Low | **Fixed** | Feature | Media upload component with preview, drag-and-drop, file type/size validation. Cover image preview after URL or upload. |
| AUD-032 | Low | **Fixed** | Feature | Newsletter subscription — email signup form on homepage, `/api/newsletter` endpoint, `newsletter_subscribers` table with resubscribe support. |
| AUD-037 | Low | **Fixed** | Feature | Comment system — threaded/nested replies, pending→approved→spam workflow, admin moderation page (`/admin/comments`), RLS-enforced. |
| AUD-026 | Low | **Fixed** | DevOps | Dockerfile (multi-stage, standalone output) + GitHub Actions CI workflow (lint + build). |

## Second Session Resolved

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-019 | Medium | **Fixed** | Admin | Trend chart (7/14/30 day area chart) with analytics API. View events migration for per-view tracking. |
| AUD-027 | Low | **Fixed** | Deprecation | middleware.ts → proxy.ts migration per Next.js 16 convention. |
| AUD-028 | Low | **Fixed** | DevOps | `/api/health` endpoint with DB connectivity check. |
| AUD-030 | Low | **Fixed** | Feature | Batch operations — select-all checkboxes, batch publish/archive/delete in admin. |
| AUD-033 | Low | **Fixed** | Feature | Related posts based on shared-tag scoring (getRelatedPosts). |
| AUD-034 | Low | **Fixed** | Feature | Server-side full-text search via `?q=` param with Supabase ilike. |
| AUD-035 | Low | **Fixed** | UX | Post editor auto-save to localStorage (3s debounce) with draft restore/clear. |
| AUD-036 | Low | **Fixed** | Data | view_events table migration for analytics. ViewCounter logs events client-side. |

## First Session Resolved

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-011 | Critical | **Fixed** | Performance | N+1 queries. Batch tag fetch: 2 queries regardless of post count. |
| AUD-012 | High | **Fixed** | Performance | Middleware skipped auth for public routes. |
| AUD-013 | High | **Fixed** | Security | Login rate limiting: 5 req/min per IP. |
| AUD-014 | High | **Fixed** | Validation | Zod schemas on all server actions. |
| AUD-015 | High | **Fixed** | Performance | ISR caching: homepage/tags=1h, post/about=24h. |
| AUD-016 | High | **Fixed** | SEO | JSON-LD: Organization, WebSite, Article, BreadcrumbList. |
| AUD-017 | Medium | **Fixed** | Security | View counter dedup via sessionStorage, 30-min cooldown. |
| AUD-018 | Medium | **Fixed** | Feature | Scheduled post publishing: `/api/cron/publish-scheduled` + CRON_SECRET. |
| AUD-021 | Medium | **Fixed** | Code | Search uses useRouter().push() instead of window.location. |
| AUD-022 | Low | **Fixed** | CSS | `var(--muted)/30` fixed to `color-mix()`. |
| AUD-023 | Low | **Fixed** | Deps | Unused `gray-matter` removed. |
| AUD-024 | Low | **Fixed** | Code | Social platforms deduplication via zod-typed fields. |
| AUD-025 | Low | **Fixed** | SEO | Twitter Card + og:image dimensions in metadata. |

## Historical Resolved Issues

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-001 ~ AUD-010 | Various | Fixed | Multiple | Initial baseline fixes: authorization, XSS, routing, ESLint, site settings, etc. |

## Active Issues

All active issues and the unified execution plan now live in the consolidated document:

- **[project-plan.md](./project-plan.md)** — 整合版项目问题与修复计划（合并自 issue-tracker.md、fix-plan.md、optimization-backlog.md、other-model.md）

### Previously Active Issues (AUD-041 ~ AUD-050)

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-041 | High | In Progress | Security | Admin Markdown previews render raw `marked` output. Public rendering is sanitized, but editor/settings previews must use the same sanitizer. → **AUD-091** |
| AUD-042 | High | In Progress | Security | Uploaded images currently allow SVG in code and Supabase Storage policy. Public SVG uploads increase XSS and external-resource risk. → **AUD-092** |
| AUD-043 | High | In Progress | Security | Analytics RPC functions are `SECURITY DEFINER`; execution privileges should be explicitly revoked from public roles and granted only where needed. → **AUD-093** |
| AUD-044 | High | In Progress | Quality | `pnpm lint` fails with React hook, `any`, and unused-variable issues, so CI is not a reliable release gate yet. → **AUD-094** |
| AUD-045 | Medium | Pending | Abuse prevention | Public comments, newsletter, search, and view-event endpoints need durable rate limiting and bot/spam controls. → **AUD-068** |
| AUD-046 | Medium | Pending | Content workflow | Scheduled publishing endpoint exists, but the editor does not expose scheduled publish time as a first-class workflow. → **AUD-075** |
| AUD-047 | Medium | Pending | Routing | Post URL generation needs one shared helper so homepage, related posts, search, sitemap, RSS, and JSON-LD cannot drift. → **AUD-076** |
| AUD-048 | Medium | Pending | Storage | Supabase storage provider caching should not retain request-bound Supabase clients across users/requests. → **AUD-077** |
| AUD-049 | Medium | Pending | Search | Current search uses basic `ilike`; high-quality Chinese search needs `pg_trgm`/full-text indexes, ranking, and no-result query tracking. → **AUD-064** |
| AUD-050 | Low | Pending | Admin | Revision history supports viewing but not diffing or restoring a previous version. → **AUD-090** |

### Previously Active Issues (Lower Priority)

| ID | Severity | Status | Area | Finding |
| --- | --- | --- | --- | --- |
| AUD-038 | Low | Pending | Testing | No test framework (unit/integration/E2E). → **AUD-078** |
| AUD-039 | Low | Pending | Security | No CSP header configured. → **AUD-072** |
| AUD-040 | Low | Pending | Admin | No analytics dashboard for newsletter subscribers. → **AUD-089** |

## Project Stats

| Metric | Before (Session 1) | After (Session 3) |
|--------|-------------------|-------------------|
| N+1 queries | Yes (101 queries for 50 posts) | No (2 queries) |
| Middleware overhead | getUser() on every request | Only admin routes |
| ISR caching | None | 5 pages cached |
| Validation | None | Zod on all actions |
| Rate limiting | None | Login 5/min per IP |
| Structured data | None | 4 JSON-LD types |
| View dedup | None | sessionStorage 30min |
| Scheduled posts | Unimplemented | CRON endpoint |
| Batch operations | None | Select-all + batch actions |
| Full-text search | Client-side filter | Server-side ilike |
| Auto-save | None | localStorage 3s debounce |
| Related posts | None | Tag-based scoring |
| Image upload | Manual URL only | Drag-and-drop + paste |
| Revision history | None | Auto-save + viewer |
| Comments | None | Threaded + admin moderation |
| Newsletter | None | Subscribe form + API |
| Docker/CI | None | Dockerfile + GitHub Actions |
| Health check | None | /api/health |
| middleware→proxy | Deprecated | Migrated |
| CSS validation | Invalid color-mix | Fixed |
| Search router | window.location | useRouter() |
| Unused deps | gray-matter | Removed |

## Operational Notes

- Supabase RLS enforces all policies at DB level. Application checks are defense-in-depth.
- **Current initial-release migration**: run `supabase/migrations/202606020001_initial_release.sql` on a fresh Supabase project.
- Scheduled publishing: set `CRON_SECRET` env var, call `GET /api/cron/publish-scheduled` via cron service with `Authorization: Bearer <CRON_SECRET>`.
- Image upload: requires Supabase Storage bucket `blog-images` created via `supabase/migrations/202606020001_initial_release.sql`.
- Comments use "pending" moderation by default — admins must approve via `/admin/comments`.
- ISR: homepage/tags=1h, post/about=24h. On-demand revalidation on content changes.
- Login rate limit: 5/min per IP (in-memory). For multi-instance, migrate to Upstash Redis.
- Admin management and role systems are intentionally out of scope because the product has a single-admin operating model.
