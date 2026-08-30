import { Card } from '../../types/card.types'
import { Position } from '../../types/position.types'
import { constrainPosition } from '../../shared/utils/geometry'

/** Padding (in px) added around the stack bounding box highlight */
export const STACK_HIGHLIGHT_PADDING: number = 20

/** Height (in px) of the stack drag handle bar */
export const STACK_HANDLE_HEIGHT: number = 22

/** Size (in px) of the square stack compact button, next to the drag handle */
export const STACK_COMPACT_BUTTON_SIZE: number = 22

/** Gap (in px) between the stack drag handle and the compact button */
export const STACK_COMPACT_BUTTON_GAP: number = 16

/**
 * Minimum distance (in px) a stack's bounding box top must keep from the
 * canvas top edge, so its drag handle (which is drawn above the box) always
 * stays fully on-canvas and clickable.
 */
export const STACK_HANDLE_TOP_CLEARANCE: number = STACK_HIGHLIGHT_PADDING + STACK_HANDLE_HEIGHT / 2

/**
 * Clamps a candidate (x, y) to the canvas for a card-sized object, reserving
 * STACK_HANDLE_TOP_CLEARANCE at the top. Every place that positions a card
 * (drag, load, resize, shuffle, compact) needs this same clamp, so this
 * wraps constrainPosition to avoid repeating its card-specific arguments at
 * every call site.
 */
export function clampCardPosition(
    x: number,
    y: number,
    card: { width: number; height: number },
    appWidth: number,
    appHeight: number,
): Position {
    return constrainPosition(x, y, card.width, card.height, appWidth, appHeight, STACK_HANDLE_TOP_CLEARANCE)
}

function cardsOverlap(a: Card, b: Card): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    )
}

export function findStack(card: Card, allCards: Card[]): Card[] {
    const stack: Card[] = []
    const visited = new Set<Card>()
    const queue = [card]
    while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        stack.push(current)
        for (const other of allCards) {
            if (!visited.has(other) && cardsOverlap(current, other)) {
                queue.push(other)
            }
        }
    }
    return stack
}

export function computeBoundingBox(cards: Card[]): { x: number; y: number; width: number; height: number } {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const card of cards) {
        minX = Math.min(minX, card.x)
        minY = Math.min(minY, card.y)
        maxX = Math.max(maxX, card.x + card.width)
        maxY = Math.max(maxY, card.y + card.height)
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function computeStacks(cards: Card[]): Card[][] {
    const stacks: Card[][] = []
    const assigned = new Set<Card>()
    for (const card of cards) {
        if (assigned.has(card)) {
            continue
        }
        const stack = findStack(card, cards)
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
            point.y >= box.y - STACK_HIGHLIGHT_PADDING - STACK_HANDLE_HEIGHT &&
            point.y <= box.y + box.height + STACK_HIGHLIGHT_PADDING
        ) {
            return stack
        }
    }
    return null
}

// Returns null for stacks with fewer than 2 cards: the compact button only makes sense on an actual stack.
export function computeCompactButtonBox(
    stack: Card[],
): { x: number; y: number; width: number; height: number } | null {
    if (stack.length < 2) {
        return null
    }
    const box = computeBoundingBox(stack)
    const pad = STACK_HIGHLIGHT_PADDING
    const bx = box.x - pad
    const by = box.y - pad
    const bw = box.width + pad * 2
    const handleWidth = Math.min(bw, 80)
    const hx = bx + (bw - handleWidth) / 2
    const hy = by - STACK_HANDLE_HEIGHT / 2

    return {
        x: hx + handleWidth + STACK_COMPACT_BUTTON_GAP,
        y: hy + (STACK_HANDLE_HEIGHT - STACK_COMPACT_BUTTON_SIZE) / 2,
        width: STACK_COMPACT_BUTTON_SIZE,
        height: STACK_COMPACT_BUTTON_SIZE,
    }
}

export function findStackByCompactButtonAtPoint(stacks: Card[][], point: Position): Card[] | null {
    for (const stack of stacks) {
        const box = computeCompactButtonBox(stack)
        if (!box) {
            continue
        }
        if (
            point.x >= box.x &&
            point.x <= box.x + box.width &&
            point.y >= box.y &&
            point.y <= box.y + box.height
        ) {
            return stack
        }
    }
    return null
}

/**
 * A dragged group moves as one rigid block, so it must be clamped as a
 * whole rather than per-card (otherwise cards would drift apart when the
 * clamp kicks in for some of them but not others). Returns the x/y offset
 * to add to every card in the group to keep its bounding box within the
 * canvas, reserving STACK_HANDLE_TOP_CLEARANCE at the top for the drag
 * handle drawn above it.
 */
export function computeGroupClampOffset(cards: Card[], appWidth: number, appHeight: number): Position {
    const box = computeBoundingBox(cards)
    let x = 0
    let y = 0
    if (box.x < 0) {
        x = -box.x
    } else if (box.x + box.width > appWidth) {
        x = appWidth - (box.x + box.width)
    }
    if (box.y < STACK_HANDLE_TOP_CLEARANCE) {
        y = STACK_HANDLE_TOP_CLEARANCE - box.y
    } else if (box.y + box.height > appHeight) {
        y = appHeight - (box.y + box.height)
    }
    return { x, y }
}

export function findMergeTargets(
    draggedStack: Card[],
    stacks: Card[][],
    sourceStack: Card[] | null,
): Card[][] {
    const draggedBox = computeBoundingBox(draggedStack)
    const targets: Card[][] = []
    for (const stack of stacks) {
        if (stack === sourceStack) {
            continue
        }
        const box = computeBoundingBox(stack)
        if (
            draggedBox.x < box.x + box.width &&
            draggedBox.x + draggedBox.width > box.x &&
            draggedBox.y < box.y + box.height &&
            draggedBox.y + draggedBox.height > box.y
        ) {
            targets.push(stack)
        }
    }
    return targets
}
