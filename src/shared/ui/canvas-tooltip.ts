import { Container, Graphics, Text } from 'pixi.js'
import type { ResolvedTheme } from '../../types/theme.types'
import { getPixiThemeColors } from '../../features/theme/pixi-theme-colors'

const PADDING_X = 10
const PADDING_Y = 6
const RADIUS = 6
const FONT_SIZE = 13
const BG_ALPHA = 0.92
const FONT_FAMILY = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

/**
 * Canvas-rendered tooltip: a rounded label that can be shown above/below any
 * point in stage space. Kept as a single reusable instance per owner so only
 * one tooltip is ever visible at a time.
 */
export class CanvasTooltip {
    readonly view: Container
    private readonly bg: Graphics
    private readonly text: Text
    private readonly getResolvedTheme: () => ResolvedTheme

    constructor(getResolvedTheme: () => ResolvedTheme = (): ResolvedTheme => 'light') {
        this.getResolvedTheme = getResolvedTheme
        this.view = new Container()
        this.view.label = 'canvas-tooltip'
        this.view.visible = false
        this.view.eventMode = 'none'

        this.bg = new Graphics()
        this.bg.label = 'canvas-tooltip-bg'
        this.bg.roundPixels = true

        this.text = new Text({
            text: '',
            roundPixels: true,
            style: {
                fontFamily: FONT_FAMILY,
                fontSize: FONT_SIZE,
                fill: getPixiThemeColors(this.getResolvedTheme()).tooltip.text,
            },
        })
        this.text.label = 'canvas-tooltip-text'
        this.text.anchor.set(0.5)

        this.view.addChild(this.bg)
        this.view.addChild(this.text)
    }

    /**
     * Shows the tooltip centered horizontally on `centerX`, with its top edge
     * at `topY`. The tooltip's own height is only known once the label text
     * is set, so callers pass a top edge rather than a center point.
     * The theme is re-read on every call so a theme flip is picked up on the next show().
     */
    show(centerX: number, topY: number, label: string): void {
        const palette = getPixiThemeColors(this.getResolvedTheme()).tooltip
        this.text.text = label
        this.text.style.fill = palette.text
        const width = this.text.width + PADDING_X * 2
        const height = this.text.height + PADDING_Y * 2
        this.bg.clear()
        this.bg.roundRect(-width / 2, -height / 2, width, height, RADIUS)
        this.bg.fill({ color: palette.background, alpha: BG_ALPHA })
        this.view.position.set(centerX, topY + height / 2)
        this.view.visible = true
    }

    hide(): void {
        this.view.visible = false
    }
}
