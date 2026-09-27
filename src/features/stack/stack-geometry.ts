import { Card } from '../../types/card.types'
import { Position } from '../../types/position.types'
import { Box } from '../../types/box.types'
import { constrainPosition } from '../../shared/utils/geometry'
import { STACK_HANDLE_TOP_CLEARANCE } from './stack'

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

/**
 * Generic axis-aligned bounding box overlap test, shared by every collision
 * check in this file (stack flood-fill, merge-target detection) so a new
 * kind of overlap check (e.g. a dragged card against a label's own render
 * area) can reuse it instead of duplicating the test.
 */
export function boxesOverlap(a: Box, b: Box): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    )
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
