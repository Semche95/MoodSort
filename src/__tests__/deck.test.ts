import { beforeEach, describe, expect, it } from 'vitest'
import { Dimensions } from '../types/position.types'
import { Card } from '../types/card.types'
import { DECK_PADDING, TITLE_BAR_HEIGHT } from '../utils/constants'
import { DeckController } from '../controllers/DeckController'

// Mock a Card object
const mockCard: Card = {
    width: 200,
    height: 300,
    x: 0,
    y: 0,
} as Card

describe('Deck Utilities', () => {
    describe('calculateDeckDimensions', () => {
        it('should calculate correct dimensions based on card size', () => {
            const cardWidth: number = 200
            const cardHeight: number = 300
            const padding: number = DECK_PADDING
            const titleBarHeight: number = TITLE_BAR_HEIGHT

            const dimensions: Dimensions = DeckController.calculateDimensions(
                cardWidth,
                cardHeight,
                padding,
                titleBarHeight,
            )

            // Deck width should be card width + padding
            expect(dimensions.width).toBe(cardWidth + padding)

            // Deck height should be card height + padding + title bar height
            expect(dimensions.height).toBe(cardHeight + padding + titleBarHeight)
        })

        it('should handle zero or negative card dimensions', () => {
            const dimensions: Dimensions = DeckController.calculateDimensions(
                0,
                -10,
                DECK_PADDING,
                TITLE_BAR_HEIGHT,
            )

            // Should use default dimensions when card dimensions are invalid
            expect(dimensions.width).toBe(300)
            expect(dimensions.height).toBe(400 + TITLE_BAR_HEIGHT)
        })
    })

    describe('centerCardInDeck', () => {
        beforeEach(() => {
            // Reset card position before each test
            mockCard.x = 0
            mockCard.y = 0
        })

        it('should center the card horizontally within the deck', () => {
            const deckWidth: number = 300
            const deckHeight: number = 400
            DeckController.centerCardPosition(mockCard, deckWidth, deckHeight, TITLE_BAR_HEIGHT)

            // Card should be centered horizontally
            // (deckWidth - cardWidth) / 2
            expect(mockCard.x).toBe((deckWidth - mockCard.width) / 2)
        })

        it('should center the card vertically within the deck, accounting for title bar', () => {
            const deckWidth: number = 300
            const deckHeight: number = 400
            const titleBarHeight: number = TITLE_BAR_HEIGHT

            DeckController.centerCardPosition(mockCard, deckWidth, deckHeight, titleBarHeight)

            // Card should be centered vertically, accounting for title bar
            // titleBarHeight + ((deckHeight - titleBarHeight - cardHeight) / 2)
            expect(mockCard.y).toBe(
                titleBarHeight + ((deckHeight - titleBarHeight - mockCard.height) / 2),
            )
        })

        it('should handle deck smaller than card', () => {
            const deckWidth: number = 100
            const deckHeight: number = 200
            const titleBarHeight: number = TITLE_BAR_HEIGHT

            DeckController.centerCardPosition(mockCard, deckWidth, deckHeight, titleBarHeight)

            // Card should be positioned at x=0 if deck is smaller than card
            expect(mockCard.x).toBe((deckWidth - mockCard.width) / 2) // Negative value

            // Card should be positioned at titleBarHeight if deck is smaller than card
            expect(mockCard.y).toBe(
                titleBarHeight + ((deckHeight - titleBarHeight - mockCard.height) / 2), // Negative value
            )
        })
    })
})
