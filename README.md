# MoodSort

A visual emotion exploration tool. Load 85 emotion cards onto a full-screen canvas and arrange them freely to compose your inner landscape.

## Features

- **Drag and drop** — freely move cards across the canvas
- **Stacks** — overlapping cards form visual stacks with highlight, handle bar, and merge feedback
- **Auto-persistence** — card positions are saved to `localStorage` and restored on the next visit
- **Responsive resizing** — cards are repositioned proportionally when the browser window is resized
- **Animated reset** — cards travel back to the center with an ease-out cubic animation
- **Onboarding** — a welcome guide explains the app to first-time users
- **Privacy** — all data stays in your browser; nothing is sent or stored externally

## Tech Stack

| Technology | Role |
|---|---|
| TypeScript ~5.7 | Primary language (strict mode) |
| PixiJS ^8.10 | 2D rendering engine (WebGL canvas) |
| Vite ^6.1 | Dev server and production bundler |
| Vitest ^3.2 | Test framework |
| ESLint ^8.57 | Linting with strict TypeScript rules |

Only runtime dependency: `pixi.js`.

## Getting Started

```bash
pnpm install
pnpm dev
```

The app runs at `http://localhost:5173`.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Type-check then build for production |
| `pnpm preview` | Preview the production build |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm lint` | Lint the codebase |
| `pnpm lint:fix` | Lint and auto-fix |

## Project Structure

```
src/
  main.ts                    # Entry point
  style.css                  # Global styles
  cards/                     # 85 .webp images (one per emotion)
  controllers/
    CanvasController.ts      # Orchestrator: init, reset, resize, event wiring
    StackDragManager.ts      # Stack drag state machine + merge detection
    StackOverlay.ts          # Graphics rendering: highlight, handle, merge indicators
    CardManager.ts           # Card creation, scaling, placement, order
    DragController.ts        # State machine for card drag and drop
    DragHandler.ts           # Card drag callback chain + stage wiring
    PositionPersistence.ts   # Read/write card positions via CardStateService
  types/
    card.types.ts            # Card, CardState, AnimationTarget interfaces + storage keys
    drag.types.ts            # CardDragState interface
    position.types.ts        # Position {x, y} interface
  utils/
    card.ts                  # constrainPosition, createCard, findStack, computeBoundingBox
    stack.ts                 # computeStacks, findStackAtPoint, findMergeTargets
    canvas.ts                # DOM helpers: overlay, header, toolbar, onboarding
    constants.ts             # Constants (opacity, reference width, stack highlight dimensions)
  services/
    Store.ts                 # Generic localStorage wrapper + InMemoryStore
    CardStateService.ts      # CardState persistence (positions, order, onboarding)
  ui/
    settings.ts              # Settings button and modal
    onboarding.ts            # Onboarding overlay and help button
  __tests__/                 # 32 tests covering cards, drag, canvas, store
```

## Architecture

### Cards

Each `Card` is a PixiJS `Container` holding an image sprite and a drop-shadow layer (Graphics + BlurFilter). Cards scale proportionally based on a 2560 px reference width. `CardManager` owns all card creation, placement, and scaling logic.

### Stacks

When cards overlap, they form a **stack** — a purely visual grouping with no dedicated entity. Stacks are computed on-the-fly by `computeStacks` using a BFS that follows `cardsOverlap` relations.

Each stack gets a **highlight** on hover: a border around the bounding box (with `STACK_HIGHLIGHT_PADDING` of 20 px) and a **handle bar** at the top (a draggable grip with 3 lines, `STACK_HANDLE_HEIGHT` of 22 px). The handle extends above the bounding box so it remains visible even when cards fill the space.

**Stack drag** — clicking the handle (or the empty border area) initiates a stack drag. All cards in the stack are reparented to the top of the stage while preserving their relative z-order. Cards maintain the order established by previous individual clicks (e.g. bringing a specific card to front).

**Merge detection** — while dragging, `findMergeTargets` checks AABB overlap between the dragged stack's bounding box and every other stack. All overlapping stacks are highlighted simultaneously with:
- A dark overlay (`alpha: 0.15`) covering the target area
- A border around each target
- A `+` symbol at the center of each target

The dragged cards and the `+` symbol are always rendered above the dark overlay. On release, stacks are recomputed and positions are persisted.

### Drag and Drop

`DragController` manages a full lifecycle: reparenting to the stage, cursor tracking, viewport boundary clamping, and snap-back if the card was not moved. Opacity drops to 50% during drag. `DragHandler` wires the drag callbacks to the PixiJS stage.

### Persistence

`Store` is a generic, app-agnostic `localStorage` wrapper. `CardStateService` uses it to persist `CardState` (positions, order, onboarding status) under a single key. `PositionPersistence` reads card positions from the stage and saves them. Storage keys (`POSITIONS_KEY`, `ORDER_KEY`, `ONBOARDING_KEY`) are typed constants defined in `card.types.ts`.

### Reset Animation

When the user resets card positions, `CardManager.shuffleAndBuildTargets` shuffles the card array in-place and computes animation targets. `CanvasController.animateToCenter` drives a ticker-based ease-out cubic animation over 20 frames, then saves the new positions and recomputes stacks.

## License

MIT — Robin Rateau, 2026
