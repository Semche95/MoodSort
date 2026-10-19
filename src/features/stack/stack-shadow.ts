import { AlphaFilter, BlurFilter, Container, Graphics, Rectangle } from 'pixi.js'
import { Card } from '../../types/card.types'
import { StackShadow } from '../../types/stack-shadow.types'
import { PixiThemePalette } from '../../types/pixi-theme-palette.types'
import { CARD_CORNER_RADIUS } from '../card/card-corner-radius'
import { isCardDragged } from '../card/card-lift'
import { computeCardLayoutKey } from './stack-geometry'

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
    // The blur pass is costly: rendered once into a texture, reused until the piles move.
    const view = new Container()
    view.label = 'stack-shadow-cache'
    view.eventMode = 'none'
    view.addChild(graphics)
    view.cacheAsTexture(true)
    const shadow = { view, graphics, blur, alpha, layoutKey: '' }
    applyStackShadowTheme(shadow, palette)
    return shadow
}

export function applyStackShadowTheme(shadow: StackShadow, palette: PixiThemePalette['card']['stackShadow']): void {
    shadow.graphics.tint = palette.color
    shadow.blur.strength = palette.blurStrength
    shadow.alpha.alpha = palette.alpha
    // The cached texture still holds the old colors.
    shadow.layoutKey = ''
}

/** Redraws the union of every resting card, so overlapping cards cast a single shadow per pile; a dragged card casts its own. */
export function drawStackShadow(shadow: StackShadow, cards: Card[]): void {
    const layoutKey = computeCardLayoutKey(cards)
    if (layoutKey === shadow.layoutKey) {
        return
    }
    shadow.layoutKey = layoutKey
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
    // The cache only spans the shapes' bounds, which would clip the blur spreading past them.
    const bounds = graphics.getLocalBounds()
    const padding = shadow.blur.padding
    shadow.view.boundsArea = new Rectangle(bounds.x - padding, bounds.y - padding, bounds.width + padding * 2, bounds.height + padding * 2)
    shadow.view.updateCacheTexture()
}
