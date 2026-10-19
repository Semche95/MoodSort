import { Container, Text } from 'pixi.js'
import { StackLabel } from '../../../types/stack-label.types'
import { STACK_NAME_FONT_FAMILY, STACK_NAME_FONT_SIZE } from '../stack'
import type { PixiThemePalette } from '../../../types/pixi-theme-palette.types'

const LABEL_ELLIPSIS = '…'

/**
 * Shortens `label` with a trailing ellipsis until `measureWidth` reports it
 * fits within `maxWidth`, so a label is never measured against Pixi's Text
 * layout directly in tests (the `measureWidth` callback is what's mocked).
 */
export function truncateLabel(label: string, maxWidth: number, measureWidth: (text: string) => number): string {
    if (measureWidth(label) <= maxWidth) {
        return label
    }
    let truncated = label
    while (truncated.length > 1 && measureWidth(truncated + LABEL_ELLIPSIS) > maxWidth) {
        truncated = truncated.slice(0, -1)
    }
    return truncated + LABEL_ELLIPSIS
}

/**
 * Pool of stack name texts, refilled every frame: `begin` frees every text,
 * `take` hands one out already truncated to its pill (so the caller can size
 * the pill around it), and `end` hides whatever this frame didn't use.
 * Texts are reused rather than recreated, and never destroyed.
 */
export class StackLabelPool {
    private pool: Text[]
    private used: number
    private stageContainer: Container

    constructor(container: Container) {
        this.stageContainer = container
        this.pool = []
        this.used = 0
    }

    get container(): Container {
        return this.stageContainer
    }

    begin(): void {
        this.used = 0
    }

    take(label: string, maxWidth: number, palette: PixiThemePalette['stackOverlay']): StackLabel {
        let text = this.pool[this.used]
        if (!text) {
            text = new Text({
                text: '',
                style: {
                    fontFamily: STACK_NAME_FONT_FAMILY,
                    fontSize: STACK_NAME_FONT_SIZE,
                    fontWeight: '600',
                    fill: palette.labelText,
                },
            })
            // Left edge on the name slot, vertically centered on the pill.
            text.anchor.set(0, 0.5)
            this.pool.push(text)
            this.stageContainer.addChild(text)
        }
        this.used++
        // Re-applied every frame so a pooled label created under one theme still flips to the other.
        text.style.fill = palette.labelText
        const measureWidth = (candidate: string): number => {
            text.text = candidate
            return text.width
        }
        const shown = truncateLabel(label, maxWidth, measureWidth)
        text.text = shown
        text.visible = true
        return { text, truncated: shown !== label }
    }

    end(): void {
        for (let i = this.used; i < this.pool.length; i++) {
            this.pool[i].visible = false
        }
    }
}
