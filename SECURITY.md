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
- Production startup validates required server-side environment variables, including Supabase service credentials, `IP_HASH_SECRET`, storage provider settings, and `CRON_SECRET`.
- Admin and auth pages receive a per-request CSP nonce from `proxy.ts`; public pages retain static security headers from `next.config.mjs`.
- Public/admin API routes use a shared response wrapper with `x-request-id`, fixed 5xx client messages, and structured server logs.

## Known Gaps

- Rate limiting uses the Supabase `rate_limits` RPC when the service role key is available, but falls back to process-local memory during configuration or database outages.
- Dependency monitoring uses Dependabot plus the scheduled/manual `Dependency Audit` workflow. SAST, secret scanning, and container scanning are still repository/platform setup tasks.
- Automated tests cover key pure logic and security boundaries, but there is no browser E2E suite yet.
- OAuth/MCP endpoints intentionally preserve protocol-specific response shapes; internal API response envelopes use `{ ok, data/error }`.
