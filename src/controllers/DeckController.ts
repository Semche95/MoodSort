import { FederatedPointerEvent, Graphics, Text } from 'pixi.js'
import type { Deck } from '../models/Deck'
import { Card } from '../types/card.types'
import { Dimensions } from '../types/position.types'
import { DECK_PADDING, TITLE_BAR_HEIGHT } from '../utils/constants'

/**
 * DeckController hosts operations that involve multiple decks or logic
 * that is not tied to a single Deck instance state.
 *
 * All methods are pure with respect to controller state and operate on
 * provided arguments only.
 */
export class DeckController {
    /**
     * Finds the deck under the given card sprite among the provided list.
     * Returns the first deck that intersects with the card bounds, or null.
     */
    static getDeckUnderCard(sprite: Card, decks: Deck[]): Deck | null {
        for (const deck of decks) {
            if (deck.isCardOver(sprite)) {
                return deck
            }
        }
        return null
    }

    /**
     * Checks whether the sprite is over any of the given decks.
     */
    static isOverAnyDeck(sprite: Card, decks: Deck[]): boolean {
        return DeckController.getDeckUnderCard(sprite, decks) !== null
    }

    /**
     * Removes highlight from all decks by redrawing their borders
     * in normal state.
     */
    static unhighlightAll(
        decks: Deck[],
        deckWidth: number,
        deckHeight: number,
        onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null,
    ): void {
        for (const deck of decks) {
            deck.updateBorder(false, deckWidth, deckHeight, onTitleBarClick)
        }
    }

    /**
     * Calculates deck dimensions based on a card's size, padding and title bar.
     */
    static calculateDimensions(
        cardWidth: number,
        cardHeight: number,
        padding: number = DECK_PADDING,
        titleBarHeight: number = TITLE_BAR_HEIGHT,
    ): Dimensions {
        return {
            width: cardWidth > 0 ? cardWidth + padding : 300,
            height: cardHeight > 0 ? cardHeight + padding + titleBarHeight : 400 + titleBarHeight,
        }
    }

    /**
     * Centers a card inside a deck area accounting for the title bar height.
     */
    static centerCardPosition(
        card: Card,
        deckWidth: number,
        deckHeight: number,
        titleBarHeight: number = TITLE_BAR_HEIGHT,
    ): void {
        card.x = (deckWidth - card.width) / 2
        card.y = titleBarHeight + ((deckHeight - titleBarHeight - card.height) / 2)
    }

    /**
     * Draws the main rounded-rectangle background of a deck.
     */
    static drawDeckMainBackground(graphics: Graphics, width: number, height: number, backgroundColor: number, cornerRadius: number): void {
        graphics.fill({ color: backgroundColor })
        graphics.roundRect(0, 0, width, height, cornerRadius)
        graphics.fill()
    }

    /**
     * Traces the header top path (rounded top corners) without closing the path.
     */
    static traceHeaderTopPath(graphics: Graphics, width: number, titleBarHeight: number, cornerRadius: number): void {
        graphics.moveTo(0, titleBarHeight)
        graphics.lineTo(0, cornerRadius)
        graphics.arc(cornerRadius, cornerRadius, cornerRadius, Math.PI, Math.PI * 1.5)
        graphics.lineTo(width - cornerRadius, 0)
        graphics.arc(width - cornerRadius, cornerRadius, cornerRadius, Math.PI * 1.5, 0)
        graphics.lineTo(width, titleBarHeight)
    }

    /**
     * Fills the deck title bar area.
     */
    static drawDeckTitleBar(graphics: Graphics, width: number, titleBarHeight: number, titleBarColor: number, cornerRadius: number): void {
        graphics.fill({ color: titleBarColor })
        graphics.beginPath()
        DeckController.traceHeaderTopPath(graphics, width, titleBarHeight, cornerRadius)
        graphics.lineTo(0, titleBarHeight)
        graphics.closePath()
        graphics.fill()
    }

    /**
     * Adds a deck name text inside the title bar if set.
     */
    static addDeckNameText(graphics: Graphics, _width: number, titleBarHeight: number, name: string): void {
        if (!name) {
            return
        }
        const nameText: Text = new Text({
            text: name,
            style: {
                fill: 0xFFFFFF,
                fontSize: 14,
                fontWeight: 'normal',
            },
        })
        nameText.x = 10
        nameText.y = (titleBarHeight - nameText.height) / 2
        graphics.addChild(nameText)
    }

    /**
     * Strokes the sides and bottom border of the deck (omits the top line under the title bar).
     */
    static drawDeckBorder(graphics: Graphics, width: number, height: number, titleBarHeight: number, borderColor: number, borderWidth: number, cornerRadius: number): void {
        if (borderWidth <= 0) {
            return
        }
        graphics.beginPath()
        graphics.moveTo(0, titleBarHeight)
        graphics.lineTo(0, height - cornerRadius)
        graphics.arc(cornerRadius, height - cornerRadius, cornerRadius, Math.PI, Math.PI / 2, true)
        graphics.lineTo(width - cornerRadius, height)
        graphics.arc(width - cornerRadius, height - cornerRadius, cornerRadius, Math.PI / 2, 0, true)
        graphics.lineTo(width, titleBarHeight)
        graphics.stroke({ width: borderWidth, color: borderColor })
    }

    /**
     * Strokes the header border along the title bar top path.
     */
    static drawDeckHeaderBorder(graphics: Graphics, width: number, titleBarHeight: number, borderColor: number, borderWidth: number, cornerRadius: number): void {
        graphics.stroke({ width: borderWidth, color: borderColor })
        graphics.beginPath()
        DeckController.traceHeaderTopPath(graphics, width, titleBarHeight, cornerRadius)
        graphics.stroke()
    }

    /**
     * Creates an invisible hit area for the title bar to enable dragging.
     */
    static makeTitleBarInteractive(graphics: Graphics, width: number, titleBarHeight: number, onTitleBarClick: (event: FederatedPointerEvent) => void): void {
        const titleBarHitArea: Graphics = new Graphics()
        titleBarHitArea.fill({ color: 0xFFFFFF, alpha: 0 })
        titleBarHitArea.rect(0, 0, width, titleBarHeight)
        titleBarHitArea.fill()
        graphics.addChild(titleBarHitArea)
        titleBarHitArea.eventMode = 'static'
        titleBarHitArea.cursor = 'move'
        titleBarHitArea.on('pointerdown', onTitleBarClick)
    }
}
