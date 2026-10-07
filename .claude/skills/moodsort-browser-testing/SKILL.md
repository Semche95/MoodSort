---
name: moodsort-browser-testing
description: Tests MoodSort in the browser through the Playwright MCP server (mcp__playwright__*). Use only when the user asks for a browser test, or when a rendering or behavior change can't be validated by typecheck, lint and unit tests.
---

# MoodSort browser testing (Playwright MCP)

Optional, complements `pnpm typecheck`, `pnpm lint` and `pnpm test` without replacing them. If skipped after a visual change, say so.

## Environment
- Target: the already-running dev server, `http://localhost:5170/` (`vite.config.ts`). Never another server, never a build.
- Dark mode required (Chromium flags `--force-dark-mode`, `--enable-features=WebUIDarkMode`). MCP tools don't accept per-call Chromium arguments: if the MCP server config lacks them, report it instead of running without.

## Execution
- Onboarding modal: close it with "Get started", never remove it from the DOM.
- Toolbar and cards are drawn in Pixi, absent from the DOM: click by coordinates, computed from the layout constants in `src/features/toolbar/toolbar-view.ts`.
- Read state via `browser_evaluate`. Screenshot only when a visual check requires it.
- Restore any changed setting (theme, language, viewport...).

## Report
- List precisely what was checked.
- List what the automated browser can't reproduce (native Escape leaving fullscreen, real window resize...), for manual checking.
