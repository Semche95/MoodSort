import { Card } from '../../types/card.types'
import { Position } from '../../types/position.types'
import { computeBoundingBox } from './stack-geometry'
import {
    STACK_HIGHLIGHT_PADDING,
    STACK_HANDLE_HEIGHT,
    STACK_COMPACT_BUTTON_SIZE,
    STACK_COMPACT_BUTTON_GAP,
    STACK_NAME_BUTTON_SIZE,
    STACK_NAME_BUTTON_GAP,
} from './stack'

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

// Sits symmetrically opposite the compact button, on the other side of the handle. Unlike
// the compact button, it applies to single-card "stacks" too: a lone anchor must stay renameable.
export function computeNameButtonBox(
    stack: Card[],
): { x: number; y: number; width: number; height: number } {
    const box = computeBoundingBox(stack)
    const pad = STACK_HIGHLIGHT_PADDING
    const bx = box.x - pad
    const by = box.y - pad
    const bw = box.width + pad * 2
    const handleWidth = Math.min(bw, 80)
    const hx = bx + (bw - handleWidth) / 2
    const hy = by - STACK_HANDLE_HEIGHT / 2

    return {
        x: hx - STACK_NAME_BUTTON_GAP - STACK_NAME_BUTTON_SIZE,
        y: hy + (STACK_HANDLE_HEIGHT - STACK_NAME_BUTTON_SIZE) / 2,
        width: STACK_NAME_BUTTON_SIZE,
        height: STACK_NAME_BUTTON_SIZE,
    }
}

export function findStackByNameButtonAtPoint(stacks: Card[][], point: Position): Card[] | null {
    for (const stack of stacks) {
        const box = computeNameButtonBox(stack)
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
