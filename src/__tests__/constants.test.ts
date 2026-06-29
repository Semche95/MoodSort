import { describe, it, expect } from 'vitest'
import {
    TITLE_BAR_HEIGHT,
    TITLE_BAR_COLOR,
    DECK_BACKGROUND_COLOR,
    CORNER_RADIUS,
    DECK_PADDING,
    DECK_MARGIN,
    BORDER_WIDTH,
    HIGHLIGHT_BORDER_WIDTH,
    HIGHLIGHT_COLOR,
    DRAGGING_OPACITY,
    DEFAULT_OPACITY,
} from '../utils/constants'

describe('Constants', () => {
    describe('Title bar styling', () => {
        it('should have the correct TITLE_BAR_HEIGHT', () => {
            expect(TITLE_BAR_HEIGHT).toBe(30)
        })

        it('should have the correct TITLE_BAR_COLOR', () => {
            expect(TITLE_BAR_COLOR).toBe(0x333333)
        })
    })

    describe('Deck styling', () => {
        it('should have the correct DECK_BACKGROUND_COLOR', () => {
            expect(DECK_BACKGROUND_COLOR).toBe(0x555555)
        })

        it('should have the correct CORNER_RADIUS', () => {
            expect(CORNER_RADIUS).toBe(10)
        })

        it('should have the correct DECK_PADDING', () => {
            expect(DECK_PADDING).toBe(20)
        })

        it('should have the correct DECK_MARGIN', () => {
            expect(DECK_MARGIN).toBe(20)
        })
    })

    describe('Border styling', () => {
        it('should have the correct BORDER_WIDTH', () => {
            expect(BORDER_WIDTH).toBe(0.5)
        })

        it('should have the correct HIGHLIGHT_BORDER_WIDTH', () => {
            expect(HIGHLIGHT_BORDER_WIDTH).toBe(3)
        })

        it('should have the correct HIGHLIGHT_COLOR', () => {
            expect(HIGHLIGHT_COLOR).toBe(0x00AAFF)
        })
    })

    describe('Card styling', () => {
        it('should have the correct DRAGGING_OPACITY', () => {
            expect(DRAGGING_OPACITY).toBe(0.5)
        })

        it('should have the correct DEFAULT_OPACITY', () => {
            expect(DEFAULT_OPACITY).toBe(1)
        })
    })
})
