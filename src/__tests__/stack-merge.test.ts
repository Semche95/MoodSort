import { describe, it, expect } from 'vitest'
import { findMergeTargets } from '../features/stack/stack-merge'
import { Card } from '../types/card.types'

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { x, y, width, height, imageUrl } as unknown as Card
}

describe('findMergeTargets', () => {
    it('finds stacks whose bounding box overlaps the dragged stack', () => {
        const dragged = [makeCard(0, 0, 100, 100, 'a')]
        const overlapping = [makeCard(50, 50, 100, 100, 'b')]
        const other = [makeCard(1000, 1000, 100, 100, 'c')]

        expect(findMergeTargets(dragged, [overlapping, other], null)).toEqual([overlapping])
    })

    it('excludes the source stack even if it overlaps itself', () => {
        const dragged = [makeCard(0, 0, 100, 100, 'a')]
        const overlapping = [makeCard(50, 50, 100, 100, 'b')]

        expect(findMergeTargets(dragged, [dragged, overlapping], dragged)).toEqual([overlapping])
    })

    it('returns an empty array when nothing overlaps', () => {
        const dragged = [makeCard(0, 0, 100, 100, 'a')]
        const other = [makeCard(1000, 1000, 100, 100, 'c')]

        expect(findMergeTargets(dragged, [other], null)).toEqual([])
    })
})
