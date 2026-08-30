import { Container, Graphics, Text } from 'pixi.js'

const PADDING_X = 10
const PADDING_Y = 6
const RADIUS = 6
const FONT_SIZE = 13
const BG_COLOR = 0x111111
const BG_ALPHA = 0.92
const TEXT_COLOR = 0xffffff
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

    constructor() {
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
                fill: TEXT_COLOR,
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
     */
    show(centerX: number, topY: number, label: string): void {
        this.text.text = label
        const width = this.text.width + PADDING_X * 2
        const height = this.text.height + PADDING_Y * 2
        this.bg.clear()
        this.bg.roundRect(-width / 2, -height / 2, width, height, RADIUS)
        this.bg.fill({ color: BG_COLOR, alpha: BG_ALPHA })
        this.view.position.set(centerX, topY + height / 2)
        this.view.visible = true
    }

    hide(): void {
        this.view.visible = false
    }
}
