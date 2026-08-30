import { describe, expect, it, vi } from 'vitest'
import { CanvasTooltip } from '../shared/ui/canvas-tooltip'

const { pixi } = vi.hoisted(() => {
    class Container {
        label: string = ''
        visible: boolean = true
        eventMode: string = 'auto'
        x: number = 0
        y: number = 0
        children: unknown[] = []
        position: { set(x: number, y: number): void } = {
            set: (x: number, y: number): void => {
                this.x = x
                this.y = y
            },
        }
        addChild(child: unknown): unknown {
            this.children.push(child)
            return child
        }
    }

    class Graphics extends Container {
        calls: Array<{ method: string; args: unknown[] }> = []
        clear(): this {
            this.calls.push({ method: 'clear', args: [] })
            return this
        }
        roundRect(...args: unknown[]): this {
            this.calls.push({ method: 'roundRect', args })
            return this
        }
        fill(...args: unknown[]): this {
            this.calls.push({ method: 'fill', args })
            return this
        }
    }

    class Text extends Container {
        text: string
        width: number = 40
        height: number = 16
        anchor: { set(x: number, y: number): void } = {
            set: (): void => {},
        }
        constructor(options: { text?: string } = {}) {
            super()
            this.text = options.text ?? ''
        }
    }

    return { pixi: { Container, Graphics, Text } }
})

vi.mock('pixi.js', () => ({ ...pixi }))

describe('CanvasTooltip', () => {
    it('starts hidden and non-interactive', () => {
        const tooltip = new CanvasTooltip()

        expect((tooltip.view as unknown as { visible: boolean }).visible).toBe(false)
        expect((tooltip.view as unknown as { eventMode: string }).eventMode).toBe('none')
    })

    it('shows the label centered on centerX with its top edge at topY', () => {
        const tooltip = new CanvasTooltip()

        tooltip.show(100, 50, 'Annuler')

        const view = tooltip.view as unknown as { visible: boolean; x: number; y: number }
        expect(view.visible).toBe(true)
        expect(view.x).toBe(100)
        // height = text.height (16) + 2 * paddingY (6) = 28, so the center sits 14px below topY.
        expect(view.y).toBe(50 + 28 / 2)
    })

    it('updates the background to fit the new label on every show', () => {
        const tooltip = new CanvasTooltip()

        tooltip.show(0, 0, 'Annuler')
        const bg = (tooltip.view as unknown as { children: Array<{ calls: Array<{ method: string }> }> }).children[0]
        expect(bg.calls.map((call: { method: string }): string => call.method)).toEqual(['clear', 'roundRect', 'fill'])
    })

    it('hides the tooltip', () => {
        const tooltip = new CanvasTooltip()
        tooltip.show(0, 0, 'Annuler')

        tooltip.hide()

        expect((tooltip.view as unknown as { visible: boolean }).visible).toBe(false)
    })
})
