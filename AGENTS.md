# AGENTS.md

## Setup commands
- Install deps: `pnpm install`
- Start dev server: `pnpm dev`
- Run tests: `pnpm test`

## Code style
- TypeScript strict mode
- Single quotes, no semicolons
- Use functional patterns where possible
- Don't use the `any` type

## No autonomous build commands

Do NOT run `vite build`, `pnpm build`, `npm run build`, or any equivalent production-build command on your own initiative, in any form (direct, via `npx`, via a wrapper, via a script).

Reason: `pnpm dev` is expected to be running continuously in this project. A concurrent build process conflicts with the dev server (port usage, Vite cache, file watchers) and breaks it.

The only way to validate changes is: `pnpm typecheck`, `pnpm lint`, `pnpm test`. If you believe a production build is genuinely necessary to verify something, STOP and ask me explicitly first — do not run it preemptively "just to check."

## Strict prohibition: browser automation

It is FORBIDDEN, without my explicit, one-off request, to:
- Install Playwright, Puppeteer, headless Chromium, or any browser driver (`pnpm exec playwright install`, `npx playwright install`, etc.), even through a wrapper command (`timeout`, `nohup`, `env`, an intermediate script...)
- Write a "driver script" or any script whose purpose is to launch the app in a browser to "exercise", "visually verify", "test the flow", or "make sure it works"
- Justify installing a browser by a successful exit code or by the need to "validate" a change

If you think a visual check would be useful, STOP and ask me explicitly before running anything browser-related. Do not propose a workaround (a different headless tool, a different package manager, a custom script that invokes a browser under the hood).

The only automated validation that is acceptable is: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Nothing else counts as valid proof that something works without my approval.

## Filesystem scope
- STRICTLY FORBIDDEN to leave the project directory (`cd ..`, absolute paths outside the repo, `find /`, etc.)
- Never explore, list, or search the global filesystem (`/`, `/usr`, `/opt`, global `node_modules`, etc.)
- Every shell command must stay relative to the project directory

### System discovery commands
- Do not run `npx --yes <package>`-style commands to "check" a version or installation unless asked
- Do not run `find`, `locate`, or equivalents outside the project directory
- If unsure whether a tool is available, ask before running an exploratory command

### General principle
If an action is not directly necessary to edit or test the project's code (typecheck, lint, unit tests), do not run it without my explicit approval.
