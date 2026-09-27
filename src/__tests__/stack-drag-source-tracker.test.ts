import { describe, expect, it } from 'vitest'
import { StackDragSourceTracker } from '../features/stack/stack-overlay/stack-drag-source-tracker'
import { computeLabelAnchorPoint } from '../features/stack/stack-naming'
import { Card } from '../types/card.types'

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { imageUrl, x, y, width, height, alpha: 1 } as unknown as Card
}

describe('StackDragSourceTracker', () => {
    it('populates restStacks from computeStacks(cards) and clears source state when nothing is being dragged', () => {
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(110, 110, 200, 300, 'b')
        const tracker = new StackDragSourceTracker()

        tracker.captureIfDragStarted([cardA, cardB], undefined)

        expect(tracker.restStacks.get(cardA)).toEqual([cardA, cardB])
        expect(tracker.restStacks.get(cardB)).toEqual([cardA, cardB])
        expect(tracker.sourceCards).toBeNull()
        expect(tracker.sourceGroups).toEqual([])
        expect(tracker.sourceLabelPoint).toBeNull()
    })

    it('captures sourceCards/sourceGroups/sourceLabelPoint for the dragged card\'s stack once a tracked card starts dragging', () => {
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(110, 110, 200, 300, 'b')
        const tracker = new StackDragSourceTracker()

        // Establish the resting stack before any drag starts.
        tracker.captureIfDragStarted([cardA, cardB], undefined)
        // b is picked up and pulled out, leaving a alone.
        tracker.captureIfDragStarted([cardA, cardB], cardB)

        expect(tracker.sourceCards).toEqual([cardA, cardB])
        expect(tracker.sourceGroups).toEqual([[cardA]])
        expect(tracker.sourceLabelPoint).toEqual(computeLabelAnchorPoint([cardA, cardB]))
    })

    it('keeps the previously captured source values on a second call while still dragging the same card', () => {
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(110, 110, 200, 300, 'b')
        const tracker = new StackDragSourceTracker()

        tracker.captureIfDragStarted([cardA, cardB], undefined)
        tracker.captureIfDragStarted([cardA, cardB], cardB)
        const sourceCardsAfterFirstDrag = tracker.sourceCards
        const sourceLabelPointAfterFirstDrag = tracker.sourceLabelPoint

        // b is dragged further away; a subsequent frame's cards array reflects its new
        // position, but the captured source must not be recomputed mid-drag.
        cardB.x = 900
        cardB.y = 900
        tracker.captureIfDragStarted([cardA, cardB], cardB)

        expect(tracker.sourceCards).toBe(sourceCardsAfterFirstDrag)
        expect(tracker.sourceLabelPoint).toEqual(sourceLabelPointAfterFirstDrag)
    })
})
