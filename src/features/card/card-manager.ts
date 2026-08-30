import { Application, BlurFilter, Container, FederatedPointerEvent, Graphics, Spritesheet, Sprite, Texture } from 'pixi.js'
import { Card } from '../../types/card.types'
import { AnimationTarget } from '../../types/animation.types'
import { CardState } from '../../types/card-state.types'
import { Position } from '../../types/position.types'
import { clampCardPosition } from '../stack/stack'

/** Screen width (in px) at which cards render at native size */
export const CARD_REFERENCE_WIDTH: number = 2560

const JITTER: number = 25

function jitteredPosition(centerX: number, centerY: number): Position {
    return {
        x: centerX + (Math.random() * 2 - 1) * JITTER,
        y: centerY + (Math.random() * 2 - 1) * JITTER,
    }
}

export function createCard(
    frameName: string,
    texture: Texture,
    onDragStart: (event: FederatedPointerEvent) => void,
): Card {
    const card = new Container() as Card
    card.imageUrl = frameName

    const shadow = new Graphics()
    shadow.roundRect(0, 0, texture.width, texture.height, 8)
    shadow.fill({ color: 0x000000, alpha: 0.25 })
    shadow.filters = [new BlurFilter({ strength: 4 })]
    shadow.x = 4
    shadow.y = 4
    card.addChild(shadow)

    const sprite = new Sprite(texture)
    card.addChild(sprite)
    card.innerSprite = sprite

    card.eventMode = 'static'
    card.cursor = 'move'
    card.on('pointerdown', onDragStart, card)
    card.on('pointerover', (): void => { sprite.tint = 0xFFEEDD })
    card.on('pointerout', (): void => { sprite.tint = 0xFFFFFF })

    return card
}

export class CardManager {
    private app: Application
    private cardLayer: Container

    constructor(app: Application, cardLayer: Container) {
        this.app = app
        this.cardLayer = cardLayer
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
            this.cardLayer.addChild(card)
        }
        return cards
    }

    applyScale(card: Card): void {
        const cardScale = this.app.screen.width / CARD_REFERENCE_WIDTH
        card.scale.set(cardScale)
    }

    placeCard(card: Card, savedPos?: Position): void {
        let targetX: number
        let targetY: number
        if (savedPos) {
            targetX = savedPos.x
            targetY = savedPos.y
        } else {
            const centerX = (this.app.screen.width - card.width) / 2
            const centerY = (this.app.screen.height - card.height) / 2
            const jittered = jitteredPosition(centerX, centerY)
            targetX = jittered.x
            targetY = jittered.y
        }
        const constrained = clampCardPosition(targetX, targetY, card, this.app.screen.width, this.app.screen.height)
        card.x = constrained.x
        card.y = constrained.y
    }

    repositionForResize(card: Card, ratioX: number, ratioY: number, newWidth: number, newHeight: number): void {
        this.applyScale(card)
        const constrained = clampCardPosition(card.x * ratioX, card.y * ratioY, card, newWidth, newHeight)
        card.x = constrained.x
        card.y = constrained.y
    }

    shuffleAndBuildTargets(cards: Card[]): AnimationTarget[] {
        const targets: AnimationTarget[] = []
        for (let i = 0; i < cards.length; i++) {
            const j = Math.floor(Math.random() * (cards.length - i)) + i;
            [cards[i], cards[j]] = [cards[j], cards[i]]
            this.cardLayer.addChild(cards[i])

            const card = cards[i]
            this.applyScale(card)
            const centerX = (this.app.screen.width - card.width) / 2
            const centerY = (this.app.screen.height - card.height) / 2
            const jittered = jitteredPosition(centerX, centerY)
            const constrained = clampCardPosition(
                jittered.x,
                jittered.y,
                card,
                this.app.screen.width,
                this.app.screen.height,
            )
            targets.push({
                card,
                fromX: card.x,
                fromY: card.y,
                toX: constrained.x,
                toY: constrained.y,
            })
        }
        return targets
    }

    /**
     * Builds animation targets for the "compact stack" action: `others` are
     * dispersed around `topCard`'s current position using the same random
     * jitter formula as the natural first-visit stacking (see `placeCard`),
     * just recentered on the top card instead of the screen center.
     */
    buildCompactTargets(topCard: Card, others: Card[]): AnimationTarget[] {
        const targets: AnimationTarget[] = []
        const centerX = topCard.x
        const centerY = topCard.y
        for (const card of others) {
            const jittered = jitteredPosition(centerX, centerY)
            // Clamped the same way a drag would be: the jitter can otherwise land a
            // card above the stack's handle clearance (or off another edge) when the
            // stack sits near the canvas border, pushing the handle off-canvas.
            const constrained = clampCardPosition(
                jittered.x,
                jittered.y,
                card,
                this.app.screen.width,
                this.app.screen.height,
            )
            targets.push({
                card,
                fromX: card.x,
                fromY: card.y,
                toX: constrained.x,
                toY: constrained.y,
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
