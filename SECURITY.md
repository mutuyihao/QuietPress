# Security

## Supported Version

This project is preparing its first public release at `0.1.0`. Security fixes should target the current `main` branch unless a release branch is created later.

## Reporting

Do not open public issues for sensitive vulnerabilities. Report privately to the repository owner once the GitHub repository exists.

Include:

- Affected route, component, API, or migration.
- Reproduction steps.
- Expected impact.
- Suggested fix if available.

## Current Security Model

- Supabase RLS is the primary authorization boundary.
- Admin access requires an authenticated Supabase user with a row in `admin_profiles`.
- The product intentionally supports a single-admin operating model.
- Public comments are sanitized before storage and require moderation before display.
- Markdown output is sanitized before public rendering.
- Uploads validate file content MIME and currently allow JPEG, PNG, WebP, and GIF only.
- Remote MCP is disabled by default and must be enabled by an admin in `/admin/ai-access`.
- MCP access requires OAuth Bearer tokens in the `Authorization` header; tokens in URL query parameters are rejected.
- MCP OAuth uses Authorization Code + PKCE, Dynamic Client Registration for compatible clients, hashed tokens at rest, short-lived access tokens, refresh token rotation, scope checks, and exact `/api/mcp` resource audience checks.
- MCP tool calls are audit logged with client, user, scope, request, input/result summaries, hashed IP/user-agent, and success/error status.
- High-risk MCP tools such as publishing, deleting, settings updates, and migration import require explicit confirmation and an idempotency key.
- MCP media URL imports apply SSRF protections and reject non-HTTP(S), localhost/private-network, non-image, oversized, or timed-out downloads.
- Scheduled publishing requires `CRON_SECRET`.
- Security headers are configured in `next.config.mjs`.

## Known Gaps

- Rate limiting is process-local and should be moved to Redis/Upstash for multi-instance deployments.
- There is no formal dependency vulnerability workflow beyond GitHub Actions CI.
- There is no automated test suite yet.
- API response envelopes are not fully standardized.
