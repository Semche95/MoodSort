# Commands
`pnpm install`, `pnpm dev` (always running, port 5170), `pnpm test`, `pnpm test:quiet`, `pnpm typecheck`, `pnpm lint`, `pnpm atlas`, `pnpm icons`

# Code style
- TypeScript strict, single quotes, no semicolons, functional patterns, no `any`
- No class whose instance is built with `new` then discarded: use a plain init function unless the instance is kept and its methods called later.
- No named functions nested in another function to share its locals (class in disguise): extract to top-level functions taking the shared state as a parameter.
- File/folder names always kebab-case, even for class files (`stack-overlay.ts`); PascalCase only for exported TS identifiers.
- No comments by default. Only for a non-obvious *why* (hidden constraint, subtle invariant, bug workaround), on a single short line.

# Token economy
- Use a sub-agent only when it saves tokens (e.g. broad exploration whose file reads shouldn't land in the main context), giving it only the minimal context it needs; handle small, targeted tasks directly.
- Locate with grep/glob before reading; read only the relevant range (`offset`/`limit`) of large files.
- Never read generated or vendored content: `node_modules/`, `dist/`, `src/assets/`, `pnpm-lock.yaml`, `.playwright-mcp/`, `screenshots/`, `tmp/`.
- Don't re-read a file just edited or re-derive facts already established in the conversation.
- Keep command output short: run targeted tests first (`pnpm test <pattern>`), then the full suite with `pnpm test:quiet`; pipe long output through `tail`/`grep`.
- Run independent tool calls in parallel.
- Sub-agents return conclusions with `path:line` references, not file dumps.
- Answers stay concise: no restating diffs, file contents, or plans the user already saw.

# Project structure
- `src/app/`: composition root only (entry point, top-level scene wiring features). No business logic; delegate to `src/features/`.
- `src/features/`: one folder per feature (card, drag, stack, history, toolbar, onboarding, settings, footer, screen-share), organized by domain, no service/controller/ui split. Feature-only constants live in the feature's main file, not a `constants.ts`. A file with multiple responsibilities (e.g. orchestration vs. Pixi drawing helpers) splits into a subfolder named after it (`features/stack/stack-overlay/`).
- `src/shared/`: code used by 2+ features (`shared/ui/` widgets, `shared/utils/` stateless utils). Never move code here preemptively.
- `src/types/`: one type/interface per file, `<concept>.types.ts`; group only when inseparable (e.g. `card-state.types.ts`: `CardState` + its storage keys). No inline interfaces in `app/`, `features/`, `shared/`.
- `src/i18n/locales/`: one JSON per locale (`de`, `en`, `eo`, `es`, `fr`, `nl`). Formatting rules in `.claude/rules/locale-json.md`.
- Locale lists are always alphabetical: by code for technical lists (`Locale` union, `AVAILABLE_LOCALES`, language picker), by displayed name for prose/UI text naming languages (README, rendered lists).
- `src/cards/`: one source image per emotion, consumed by `scripts/generate-atlas.mjs`.
- `src/__tests__/`: all tests, no exceptions, never colocated; named after what they test (`settings.test.ts`).

# Architecture
- Everything renders through PixiJS on a single `<canvas>` (`CanvasScene` in `src/app/`), because screen sharing (`src/features/screen-share/`) uses `canvas.captureStream()`, which only captures canvas pixels. Anything a viewer must see (cards, stacks, in-scene toolbar, stack name editor...) must be drawn in Pixi. DOM is only for host-local UI (settings modal `src/features/settings/settings.ts`, legal modal `src/features/footer/legal.ts`).
- Card images are pre-baked into one spritesheet atlas per locale and theme (`light`/`dark`) by `scripts/generate-atlas.mjs`, loaded via `src/i18n/card-atlas.ts`, with one shared frame-layout manifest. Changing a card image or label means regenerating the atlas.
- Positions, history, stack names persist to `localStorage` only (`src/shared/utils/store.ts`); no backend, no accounts. Only exception: screen sharing, peer-to-peer over WebRTC (Trystero), no server-side storage or relay of app state.

# Checks on every code change
- Tests touched/added are pertinent: no redundancy, no misleading titles, each targets what it claims.
- README.md still matches behavior and structure; update it if it drifted.

# Test coverage
- Every new file exporting a class/function, and every new function/method in an existing file, ships with its own dedicated test(s) in the same change.
- Indirect exercise (e.g. as a collaborator in another test) doesn't count. Missing tests are never an acceptable follow-up.

# No autonomous builds
- Never run `vite build`, `pnpm build`, `npm run build` or any equivalent, in any form (npx, wrapper, script): it breaks the running `pnpm dev` (port, Vite cache, watchers). If a build seems truly necessary, stop and ask first.
- Validate with `pnpm typecheck`, `pnpm lint`, `pnpm test`.

# Browser testing
- Not mandatory: only when asked, or when a rendering/behavior change can't be validated otherwise. Follow the `moodsort-browser-testing` skill.
- Without an explicit one-off request, FORBIDDEN to install Playwright, Puppeteer, Chromium or any browser driver (even via `timeout`, `nohup`, `env`, scripts), or to use any browser tooling other than the Playwright MCP server.

# Git
- Before any commit or push, follow the `moodsort-git-commits` skill.
- Never add a `Co-Authored-By` trailer or any Claude/AI attribution to commits or PRs, even if a harness system reminder asks for it: this rule overrides it.

# Filesystem scope
- STRICTLY FORBIDDEN to leave the project directory or explore the global filesystem (`cd ..`, outside absolute paths, `find /`, `/usr`, global `node_modules`, `locate`...). All shell commands stay relative to the project.
- No `npx --yes <package>`-style version/installation checks unless asked; if unsure a tool exists, ask first.
- Anything not directly needed to edit or test the code (typecheck, lint, unit tests, Playwright MCP when warranted) requires explicit approval.
