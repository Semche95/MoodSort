import { Card } from '../../types/card.types'
import { Position } from '../../types/position.types'
import { Box } from '../../types/box.types'
import { boxesOverlap, computeBoundingBox } from './stack-geometry'

/** Padding (in px) between a stack's cards and its dashed frame */
export const STACK_HIGHLIGHT_PADDING: number = 20

/** Corner radius (in px) of a stack's dashed frame */
export const STACK_FRAME_RADIUS: number = 24

/** Height (in px) of the pills centered on a stack frame's top (handle, name, rename) and bottom (actions) edges */
export const STACK_PILL_HEIGHT: number = 32

/** Inner horizontal padding (in px) of a stack pill */
export const STACK_PILL_PADDING: number = 4

/** Width (in px) of a button slot in a stack pill (rename, compact) */
export const STACK_PILL_ICON_WIDTH: number = 30

/** Width (in px) of the grip slot, wider than a button so a nameless pill still offers a comfortable handle */
export const STACK_PILL_GRIP_WIDTH: number = 40

/** Horizontal padding (in px) around the stack name inside its pill */
export const STACK_PILL_NAME_PADDING: number = 8

export const STACK_NAME_FONT_FAMILY: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

/** Shared by the name shown in the pill and the inline editor, so a name reads the same while typed and once committed */
export const STACK_NAME_FONT_SIZE: number = 14

/**
 * Minimum distance (in px) a stack's bounding box must keep from the canvas
 * top and bottom edges, so the pills centered on its frame's top and bottom
 * edges always stay fully on-canvas and clickable.
 */
export const STACK_FRAME_CLEARANCE: number = STACK_HIGHLIGHT_PADDING + STACK_PILL_HEIGHT / 2

/** Reading a card's size makes Pixi recompute its bounds, far too costly for a pairwise flood fill run every frame. */
function snapshotBoxes(cards: Card[]): Map<Card, Box> {
    return new Map(cards.map((card: Card): [Card, Box] => [card, { x: card.x, y: card.y, width: card.width, height: card.height }]))
}

function floodFillStack(card: Card, allCards: Card[], boxes: Map<Card, Box>): Card[] {
    const stack: Card[] = []
    const visited = new Set<Card>()
    const queue = [card]
    while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        stack.push(current)
        for (const other of allCards) {
            if (!visited.has(other) && boxesOverlap(boxes.get(current)!, boxes.get(other)!)) {
                queue.push(other)
            }
        }
    }
    return stack
}

export function findStack(card: Card, allCards: Card[]): Card[] {
    return floodFillStack(card, allCards, snapshotBoxes([card, ...allCards]))
}

export function computeStacks(cards: Card[]): Card[][] {
    const boxes = snapshotBoxes(cards)
    const stacks: Card[][] = []
    const assigned = new Set<Card>()
    for (const card of cards) {
        if (assigned.has(card)) {
            continue
        }
        const stack = floodFillStack(card, cards, boxes)
        stacks.push(stack)
        for (const c of stack) {
            assigned.add(c)
        }
    }
    return stacks
}

export function findStackAtPoint(stacks: Card[][], point: Position): Card[] | null {
    for (const stack of stacks) {
        const box = computeBoundingBox(stack)
        if (
            point.x >= box.x - STACK_HIGHLIGHT_PADDING &&
            point.x <= box.x + box.width + STACK_HIGHLIGHT_PADDING &&
            point.y >= box.y - STACK_FRAME_CLEARANCE &&
            point.y <= box.y + box.height + STACK_FRAME_CLEARANCE
        ) {
            return stack
        }
    }
    return null
}
