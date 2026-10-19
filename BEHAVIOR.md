# MoodSort behavior

How the app behaves and the business rules it must keep. The README covers setup and architecture; this file is the reference for what the user sees and which invariants every change must preserve.

## Canvas and screen

- Everything a share viewer must see is drawn on the single Pixi canvas; only host-local UI (settings modal, legal modal) is DOM.
- Below 1024px wide, a full-screen overlay blocks any use of the app. It re-checks live on resize and tablet rotation, unlocking or locking without a reload.
- The logo and wordmark never look pixelated or blurry, at any zoom level or pixel density.

## Cards

- The topmost card under the pointer gets an accent outline, none while a stack is carried or while Ctrl/Cmd is held over it. The outline follows cards moving under a still pointer and never stays on a card the pointer left.
- A held card lifts off the table (slight zoom, deeper shadow) and settles back on release. Lifting never changes stacking, clamping or saved positions.
- Cards are clamped to the canvas.
- Each pile casts one shadow, never darker where its cards overlap.

## Stacks

- A stack is any group of cards whose bounds overlap; a lone card is a stack too.
- Every stack always shows a dashed rounded frame and, on its top edge, a pill holding the drag grip, the stack's name if any, and a rename pencil.
- A name never makes the pill wider than the frame's straight edge: it is cut with an ellipsis and shown in full in a tooltip on hover. The pencil's slot is always reserved, so the name never reflows.
- Hovering a stack tints its frame with the accent and brings the pencil to full opacity. For two or more cards, it also shows a pill on the bottom edge whose button re-gathers every card around the top card, keeping their z-order.
- A resting stack's pill, name and pencil sit under every card: an overlapping neighbour pile covers them as a whole.
- Every placement keeps enough room above and below a stack's cards for both pills to stay on-canvas.

## Moving cards and stacks

- Pressing a card carries that card; pressing a stack's grip or frame, or anywhere within its frame with Ctrl/Cmd held (cards and gaps between them alike, but not its rename or re-gather buttons, which keep their own action), carries the whole stack. Where frames overlap, the card on top decides which stack. This is decided once, at press time.
- While Ctrl/Cmd is held anywhere a press would carry a stack, with no drag or re-gathering under way, its grip lights up (hover chip, accent dots) and the cursor is a grab hand. Both follow the key as it goes down or up under a still pointer, and turn off when the window loses focus. Hovering the grip alone does not light it.
- The cursor stays a closed hand for as long as a stack is carried, whatever passes under it.
- A carried stack keeps the z-order the user set between its cards.
- The canvas context menu is suppressed during any drag (macOS turns Ctrl+click into a right click).
- While dragging, every stack the dragged cards overlap is a merge target: accent frame, light accent wash and a `+` marker.
- Z-order during a drag, bottom to top: resting cards and their overlays, the dragged cards with their own frame, pill and name, then the `+` of every merge target. The `+` always stays visible above the cards about to land on it, whether a whole stack or a single card is dragged, on every frame of the drag.
- A card dragged out of a pile leaves the pile's frames in place until it is dropped.
- A press that moves nothing snaps the card back.

## Stack names

- The pencil opens an inline editor over the pill, with native paste and IME support and a clear button. It never grows wider than the frame; longer text scrolls horizontally to keep the caret visible.
- Clicking elsewhere commits a pending edit.
- When named stacks merge, their names are fused into one `" + "`-joined name.
- When a named stack splits, the name follows the largest resulting group. While a card is being dragged out, the pile left behind already shows the name on that group.
- A name fusion or reassignment is its own undo/redo entry, separate from the move that caused it.

## Undo and redo

- Available from the toolbar and from Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y.
- One press-to-release gesture is one action. Up to 50 undo entries are kept; any new action clears redo. Both stacks persist across sessions.
- Undoing or redoing puts a card that was moved off a pile back on that same pile, whatever resize happened since. Other cards are rescaled to the current canvas, then every stack is clamped.

## Persistence

- Positions, z-order, stack names, history, onboarding status, locale and theme persist to `localStorage` only. Nothing leaves the browser except an active screen share.
- On resize, and on load in a differently sized window, each stack moves as one block: piles never split or merge on their own. Piles that end up clamped together are fused like a merge, names included.

## Reset

- Reset, from the settings modal, requires a confirmation step. It shuffles the cards and animates them back to the center.

## Onboarding

- First visit shows an onboarding overlay. Right after it is first closed, the top card slides out of the pile and back twice to show cards can be moved.
- Under `prefers-reduced-motion`, that hint is skipped and card lifts are instant.

## Language and theme

- The locale is auto-detected from the browser on first launch (English fallback) and switchable from the toolbar's globe; the choice persists. Switching reloads the page.
- The theme (Light/Dark/Auto) is set in the settings modal and persists. Switching swaps the cards in place, with no reload.

## Fullscreen

- The fullscreen button only appears when the browser supports the Fullscreen API. The whole page goes fullscreen so modals stay usable; leaving with Escape updates the button. Fullscreen is never restored on load.

## Screen sharing

- Only the app's canvas is streamed, never the rest of the host's screen. Peer-to-peer over WebRTC, no account, no server-side storage or relay of app state.
- One host and one viewer per room; a second viewer is rejected. A room with no connected peer for 10 minutes is torn down.
- Resetting the canvas doesn't end an active share, and a page refresh silently resumes it.
- If WebRTC can't gather any connection candidate (privacy extension, VPN, browser policy), the viewer shows an explanation instead of waiting forever, and the host can't turn sharing on.
- An active share keeps streaming at the new canvas size after a resize or fullscreen change.
