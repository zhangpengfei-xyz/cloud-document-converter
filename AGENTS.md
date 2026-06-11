# Repository Guidelines

## Project Structure & Module Organization

This repo is a pnpm + Turborepo single-app workspace for **Feishu Doc2Md** (a browser extension that converts Lark cloud docs to Markdown).

- `apps/chrome-extension/`: Vue-based extension package (UI in `src/pages/`, shared UI in `src/components/`, scripts in `src/scripts/`).
- `apps/chrome-extension/src/core/`: core Lark Doc/Docx → Markdown transformer, runtime adapter, post-processing utilities, and extension messages.
- `apps/chrome-extension/tsconfig*.json`: package-local TypeScript configuration.
Build outputs generally land in `dist/`.

## Build, Test, and Development Commands

Toolchain: Node `22.12.0` (see `.node-version`) and pnpm (see `package.json#packageManager`).

- Install deps: `pnpm install`
- Build the workspace: `pnpm run build`
- Type-check the workspace: `pnpm run type-check`
- Lint: `pnpm run lint`
- Format check / fix: `pnpm run format-check` / `pnpm run format`

Extension development:

- Dev server for pages: `pnpm --filter @feishu-doc2md/chrome-extension dev:pages`
- Build extension: `pnpm --filter @feishu-doc2md/chrome-extension build`
- Run in a browser (after build): `pnpm -C apps/chrome-extension exec web-ext run --source-dir dist --target chromium`
## Coding Style & Naming Conventions

- TypeScript (ESM) throughout; prefer small, typed functions and explicit exports.
- Indentation: 2 spaces.
- Prettier: no semicolons, single quotes (see `.prettierrc`).
- ESLint: `typescript-eslint` strict configs; keep `pnpm run lint` clean before opening a PR.
- Naming: the extension package uses the `@feishu-doc2md/*` scope.

## Commit & Pull Request Guidelines

- Commits generally follow Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `chore: ...`, `refactor(scope): ...`.
- PRs should include: clear description, linked issue, and a GIF/video for behavior/UI changes. Run `lint`, `format-check`, and `type-check` before opening a PR.

## Security & Configuration Tips

- Don’t commit tokens, cookies, or private document content. When adding fixtures/snapshots, use synthetic or sanitized data.
