import { Card } from '../../types/card.types'
import { computeBoundingBox, boxesOverlap } from './stack-geometry'

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
        if (boxesOverlap(draggedBox, box)) {
            targets.push(stack)
        }
    }
    return targets
}
