# Changelog

## 0.1.0 - Initial GitHub Release

### Added

- Public blog with paginated homepage, post pages, tag pages, about page, RSS, sitemap, and robots.
- Markdown rendering with HTML sanitization, table of contents, enhanced code blocks, related posts, and share action.
- Admin dashboard with post management, status workflow, batch actions, analytics cards, and trend charts.
- Admin pages for tags, comments, media library, storage provider settings, and site settings.
- Supabase Auth first-admin bootstrap and RLS-backed data access.
- Comments with pending moderation and server-side sanitization.
- Newsletter subscription endpoint and data model are retained for future email notifications; public entry is currently hidden until outbound email is implemented.
- Image upload with MIME sniffing and support for Supabase Storage, S3-compatible storage, and Cloudflare R2.
- Scheduled publishing cron endpoint protected by `CRON_SECRET`.
- GitHub Actions CI for lint and build.
- Docker standalone image with healthcheck.
- Security headers in Next.js config.

### Known Limitations

- Single-admin product model only.
- No test framework yet; release gate is lint + build.
- Rate limiting is in-memory and should be replaced for multi-instance deployments.
- Newsletter UI is disabled; email sending, confirmation, and unsubscribe flows are not implemented yet.
- Revision history supports viewing, not diff or restore.
- License is not selected yet.
