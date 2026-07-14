import { Card } from '../types/card.types'
import { Position } from '../types/position.types'
import { findStack, computeBoundingBox } from './card'
import { STACK_HIGHLIGHT_PADDING, STACK_HANDLE_HEIGHT } from './constants'

export function computeStacks(cards: Card[]): Card[][] {
    const stacks: Card[][] = []
    const assigned: Set<Card> = new Set()
    for (const card of cards) {
        if (assigned.has(card)) {
            continue
        }
        const stack: Card[] = findStack(card, cards)
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
