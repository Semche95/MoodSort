import { Application, Container, FederatedPointerEvent, Graphics, Rectangle, Spritesheet, Sprite, Texture } from 'pixi.js'
import { Card } from '../../types/card.types'
import { AnimationTarget } from '../../types/animation.types'
import { CardState } from '../../types/card-state.types'
import { Position } from '../../types/position.types'
import { ViewportSize } from '../../types/viewport-size.types'
import { GetResolvedTheme, ResolvedTheme } from '../../types/theme.types'
import { PixiThemePalette } from '../../types/pixi-theme-palette.types'
import { clampCardPosition, computeBoundingBox, computeGroupClampOffset } from '../stack/stack-geometry'
import { computeStacks } from '../stack/stack'
import { DEFAULT_GET_RESOLVED_THEME, getPixiThemeColors } from '../theme/pixi-theme-colors'
import { prefersReducedMotion } from '../../shared/utils/reduced-motion'
import { applyCardLift, createCardLift, updateCardLifts } from './card-lift'
import { CARD_CORNER_RADIUS } from './card-corner-radius'

/** Screen width (in px) at which cards render at native size */
export const CARD_REFERENCE_WIDTH: number = 2560

const JITTER: number = 25

function jitteredPosition(centerX: number, centerY: number): Position {
    return {
        x: centerX + (Math.random() * 2 - 1) * JITTER,
        y: centerY + (Math.random() * 2 - 1) * JITTER,
    }
}

/** Rings stacked around each card's shadow: their alphas add up toward the card, giving a soft edge without a per-card blur filter */
export const REST_SHADOW_LAYERS: number = 3
/** Width of each ring, in card-local px */
export const REST_SHADOW_SPREAD: number = 1.5
const REST_SHADOW_LAYER_ALPHA: number = 0.1

export function drawCardShadowShape(shadow: Graphics, width: number, height: number): void {
    for (let layer = REST_SHADOW_LAYERS; layer >= 1; layer--) {
        const spread = layer * REST_SHADOW_SPREAD
        shadow.roundRect(-spread, -spread, width + spread * 2, height + spread * 2, CARD_CORNER_RADIUS + spread)
        shadow.fill({ color: 0xFFFFFF, alpha: REST_SHADOW_LAYER_ALPHA })
    }
}

export function drawCardHighlight(highlight: Graphics, width: number, height: number, outline: PixiThemePalette['card']['hoverOutline']): void {
    highlight.clear()
    // Inner alignment keeps the outline on the card, so it never spills over a neighbouring card.
    highlight.roundRect(0, 0, width, height, CARD_CORNER_RADIUS)
    highlight.stroke({ color: outline.color, alpha: outline.alpha, width: outline.width, alignment: 0 })
}

export function createCard(
    frameName: string,
    texture: Texture,
    onDragStart: (event: FederatedPointerEvent) => void,
    getResolvedTheme: GetResolvedTheme = DEFAULT_GET_RESOLVED_THEME,
): Card {
    const card = new Container() as Card
    card.imageUrl = frameName

    const body = new Container()
    card.addChild(body)
    card.body = body

    const shadow = new Graphics()
    drawCardShadowShape(shadow, texture.width, texture.height)
    body.addChild(shadow)
    card.shadow = shadow

    const sprite = new Sprite(texture)
    body.addChild(sprite)
    card.innerSprite = sprite

    const highlight = new Graphics()
    highlight.visible = false
    body.addChild(highlight)
    card.highlight = highlight

    card.lift = createCardLift()
    // The lift grows the body and its shadow: pinning bounds and hit area to the resting card keeps stacking, clamping and persistence unaffected.
    card.boundsArea = new Rectangle(0, 0, texture.width, texture.height)
    card.hitArea = card.boundsArea
    card.interactiveChildren = false
    applyCardLift(card, getPixiThemeColors(getResolvedTheme()).card.shadow)

    card.eventMode = 'static'
    card.cursor = 'grab'
    card.on('pointerdown', onDragStart, card)
    // Read fresh on every hover so a theme flip is picked up without restyling existing cards.
    card.on('pointerover', (): void => {
        drawCardHighlight(highlight, texture.width, texture.height, getPixiThemeColors(getResolvedTheme()).card.hoverOutline)
        highlight.visible = true
    })
    card.on('pointerout', (): void => { highlight.visible = false })

    return card
}

export class CardManager {
    private app: Application
    private cardLayer: Container
    private resolvedTheme: ResolvedTheme

    constructor(app: Application, cardLayer: Container) {
        this.app = app
        this.cardLayer = cardLayer
        this.resolvedTheme = 'light'
    }

    setResolvedTheme(theme: ResolvedTheme): void {
        this.resolvedTheme = theme
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

    /** Restored cards are rescaled from `savedViewport`, the canvas size they were saved under, as a resize from that size would. */
    loadCards(
        frameNames: string[],
        positions: Record<string, Position>,
        savedViewport: ViewportSize | null,
        onDragStart: (event: FederatedPointerEvent) => void,
        spritesheet: Spritesheet,
    ): Card[] {
        const cards: Card[] = []
        for (let i = 0; i < frameNames.length; i++) {
            const texture = spritesheet.textures[frameNames[i]]
            const card = createCard(frameNames[i], texture, onDragStart, (): ResolvedTheme => this.resolvedTheme)
            this.applyScale(card)
            cards.push(card)
            this.placeCard(card, positions[frameNames[i]])
            this.cardLayer.addChild(card)
        }
        const restored = cards.filter((card: Card): boolean => positions[card.imageUrl] !== undefined)
        this.rescaleFromViewport(computeStacks(restored), savedViewport)
        return cards
    }

    /** Swaps each card's sprite texture for the matching frame in `spritesheet`, e.g. after a theme change reloads the atlas. */
    updateTextures(cards: Card[], spritesheet: Spritesheet): void {
        for (const card of cards) {
            const texture = spritesheet.textures[card.imageUrl]
            if (texture) {
                card.innerSprite.texture = texture
            }
        }
    }

    /** Restyles every card's shadow with the current resolved theme, e.g. after a theme change. */
    updateShadows(cards: Card[]): void {
        const shadowTheme = getPixiThemeColors(this.resolvedTheme).card.shadow
        for (const card of cards) {
            applyCardLift(card, shadowTheme)
        }
    }

    /** Eases every raised or settling card one frame further; called from the scene's ticker. */
    updateLifts(cards: Card[], deltaFrames: number): void {
        updateCardLifts(cards, deltaFrames, prefersReducedMotion(), getPixiThemeColors(this.resolvedTheme).card.shadow)
    }

    applyScale(card: Card): void {
        const cardScale = this.app.screen.width / CARD_REFERENCE_WIDTH
        card.scale.set(cardScale)
    }

    placeCard(card: Card, savedPos?: Position): void {
        if (savedPos) {
            // Left unclamped: clamping card by card would pull a restored stack apart, so loadCards clamps whole stacks.
            card.x = savedPos.x
            card.y = savedPos.y
            return
        }
        const centerX = (this.app.screen.width - card.width) / 2
        const centerY = (this.app.screen.height - card.height) / 2
        const jittered = jitteredPosition(centerX, centerY)
        const constrained = clampCardPosition(jittered.x, jittered.y, card, this.app.screen.width, this.app.screen.height)
        card.x = constrained.x
        card.y = constrained.y
    }

    /**
     * Moves each stack as one rigid block after the canvas was resized by
     * `ratioX`/`ratioY`: its top-left corner follows the canvas on both axes,
     * while the gaps between its cards follow the card scale, which tracks the
     * width only. Scaling those gaps by `ratioY` instead would squeeze or pull
     * apart the cards of a pile whenever the window changes aspect ratio.
     */
    rescaleStacks(stacks: Card[][], ratioX: number, ratioY: number): void {
        const appWidth = this.app.screen.width
        const appHeight = this.app.screen.height
        for (const stack of stacks) {
            const origin = computeBoundingBox(stack)
            for (const card of stack) {
                this.applyScale(card)
                card.x = card.x * ratioX
                card.y = origin.y * ratioY + (card.y - origin.y) * ratioX
            }
            const offset = computeGroupClampOffset(stack, appWidth, appHeight)
            for (const card of stack) {
                // Only moves a card when its stack is larger than the canvas and couldn't fit as a whole.
                const constrained = clampCardPosition(card.x + offset.x, card.y + offset.y, card, appWidth, appHeight)
                card.x = constrained.x
                card.y = constrained.y
            }
        }
    }

    /** Rescales stacks laid out under `savedViewport` to the current canvas; an unknown size only clamps them as whole stacks. */
    rescaleFromViewport(stacks: Card[][], savedViewport: ViewportSize | null): void {
        const ratioX = savedViewport ? this.app.screen.width / savedViewport.width : 1
        const ratioY = savedViewport ? this.app.screen.height / savedViewport.height : 1
        this.rescaleStacks(stacks, ratioX, ratioY)
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
