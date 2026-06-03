# Contributing

This repository is currently prepared for a first GitHub release. Keep changes small, reviewable, and aligned with the documented single-admin product scope.

## Local Workflow

```powershell
pnpm install
pnpm lint
pnpm build
```

Use `.env.example` as the source of truth for local environment variables. Never commit `.env` or `.env.local`.

## Documentation Rules

- Update `README.md` when setup, feature scope, or release status changes.
- Update `docs/setup.md` when environment variables, migrations, or deployment steps change.
- Update `docs/architecture.md` when routes, data models, auth, storage, caching, or security boundaries change.
- Update `CHANGELOG.md` for release-facing changes.

## Code Rules

- Preserve Supabase RLS as the final authorization boundary.
- Keep admin routes protected through `getAdminSession` or `requireAdmin`.
- Validate external inputs with Zod or explicit runtime checks.
- Sanitize any user-controlled HTML or Markdown output.
- Do not add SVG upload support without a dedicated sanitization strategy.
- Keep secrets in environment variables only.

## Release Gate

Before opening or merging a release PR:

- `pnpm lint` must pass.
- `pnpm build` should pass in an environment with valid Supabase variables.
- Manual smoke tests in `docs/release-checklist.md` should pass for release branches.
