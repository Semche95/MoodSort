import { AlphaFilter, BlurFilter, Graphics } from 'pixi.js'
import { Card } from '../../types/card.types'
import { StackShadow } from '../../types/stack-shadow.types'
import { PixiThemePalette } from '../../types/pixi-theme-palette.types'
import { CARD_CORNER_RADIUS } from '../card/card-corner-radius'
import { isCardDragged } from '../card/card-lift'

/** How far the pile shadow falls below its cards, in card-local px */
export const STACK_SHADOW_OFFSET_Y: number = 10

export function createStackShadow(palette: PixiThemePalette['card']['stackShadow']): StackShadow {
    const graphics = new Graphics()
    graphics.label = 'stack-shadow'
    graphics.eventMode = 'none'
    const blur = new BlurFilter()
    const alpha = new AlphaFilter()
    // Shapes are filled opaque and faded as a whole: a per-shape alpha would darken wherever cards overlap.
    graphics.filters = [alpha, blur]
    const shadow = { graphics, blur, alpha }
    applyStackShadowTheme(shadow, palette)
    return shadow
}

export function applyStackShadowTheme(shadow: StackShadow, palette: PixiThemePalette['card']['stackShadow']): void {
    shadow.graphics.tint = palette.color
    shadow.blur.strength = palette.blurStrength
    shadow.alpha.alpha = palette.alpha
}

/** Redraws the union of every resting card, so overlapping cards cast a single shadow per pile; a dragged card casts its own. */
export function drawStackShadow(shadow: StackShadow, cards: Card[]): void {
    const graphics = shadow.graphics
    graphics.clear()
    for (const card of cards) {
        if (isCardDragged(card)) {
            continue
        }
        const scale = card.scale.x
        graphics.roundRect(card.x, card.y + STACK_SHADOW_OFFSET_Y * scale, card.width, card.height, CARD_CORNER_RADIUS * scale)
    }
    graphics.fill({ color: 0xFFFFFF })
}
