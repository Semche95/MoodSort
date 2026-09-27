import { Container, Text } from 'pixi.js'
import { Card } from '../../../types/card.types'
import { Position } from '../../../types/position.types'
import { computeStackLabel } from '../stack-naming'
import { STACK_NAME_MAX_WIDTH } from '../stack'
import type { PixiThemePalette } from '../../../types/pixi-theme-palette.types'

const LABEL_FONT_FAMILY = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
const LABEL_FONT_SIZE = 20
// Shared with the inline editor's own max width (STACK_NAME_MAX_WIDTH), so a name never
// reads wider once committed as a label than it did while being typed.
const LABEL_MAX_WIDTH = STACK_NAME_MAX_WIDTH
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
 * Redraws every currently-visible stack name label from a pool of Text
 * instances, reusing existing ones and hiding (not destroying) any surplus
 * from a previous frame that no longer has a label to show. A label is never
 * explicitly hidden because something is dragged over it: whatever's being
 * dragged is simply re-raised above `container` by the caller, so an opaque
 * card passing over a label covers it as an ordinary painter's-algorithm
 * z-order effect, nothing more.
 */
export class StackLabelPool {
    private cardLayer: Container
    private getStackNames: () => Record<string, string>
    private pool: Text[]
    private stageContainer: Container

    constructor(container: Container, cardLayer: Container, getStackNames: () => Record<string, string>) {
        this.stageContainer = container
        this.cardLayer = cardLayer
        this.getStackNames = getStackNames
        this.pool = []
    }

    get container(): Container {
        return this.stageContainer
    }

    update(
        entries: Array<{ stack: Card[]; point: Position }>,
        palette: PixiThemePalette['stackOverlay'],
    ): void {
        const stackNames = this.getStackNames()
        let used = 0
        for (const { stack, point } of entries) {
            const label = computeStackLabel(stack, this.cardLayer, stackNames)
            if (!label) {
                continue
            }
            let text = this.pool[used]
            if (!text) {
                text = new Text({
                    text: '',
                    style: {
                        fontFamily: LABEL_FONT_FAMILY,
                        fontSize: LABEL_FONT_SIZE,
                        fontWeight: 'bold',
                        fill: palette.labelText,
                        stroke: { color: palette.labelStroke, width: 3 },
                    },
                })
                // Top-anchored (not centered): the label only grows downward from
                // computeLabelAnchorPoint, so it never creeps up onto the handle above it.
                text.anchor.set(0.5, 0)
                this.pool.push(text)
                this.stageContainer.addChild(text)
            }
            // Re-applied every frame so a pooled label created under one theme still flips to the other.
            text.style.fill = palette.labelText
            text.style.stroke = { color: palette.labelStroke, width: 3 }
            const measureWidth = (candidate: string): number => {
                text.text = candidate
                return text.width
            }
            text.text = truncateLabel(label, LABEL_MAX_WIDTH, measureWidth)
            text.position.set(point.x, point.y)
            text.visible = true
            used++
        }
        for (let i = used; i < this.pool.length; i++) {
            this.pool[i].visible = false
        }
    }
}
