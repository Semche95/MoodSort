import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { Box } from '../../../types/box.types'
import { ViewportSize } from '../../../types/viewport-size.types'
import { StackSpreadItem } from '../../../types/stack-spread-item.types'
import { StackSpreadScrollbar } from '../../../types/stack-spread-scrollbar.types'
import { StackSpreadPillLayout } from '../../../types/stack-spread-pill-layout.types'
import type { PixiThemePalette } from '../../../types/pixi-theme-palette.types'
import { drawCardHighlight, drawCardShadowShape } from '../../card/card-manager'
import { REST_SHADOW_OFFSET_Y } from '../../card/card-lift'
import { drawCloseIcon, drawControlHover, drawPillShape } from '../stack-overlay/stack-overlay-view'

/** Board shows through faintly: the spread reads as a layer above it, not a separate screen. */
const VEIL_ALPHA = 0.82
const SCROLLBAR_TRACK_ALPHA = 0.15
const SCROLLBAR_THUMB_ALPHA = 0.6

export function createSpreadItem(): StackSpreadItem {
    const view = new Container()
    view.eventMode = 'static'
    view.cursor = 'grab'
    const shadow = new Graphics()
    const sprite = new Sprite(Texture.EMPTY)
    const highlight = new Graphics()
    highlight.visible = false
    view.addChild(shadow)
    view.addChild(sprite)
    view.addChild(highlight)
    return { view, shadow, sprite, highlight, card: null }
}

/** Draws `item` over `cell` as its board card looks at rest, outlined while hovered. */
export function drawSpreadItem(item: StackSpreadItem, cell: Box, texture: Texture, hovered: boolean, palette: PixiThemePalette['card']): void {
    const scale = cell.width / texture.width
    item.view.position.set(cell.x, cell.y)
    item.view.scale.set(scale)
    item.view.hitArea = new Rectangle(0, 0, texture.width, texture.height)
    item.sprite.texture = texture
    item.shadow.clear()
    drawCardShadowShape(item.shadow, texture.width, texture.height)
    item.shadow.tint = palette.shadow.color
    item.shadow.alpha = palette.shadow.restAlpha
    item.shadow.y = REST_SHADOW_OFFSET_Y
    // Scaled with the cell: the outline keeps the board's on-screen width only once divided back.
    drawCardHighlight(item.highlight, texture.width, texture.height, { ...palette.hoverOutline, width: palette.hoverOutline.width / scale })
    item.highlight.visible = hovered
    item.view.visible = true
}

/** Background-colored wash over the whole board, under the spread cards. */
export function drawSpreadVeil(g: Graphics, viewport: ViewportSize, palette: PixiThemePalette): void {
    g.clear()
    g.rect(0, 0, viewport.width, viewport.height)
    g.fill({ color: palette.canvasBackground, alpha: VEIL_ALPHA })
}

export function drawSpreadScrollbar(g: Graphics, scrollbar: StackSpreadScrollbar | null, palette: PixiThemePalette['stackOverlay']): void {
    g.clear()
    if (!scrollbar) {
        g.hitArea = null
        return
    }
    const { track, thumb, hitArea } = scrollbar
    g.hitArea = new Rectangle(hitArea.x, hitArea.y, hitArea.width, hitArea.height)
    g.roundRect(track.x, track.y, track.width, track.height, track.width / 2)
    g.fill({ color: palette.frame, alpha: SCROLLBAR_TRACK_ALPHA })
    g.roundRect(thumb.x, thumb.y, thumb.width, thumb.height, thumb.width / 2)
    g.fill({ color: palette.frame, alpha: SCROLLBAR_THUMB_ALPHA })
}

/** Pill background and close button; the label text is positioned by its owner. */
export function drawSpreadPill(pill: Graphics, closeButton: Graphics, layout: StackSpreadPillLayout, closeHovered: boolean, palette: PixiThemePalette['stackOverlay']): void {
    pill.clear()
    drawPillShape(pill, layout.pill, palette)
    closeButton.clear()
    const { close } = layout
    closeButton.hitArea = new Rectangle(close.x, close.y, close.width, close.height)
    if (closeHovered) {
        drawControlHover(close, closeButton, palette)
    }
    drawCloseIcon(close, closeButton, closeHovered ? palette.accent : palette.controlIcon)
}
