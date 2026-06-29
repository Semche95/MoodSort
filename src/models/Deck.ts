import { Container, FederatedPointerEvent, Graphics } from 'pixi.js'
import type { Bounds, ContainerChild } from 'pixi.js'
import { Card } from '../types/card.types'
import {
    BORDER_WIDTH,
    CORNER_RADIUS,
    DECK_BACKGROUND_COLOR,
    HIGHLIGHT_BORDER_WIDTH,
    HIGHLIGHT_COLOR,
    TITLE_BAR_COLOR,
    TITLE_BAR_HEIGHT,
    VIEWER_HIGHLIGHT_BORDER_WIDTH,
    VIEWER_HIGHLIGHT_COLOR,
} from '../utils/constants'
import { DeckController } from '../controllers/DeckController'

/**
 * Deck represents a logical deck of cards on the Pixi stage.
 * It extends Container and provides small helpers to manage its background
 * and to query its card count (children after the background).
 */
export class Deck extends Container {
    background?: Graphics

    constructor() {
        super()
        this.eventMode = 'static'
    }

    setBackground(bg: Graphics): void {
        if (this.children.length > 0) {
            this.removeChildAt(0)
        }
        this.addChildAt(bg, 0)
        this.background = bg
    }

    getBackground(): Graphics | undefined {
        if (this.background) {
            return this.background
        }
        if (this.children.length > 0) {
            const child: ContainerChild = this.getChildAt(0)
            if (child instanceof Graphics) {
                this.background = child
                return child
            }
        }
        return undefined
    }

    getCardCount(): number {
        return Math.max(0, this.children.length - 1)
    }

    redrawBackground(width: number, height: number, borderColor: number = TITLE_BAR_COLOR, backgroundColor: number = DECK_BACKGROUND_COLOR, cornerRadius: number = CORNER_RADIUS, borderWidth: number = BORDER_WIDTH, onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null, cardCount: number = 0): void {
        const bg: Graphics | undefined = this.getBackground()
        if (!bg) {
            return
        }
        bg.eventMode = 'static'
        bg.removeChildren()
        bg.clear()
        DeckController.drawDeckMainBackground(bg, width, height, backgroundColor, cornerRadius)
        DeckController.drawDeckTitleBar(bg, width, TITLE_BAR_HEIGHT, TITLE_BAR_COLOR, cornerRadius)
        DeckController.addCardCountText(bg, width, TITLE_BAR_HEIGHT, cardCount)
        DeckController.drawDeckBorder(bg, width, height, TITLE_BAR_HEIGHT, borderColor, borderWidth, cornerRadius)
        if (borderWidth > BORDER_WIDTH) {
            DeckController.drawDeckHeaderBorder(bg, width, TITLE_BAR_HEIGHT, borderColor, borderWidth, cornerRadius)
        }
        if (onTitleBarClick) {
            DeckController.makeTitleBarInteractive(bg, width, TITLE_BAR_HEIGHT, onTitleBarClick)
        }
    }

    updateBorder(highlight: boolean, deckWidth: number, deckHeight: number, onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null): void {
        const borderColor: number = highlight ? HIGHLIGHT_COLOR : TITLE_BAR_COLOR
        const borderWidth: number = highlight ? HIGHLIGHT_BORDER_WIDTH : BORDER_WIDTH
        const cardCount: number = Math.max(0, this.children.length - 1)
        this.redrawBackground(deckWidth, deckHeight, borderColor, DECK_BACKGROUND_COLOR, CORNER_RADIUS, borderWidth, onTitleBarClick, cardCount)
    }

    updateBorderViewer(deckWidth: number, deckHeight: number, onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null): void {
        const cardCount: number = Math.max(0, this.children.length - 1)
        this.redrawBackground(deckWidth, deckHeight, VIEWER_HIGHLIGHT_COLOR, DECK_BACKGROUND_COLOR, CORNER_RADIUS, VIEWER_HIGHLIGHT_BORDER_WIDTH, onTitleBarClick, cardCount)
    }

    centerCard(card: Card, deckWidth: number, deckHeight: number, titleBarHeight: number = TITLE_BAR_HEIGHT): void {
        card.x = (deckWidth - card.width) / 2
        card.y = titleBarHeight + ((deckHeight - titleBarHeight - card.height) / 2)
    }

    isCardOver(sprite: Card): boolean {
        if (!sprite) {
            return false
        }
        if (this.children.length === 0) {
            return false
        }
        const spriteBounds: Bounds = sprite.getBounds()
        const deckBackground: Graphics = this.getChildAt(0) as Graphics
        const deckBounds: Bounds = deckBackground.getBounds()
        if (deckBounds.width === 0 || deckBounds.height === 0) {
            return false
        }
        return (
            spriteBounds.x + spriteBounds.width > deckBounds.x &&
            spriteBounds.x < deckBounds.x + deckBounds.width &&
            spriteBounds.y + spriteBounds.height > deckBounds.y &&
            spriteBounds.y < deckBounds.y + deckBounds.height
        )
    }
}
