import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CardDrag, DRAGGING_OPACITY, DEFAULT_OPACITY } from '../features/drag/card-drag'

describe('CardDrag', () => {
    let cardDrag: CardDrag

    beforeEach(() => {
        vi.clearAllMocks()
        cardDrag = new CardDrag()
    })

    describe('constructor', () => {
        it('should initialize with empty drag state', () => {
            expect(cardDrag.dragState.dragTarget).toBeNull()
            expect(cardDrag.dragState.originalParent).toBeNull()
            expect(cardDrag.dragState.originalPosition).toEqual({ x: 0, y: 0 })
            expect(cardDrag.dragState.cardMoved).toBe(false)
        })
    })

    describe('styling constants', () => {
        it('should have the correct DRAGGING_OPACITY', () => {
            expect(DRAGGING_OPACITY).toBe(0.5)
        })

        it('should have the correct DEFAULT_OPACITY', () => {
            expect(DEFAULT_OPACITY).toBe(1)
        })
    })
})
