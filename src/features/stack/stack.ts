import { Card } from '../../types/card.types'
import { Position } from '../../types/position.types'
import { boxesOverlap, computeBoundingBox } from './stack-geometry'

/** Padding (in px) added around the stack bounding box highlight */
export const STACK_HIGHLIGHT_PADDING: number = 20

/** Height (in px) of the stack drag handle bar */
export const STACK_HANDLE_HEIGHT: number = 22

/** Size (in px) of the square stack compact button, next to the drag handle. Deliberately matches STACK_HANDLE_HEIGHT so it never looks smaller than the handle it sits beside. */
export const STACK_COMPACT_BUTTON_SIZE: number = STACK_HANDLE_HEIGHT

/** Gap (in px) between the stack drag handle and the compact button */
export const STACK_COMPACT_BUTTON_GAP: number = 16

/** Size (in px) of the square stack "name" button, mirroring the compact button on the other side of the handle */
export const STACK_NAME_BUTTON_SIZE: number = STACK_HANDLE_HEIGHT

/** Gap (in px) between the stack drag handle and the name button */
export const STACK_NAME_BUTTON_GAP: number = 16

/** Small breathing gap (in px) between the handle's bottom edge and the name label drawn just below it, so the label never overlaps the handle's clickable area. */
export const STACK_LABEL_HANDLE_GAP: number = 4

/**
 * Max width (in px) of both the persistent stack label and the inline name
 * editor, shared so the editor never grows wider than the stack's own frame
 * (the label truncates with an ellipsis past this width; the editor scrolls
 * its text like a native input instead, since it must stay fully editable).
 */
export const STACK_NAME_MAX_WIDTH: number = 325

/**
 * Minimum distance (in px) a stack's bounding box top must keep from the
 * canvas top edge, so its drag handle (which is drawn above the box) always
 * stays fully on-canvas and clickable.
 */
export const STACK_HANDLE_TOP_CLEARANCE: number = STACK_HIGHLIGHT_PADDING + STACK_HANDLE_HEIGHT / 2

function cardsOverlap(a: Card, b: Card): boolean {
    return boxesOverlap(a, b)
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
