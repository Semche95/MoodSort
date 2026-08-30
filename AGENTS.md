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
- `app/`: composition root only — entry point and the top-level scene that ties features together. No business logic here beyond wiring; delegate to `features/`.
- `features/`: one folder per feature (card, drag, stack, history, toolbar, onboarding, settings, footer). Each feature is organized by domain, not by technical layer — no service/controller/ui split inside a feature. Constants used only within one feature live directly in that feature's main file, not in a separate `constants.ts`. If a feature file has multiple responsibilities and outgrows itself (e.g. orchestration vs. pure Pixi drawing/animation helpers), split it into a subfolder named after the feature (e.g. `features/stack/stack-overlay/`) instead of overloading a single file.
- `shared/`: code used by two or more features — cross-feature UI widgets in `shared/ui/`, stateless utility functions in `shared/utils/`. Don't move something here preemptively; wait until a second feature actually needs it.
- `types/`: one type or interface per file, named `<concept>.types.ts`. Only group declarations when inseparable in practice (e.g. `card-state.types.ts` pairs `CardState` with the storage-key constants it's always used with). No interface lives inline in `app/`, `features/`, or `shared/`.

# Consistency check on every code change
- After any code modification, verify that the tests touched or added are pertinent: no redundant tests, no misleading titles, each test targeting what it claims to target.
- After any code modification, verify that README.md still accurately reflects the current behavior and structure of the project; update it if it has drifted.
- Any code touching card or stack positioning (drag, drop, load, resize, shuffle, compact, merge, or any future placement logic) must keep the stack drag handle fully on-canvas. The handle is drawn above a stack's bounding box, so a card or stack must never be positioned closer to the canvas top edge than `STACK_HANDLE_TOP_CLEARANCE` (see `features/stack/stack.ts`); use `clampCardPosition`/`computeGroupClampOffset` (or extend them) rather than clamping positions directly against the raw canvas bounds.
- All GitHub Actions workflow files (`.github/workflows/*.yml`) must use the same versions for shared actions across every workflow: the same `node-version` in every `actions/setup-node` step, the same `pnpm/action-setup` action version and `version` (pnpm version) in every `pnpm/action-setup` step, and the same `actions/checkout` and `actions/setup-node` action version tags (e.g. `@v7`). When adding or editing a workflow, check the others and match the existing versions rather than picking new ones.

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
