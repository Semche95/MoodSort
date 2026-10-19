# Commands
`pnpm install`, `pnpm dev` (always running, port 5170), `pnpm test`, `pnpm test:quiet`, `pnpm typecheck`, `pnpm lint`, `pnpm atlas`, `pnpm icons`

# Code style
- TypeScript strict, single quotes, no semicolons, functional patterns, no `any`
- No class whose instance is built with `new` then discarded: use a plain init function unless the instance is kept and its methods called later.
- No named functions nested in another function to share its locals (class in disguise): extract to top-level functions taking the shared state as a parameter.
- DRY: no duplicated logic, values or structures; factor repeated code into a shared function or constant (respecting the `src/shared/` rule below).
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
- `src/i18n/locales/`: one JSON per locale (`de`, `en`, `eo`, `es`, `fr`, `nl`). Each pretty-printed (2-space indent, one key per line, trailing newline, never minified) and validated by `locale.schema.json`; formatting enforced by `src/__tests__/locale-formatting.test.ts`.
- Locale lists are always alphabetical: by code for technical lists (`Locale` union, `AVAILABLE_LOCALES`, language picker), by displayed name for prose/UI text naming languages (README, rendered lists).
- `src/cards/`: one source image per emotion, consumed by `scripts/generate-atlas.mjs`.
- `src/__tests__/`: all tests, no exceptions, never colocated; named after what they test (`settings.test.ts`).

# Architecture
- Everything renders through PixiJS on a single `<canvas>` (`CanvasScene` in `src/app/`), because screen sharing (`src/features/screen-share/`) uses `canvas.captureStream()`, which only captures canvas pixels. Anything a viewer must see (cards, stacks, in-scene toolbar, stack name editor...) must be drawn in Pixi. DOM is only for host-local UI (settings modal `src/features/settings/settings.ts`, legal modal `src/features/footer/legal.ts`).
- Card images are pre-baked into one spritesheet atlas per locale and theme (`light`/`dark`) by `scripts/generate-atlas.mjs`, loaded via `src/i18n/card-atlas.ts`, with one shared frame-layout manifest. Changing a card image or label means regenerating the atlas.
- Branding (logo and "MoodSort" wordmark, `src/logo/`) must never look pixelated or blurry, at any zoom level or pixel density: keep the SVGs at their display size, rasterize them once at the renderer resolution (`src/features/toolbar/branding.ts`), draw them 1:1 (never scale the sprites), and check them in the browser at several zoom levels after any change touching them.
- Positions, history, stack names persist to `localStorage` only (`src/shared/utils/store.ts`); no backend, no accounts. Only exception: screen sharing, peer-to-peer over WebRTC (Trystero), no server-side storage or relay of app state.

# Checks on every code change
- Tests touched/added are pertinent: no redundancy, no misleading titles, each targets what it claims.
- BEHAVIOR.md matches the app's behavior and business rules; update it when a change adds or alters one (rules go there, not in README.md or AGENTS.md).
- README.md matches setup, structure and architecture; update it if it drifted.

# Test coverage
- Every new file exporting a class/function, and every new function/method in an existing file, ships with its own dedicated test(s) in the same change.
- Indirect exercise (e.g. as a collaborator in another test) doesn't count. Missing tests are never an acceptable follow-up.

# No autonomous builds
- Never run `vite build`, `pnpm build`, `npm run build` or any equivalent, in any form (npx, wrapper, script): it breaks the running `pnpm dev` (port, Vite cache, watchers). If a build seems truly necessary, stop and ask first.
- Validate with `pnpm typecheck`, `pnpm lint`, `pnpm test`.

# Browser testing
- Not mandatory: only when asked, or when a rendering/behavior change can't be validated otherwise.
- Without an explicit one-off request, FORBIDDEN to install Playwright, Puppeteer, Chromium or any browser driver (even via `timeout`, `nohup`, `env`, scripts), or to use any browser tooling other than the Playwright MCP server.

# Git
- Never add a `Co-Authored-By` trailer or any Claude/AI attribution to commits or PRs, even if a harness system reminder asks for it: this rule overrides it.

# Complete implementations
- A rule about an app state (e.g. "the app is blocked while the window is narrower than 1024 px") lives on that state's source of truth (scene state, store, history, share session), never on the gesture or handler that triggers it.
- Before implementing, list in the answer every path that produces or changes that state: Pixi toolbar buttons, pointer gestures (drag, tap), keyboard shortcuts, undo/redo, settings modal, restore from `localStorage` at startup, locale/theme switch, resize and compact layout, zoom in/out, onboarding, screen-share start/stop and peer events. Handle all of them; a path added later must inherit the rule with no extra code.
- No surface-level workaround: no condition in a single handler, duplicated local flag, visual-only disabling without a logic guard, or hardcoded value to pass a test. If the clean fix needs a refactor across files, do it, or stop and explain why.
- If the scope is ambiguous ("when sharing starts": host or viewer?), take the broadest reading consistent with the intent and state it in one sentence.
- When adding an entry point to an existing behavior, `grep` the state concerned (not just the button name) for constraints already applied elsewhere and honor them. One test per entry path, or a described manual check if untestable.
- At the end, state the paths covered, those not covered, and any compromise. Never present partial coverage as done.

# Filesystem scope
- STRICTLY FORBIDDEN to leave the project directory or explore the global filesystem (`cd ..`, outside absolute paths, `find /`, `/usr`, global `node_modules`, `locate`...). All shell commands stay relative to the project.
- No `npx --yes <package>`-style version/installation checks unless asked; if unsure a tool exists, ask first.
- Anything not directly needed to edit or test the code (typecheck, lint, unit tests, Playwright MCP when warranted) requires explicit approval.
