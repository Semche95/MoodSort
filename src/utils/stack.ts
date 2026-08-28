import { Card } from '../types/card.types'
import { Position } from '../types/position.types'
import { findStack, computeBoundingBox } from './card'
import {
    STACK_HIGHLIGHT_PADDING,
    STACK_HANDLE_HEIGHT,
    STACK_COMPACT_BUTTON_SIZE,
    STACK_COMPACT_BUTTON_GAP,
} from './constants'

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

/**
 * Bounding box of the stack compact button, positioned next to the drag
 * handle. Returns null for stacks with fewer than 2 cards, since the compact
 * button is only relevant for actual stacks.
 */
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
