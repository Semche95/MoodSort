# MoodSort

A visual emotion exploration tool. 85 emotion cards on a full-screen canvas, arranged freely to compose your inner landscape.

## Features

- Drag and drop cards freely across the canvas
- Overlapping cards form stacks, with a highlight, a drag handle, and a hover-only button to re-gather the stack around its top card
- Undo/redo (toolbar buttons, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y), persisted across sessions
- Positions and history are saved to `localStorage` and restored on the next visit
- Cards reposition proportionally when the window is resized
- Reset animates cards back to the center
- First-time onboarding overlay
- Footer link to a legal notices modal (LCEN)
- Everything stays in the browser: nothing is sent or stored externally

## Tech stack

TypeScript (strict), PixiJS 8 for rendering, `@pixi/ui` for the toolbar buttons, Vite for dev/build, Vitest for tests. `sharp` generates the card atlas and toolbar icons at build time.

## Getting started

```bash
pnpm install
pnpm dev
```

Runs at `http://localhost:5173`.

## Scripts

`pnpm dev` and `pnpm build` regenerate two things before starting: the card spritesheet atlas (`src/assets/atlas.webp` + `atlas.json`, built from `src/cards/`) and the toolbar icons (`src/assets/icons/`, rasterized from `lucide-static`). Both outputs are git-ignored.

| Command | Description |
|---|---|
| `pnpm atlas` | Regenerate the card atlas |
| `pnpm icons` | Regenerate the toolbar icons |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Preview the production build |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm lint` / `pnpm lint:fix` | Lint |

## Project structure

```
scripts/       # Atlas and icon generation
src/
  cards/        # 85 source card images
  assets/       # Generated atlas + icons (git-ignored)
  controllers/  # Canvas orchestration, drag, stacks, persistence
  types/        # Card, drag, and position types
  utils/        # Card/stack helpers, canvas helpers, constants
  services/     # Storage and undo/redo history
  ui/           # Toolbar, tooltip, settings, onboarding, legal modal
  __tests__/
```

## Architecture

### Cards

A `Card` is a Pixi `Container` with an image sprite and a blurred drop-shadow layer. All cards are cut from a single pre-built atlas (`atlas.webp` + `atlas.json`), loaded once in `main.ts` and handed to `CardManager` as frame names + textures. No per-card loading at runtime. Scaling is proportional to a 2560px reference width.

### Stacks

Stacks aren't a real entity, just cards whose bounding boxes overlap. `computeStacks` finds them on the fly with a BFS over `cardsOverlap`.

Hovering a stack draws a highlight border (padded 20px) and a handle bar above it that stays clickable even when cards cover the space. A second, hover-only button next to the handle collapses the stack: it re-gathers every card tightly around the current top card without disturbing z-order.

Dragging the handle (or the border) reparents the whole stack to the top of the stage, in the z-order the user already established by clicking individual cards. While dragging, `findMergeTargets` checks AABB overlap against every other stack and highlights all matches at once (dark overlay, border, `+` marker), with the dragged cards always rendered on top. On release, stacks are recomputed and positions saved.

### Drag and drop

`DragController` handles the single-card lifecycle: reparent to stage, follow the cursor, clamp to the viewport, snap back if nothing moved, drop opacity to 50% while dragging. `DragHandler` wires it to the stage and captures undo history around each drag.

### Persistence and history

`Store` is a plain `localStorage` wrapper with no app knowledge. `CardStateService` uses it to persist positions, z-order, and onboarding status under one key. `PositionPersistence` reads positions off the stage and writes them back, and on first load transparently migrates the old Vite-hashed URL keys (e.g. `/assets/abandon-kDvhRWIr.webp`) to atlas frame names (e.g. `abandon`). Undo history is cleared if a migration happened, since old snapshots would reference stale keys.

`ActionHistory` snapshots positions and z-index before/after each drag (one mousedown→mouseup = one action), keeping up to 15 undo entries plus a redo stack, both persisted. Any new action clears redo. Both `DragHandler` and `StackDragManager` feed it; `CanvasController` exposes `undo()`, `redo()`, `canUndo`/`canRedo`, and a history-change callback for the toolbar.

### Toolbar

`TopToolbar` renders directly on the Pixi canvas rather than as HTML: a logo on the left, and undo/redo/help/settings buttons on the right that stay pinned on resize. Hovering a button shows a `CanvasTooltip`, a small reusable rounded label. Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y) are wired independently in `initHistoryShortcuts`.

### Reset animation

Reset shuffles the card order, computes new target positions, then `CanvasController.animateTargets` (also used by stack compacting) eases them there over 20 frames before saving and recomputing stacks.

## License

MIT, Robin Rateau, 2026
