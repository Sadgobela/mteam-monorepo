# mTeam monorepo

Real estate listings platform for mTeam (Georgia only). pnpm + Turborepo.

**Read `docs/PROJECT_BRIEF.md` first**: company, goals, scope and agreed decisions.

- `apps/web`: Next.js 15 App Router, routes under `src/app/[locale]` (ka default, en, ru). Middleware adds the locale prefix.
- `packages/shared`: types, i18n dictionaries (all three languages must have the same keys).
- `packages/db`: Prisma schema, migrations, demo seed and listing queries. Pages call these queries, never Prisma directly.

Rules:
- 100% test coverage (lines, branches, functions, statements) is enforced by Vitest thresholds in CI. Every change ships with tests; do not lower thresholds or add coverage ignores.
- Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` before pushing.
- Design: variant A (light, search-first), brand purple `#986DC6`. Colors come from CSS tokens in `globals.css`, with light and dark themes. Interactive controls use Ant Design 6, themed in `apps/web/src/components/AntProvider.tsx`; its surfaces and text follow the same tokens through the `--ant-*` block in `globals.css`.
- User-facing copy lives in `packages/shared/src/i18n.ts`, never inline.
