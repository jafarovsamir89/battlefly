# Contributing

## Commands

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`

## Notes

- Keep simulation logic inside `packages/simulation`.
- Keep browser-only code inside `apps/web-client`.
- Keep shared DTOs in `packages/shared-types`.
- Prefer deterministic, serializable data over class-heavy state.

