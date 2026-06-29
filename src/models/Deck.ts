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

export class Deck extends Container {
    background?: Graphics
    override name: string = ''
    deckWidth: number = 0
    deckHeight: number = 0
    private _hovered: boolean = false

    constructor() {
        super()
        this.eventMode = 'static'
        this.on('pointerenter', this._onPointerEnter)
        this.on('pointerleave', this._onPointerLeave)
    }

    private _onPointerEnter: () => void = () => {
        this._hovered = true
        this.arrangeCards()
    }

    private _onPointerLeave: () => void = () => {
        this._hovered = false
        this.arrangeCards()
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

    redrawBackground(width: number, height: number, borderColor: number = TITLE_BAR_COLOR, backgroundColor: number = DECK_BACKGROUND_COLOR, cornerRadius: number = CORNER_RADIUS, borderWidth: number = BORDER_WIDTH, onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null): void {
        this.deckWidth = width
        this.deckHeight = height
        const bg: Graphics | undefined = this.getBackground()
        if (!bg) {
            return
        }
        bg.eventMode = 'static'
        bg.removeChildren()
        bg.clear()
        DeckController.drawDeckMainBackground(bg, width, height, backgroundColor, cornerRadius)
        DeckController.drawDeckTitleBar(bg, width, TITLE_BAR_HEIGHT, TITLE_BAR_COLOR, cornerRadius)
        DeckController.addDeckNameText(bg, width, TITLE_BAR_HEIGHT, this.name)
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
        this.redrawBackground(deckWidth, deckHeight, borderColor, DECK_BACKGROUND_COLOR, CORNER_RADIUS, borderWidth, onTitleBarClick)
    }

    updateBorderViewer(deckWidth: number, deckHeight: number, onTitleBarClick: ((event: FederatedPointerEvent) => void) | null = null): void {
        this.redrawBackground(deckWidth, deckHeight, VIEWER_HIGHLIGHT_COLOR, DECK_BACKGROUND_COLOR, CORNER_RADIUS, VIEWER_HIGHLIGHT_BORDER_WIDTH, onTitleBarClick)
    }

    centerCard(card: Card, deckWidth: number, deckHeight: number, titleBarHeight: number = TITLE_BAR_HEIGHT): void {
        this.deckWidth = deckWidth
        this.deckHeight = deckHeight
        if (!this._hovered) {
            card.x = (deckWidth - card.width) / 2
            card.y = titleBarHeight + ((deckHeight - titleBarHeight - card.height) / 2)
        }
        this.arrangeCards()
    }

    arrangeCards(titleBarHeight: number = TITLE_BAR_HEIGHT): void {
        if (this.deckWidth === 0 || this.deckHeight === 0) {
            return
        }
        const cards: Card[] = []
        for (let i: number = 1; i < this.children.length; i++) {
            cards.push(this.children[i] as Card)
        }
        if (cards.length === 0) {
            return
        }

    if (this._hovered && cards.length > 1) {
        const offset: number = 3
        const visibleCount: number = Math.min(cards.length, 5)
        for (let i: number = 0; i < visibleCount; i++) {
            cards[i].x = (this.deckWidth - cards[i].width) / 2 + i * offset
            cards[i].y = titleBarHeight + ((this.deckHeight - titleBarHeight - cards[i].height) / 2) + i * offset
        }
        for (let i: number = visibleCount; i < cards.length; i++) {
            cards[i].x = (this.deckWidth - cards[i].width) / 2 + (visibleCount - 1) * offset
            cards[i].y = titleBarHeight + ((this.deckHeight - titleBarHeight - cards[i].height) / 2) + (visibleCount - 1) * offset
        }
        } else {
            for (const card of cards) {
                card.x = (this.deckWidth - card.width) / 2
                card.y = titleBarHeight + ((this.deckHeight - titleBarHeight - card.height) / 2)
            }
        }
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
