import { Application, FederatedPointerEvent, Spritesheet } from 'pixi.js'
import { AnimationTarget, Card, CardState } from '../types/card.types'
import { Position } from '../types/position.types'
import { constrainPosition, createCard } from '../utils/card'
import { CARD_REFERENCE_WIDTH } from '../utils/constants'

/**
 * Handles card creation, scaling, placement, and order resolution.
 */
export class CardManager {
    private app: Application

    constructor(app: Application) {
        this.app = app
    }

    resolveOrder(images: string[], saved: CardState): string[] {
        if (saved.order.length === images.length) {
            const filtered = saved.order.filter((url: string): boolean => images.includes(url))
            if (filtered.length === images.length) {
                return filtered
            }
        }
        return this.shuffleImages(images)
    }

    loadCards(
        frameNames: string[],
        positions: Record<string, Position>,
        onDragStart: (event: FederatedPointerEvent) => void,
        spritesheet: Spritesheet,
    ): Card[] {
        const cards: Card[] = []
        for (let i = 0; i < frameNames.length; i++) {
            const texture = spritesheet.textures[frameNames[i]]
            const card = createCard(frameNames[i], texture, onDragStart)
            this.applyScale(card)
            cards.push(card)
            this.placeCard(card, positions[frameNames[i]])
            this.app.stage.addChild(card)
        }
        return cards
    }

    applyScale(card: Card): void {
        const cardScale = this.app.screen.width / CARD_REFERENCE_WIDTH
        card.scale.set(cardScale)
    }

    placeCard(card: Card, savedPos?: Position): void {
        if (savedPos) {
            card.x = savedPos.x
            card.y = savedPos.y
        } else {
            const centerX = (this.app.screen.width - card.width) / 2
            const centerY = (this.app.screen.height - card.height) / 2
            const jitter = 25
            card.x = centerX + (Math.random() * 2 - 1) * jitter
            card.y = centerY + (Math.random() * 2 - 1) * jitter
        }
    }

    repositionForResize(card: Card, ratioX: number, ratioY: number, newWidth: number, newHeight: number): void {
        this.applyScale(card)
        card.x = card.x * ratioX
        card.y = card.y * ratioY
        const constrained = constrainPosition(card.x, card.y, card.width, card.height, newWidth, newHeight)
        card.x = constrained.x
        card.y = constrained.y
    }

    shuffleAndBuildTargets(cards: Card[]): AnimationTarget[] {
        const targets: AnimationTarget[] = []
        for (let i = 0; i < cards.length; i++) {
            const j = Math.floor(Math.random() * (cards.length - i)) + i;
            [cards[i], cards[j]] = [cards[j], cards[i]]
            this.app.stage.addChild(cards[i])

            const card = cards[i]
            this.applyScale(card)
            const centerX = (this.app.screen.width - card.width) / 2
            const centerY = (this.app.screen.height - card.height) / 2
            const jitter = 25
            targets.push({
                card,
                fromX: card.x,
                fromY: card.y,
                toX: centerX + (Math.random() * 2 - 1) * jitter,
                toY: centerY + (Math.random() * 2 - 1) * jitter,
            })
        }
        return targets
    }

    shuffleImages(images: string[]): string[] {
        const shuffled = [...images]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
    }
}
