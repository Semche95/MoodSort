# Setup commands
- Install deps: `pnpm install`
- Start dev server: `pnpm dev`
- Run tests: `pnpm test`

# Code style
- TypeScript strict mode
- Single quotes, no semicolons
- Use functional patterns where possible
- Don't use the `any` type
- Don't expose a class whose instance is built with `new` and immediately discarded: use a plain init function unless the instance is kept and its methods called later.
- Don't nest named functions inside another function to share its locals: that's a class in disguise. Extract them to top-level functions taking the shared state as an explicit parameter.
- File and folder names are always kebab-case, no exceptions for files that export a class (`stack-overlay.ts`, not `StackOverlay.ts`). PascalCase is reserved for the TypeScript identifiers (class names, types) exported from those files.

# Project structure conventions
- `controllers/`: stateful orchestrators that own a slice of Pixi/DOM state (app, stage, listeners, lifecycle) and coordinate other components, delegating persistence to `services/` and computation to `utils/`. May depend on `types/`, `services/`, `utils/`, `ui/`, and other `controllers/`. If a controller has multiple responsibilities and outgrows one file (e.g. orchestration vs. pure Pixi drawing/animation helpers), split it into a subfolder named after the controller (e.g. `controllers/stack-overlay/`) instead of overloading a single file.
- `services/`: framework-agnostic (no `pixi.js` import, not even a `Card` param, since it extends Pixi's `Container`). Plain-data in, plain-data out; Pixi-facing translation belongs in `controllers/`/`utils/`, never here.
- `types/`: one type or interface per file, named `<concept>.types.ts`. Only group declarations when inseparable in practice (e.g. `card-state.types.ts` pairs `CardState` with the storage-key constants it's always used with). No interface lives inline in `controllers/`, `services/`, or `ui/`.
- `ui/`: one file per interface element (toolbar, tooltip, modal, onboarding), each exposed through a single creation/init function. May build real DOM (`HTMLElement`) or Pixi canvas elements, whichever the element needs. No mixing unrelated elements in one file, no generic bootstrap glue. If an element has multiple responsibilities and outgrows one file (e.g. state/behavior vs. pure view builders), split it into a subfolder named after the element (e.g. `ui/top-toolbar/`) instead of overloading a single file.
- `utils/`: stateless, computation-only functions — no owned state, listeners, DOM, or side effects; same input always gives same output, testable by calling directly. Never imports from `controllers/`.

# Test coverage
- Every new file that exports a class or a function must ship with its own dedicated test(s) in the same change, covering that class or function directly, not just incidentally through some other test.
- Every new function or method added to an existing file must get its own test(s) too, even if the file already has a test suite for other parts of it.
- A class or function being exercised indirectly (e.g. a service instantiated as a collaborator inside another class's test) does not count as coverage for it. Only a test that targets it directly does.
- Do not treat missing tests as an acceptable follow-up or a "nice to have": a new file or function isn't done until it has one.

# No autonomous build commands

Do NOT run `vite build`, `pnpm build`, `npm run build`, or any equivalent production-build command on your own initiative, in any form (direct, via `npx`, via a wrapper, via a script).

Reason: `pnpm dev` is expected to be running continuously in this project. A concurrent build process conflicts with the dev server (port usage, Vite cache, file watchers) and breaks it.

The only way to validate changes is: `pnpm typecheck`, `pnpm lint`, `pnpm test`. If you believe a production build is genuinely necessary to verify something, STOP and ask me explicitly first — do not run it preemptively "just to check."

# Strict prohibition: browser automation

It is FORBIDDEN, without my explicit, one-off request, to:
- Install Playwright, Puppeteer, headless Chromium, or any browser driver (`pnpm exec playwright install`, `npx playwright install`, etc.), even through a wrapper command (`timeout`, `nohup`, `env`, an intermediate script...)
- Write a "driver script" or any script whose purpose is to launch the app in a browser to "exercise", "visually verify", "test the flow", or "make sure it works"
- Justify installing a browser by a successful exit code or by the need to "validate" a change

If you think a visual check would be useful, STOP and ask me explicitly before running anything browser-related. Do not propose a workaround (a different headless tool, a different package manager, a custom script that invokes a browser under the hood).

The only automated validation that is acceptable is: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Nothing else counts as valid proof that something works without my approval.

# Filesystem scope
- STRICTLY FORBIDDEN to leave the project directory (`cd ..`, absolute paths outside the repo, `find /`, etc.)
- Never explore, list, or search the global filesystem (`/`, `/usr`, `/opt`, global `node_modules`, etc.)
- Every shell command must stay relative to the project directory

## System discovery commands
- Do not run `npx --yes <package>`-style commands to "check" a version or installation unless asked
- Do not run `find`, `locate`, or equivalents outside the project directory
- If unsure whether a tool is available, ask before running an exploratory command

## General principle
If an action is not directly necessary to edit or test the project's code (typecheck, lint, unit tests), do not run it without my explicit approval.
