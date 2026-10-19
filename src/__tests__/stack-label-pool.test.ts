import { describe, expect, it, vi } from 'vitest'
import { StackLabelPool, truncateLabel } from '../features/stack/stack-overlay/stack-label-pool'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'

const { pixi } = vi.hoisted(() => {
    class Container {
        label: string = ''
        eventMode: string = 'auto'
        children: unknown[] = []
        addChild(child: unknown): unknown {
            const existing = this.children.indexOf(child)
            if (existing !== -1) this.children.splice(existing, 1)
            this.children.push(child)
            return child
        }
    }

    class Text extends Container {
        text: string
        width: number = 40
        height: number = 16
        visible: boolean = true
        x: number = 0
        y: number = 0
        anchor: { set(x: number, y: number): void } = { set: (): void => {} }
        position: { set(x: number, y: number): void } = {
            set: (x: number, y: number): void => {
                this.x = x
                this.y = y
            },
        }
        style: Record<string, unknown>
        constructor(options: { text?: string; style?: Record<string, unknown> } = {}) {
            super()
            this.text = options.text ?? ''
            this.style = options.style ?? {}
        }
    }

    return { pixi: { Container, Text } }
})

vi.mock('pixi.js', () => ({ ...pixi }))

describe('truncateLabel', () => {
    const measure = (text: string): number => text.length

    it('returns the label unchanged when it already fits', () => {
        expect(truncateLabel('Joie', 10, measure)).toBe('Joie')
    })

    it('shortens the label and appends an ellipsis when it overflows', () => {
        expect(truncateLabel('Joie + Colère', 10, measure)).toBe('Joie + Co…')
    })
})

describe('StackLabelPool', () => {
    const palette = getPixiThemeColors('light').stackOverlay

    it('reuses pooled Text instances across frames instead of creating new ones each time', () => {
        const stageContainer = new pixi.Container()
        const pool = new StackLabelPool(stageContainer as never)

        pool.begin()
        const first = pool.take('Joie', 100, palette).text
        pool.end()
        pool.begin()
        const second = pool.take('Colère', 100, palette).text
        pool.end()

        expect(stageContainer.children.length).toBe(1)
        expect(second).toBe(first)
    })

    it('hides surplus texts a frame no longer uses', () => {
        const stageContainer = new pixi.Container()
        const pool = new StackLabelPool(stageContainer as never)

        pool.begin()
        const first = pool.take('Joie', 100, palette).text
        const second = pool.take('Colère', 100, palette).text
        pool.end()
        pool.begin()
        pool.take('Joie', 100, palette)
        pool.end()

        expect(first.visible).toBe(true)
        expect(second.visible).toBe(false)
    })

    it('truncates a label wider than maxWidth and reports it as truncated', () => {
        const stageContainer = new pixi.Container()
        const pool = new StackLabelPool(stageContainer as never)

        pool.begin()
        // The mocked Text is always 40px wide, wider than this 30px slot.
        const label = pool.take('Joie', 30, palette)

        expect(label.truncated).toBe(true)
        expect(label.text.text.endsWith('…')).toBe(true)
    })

    it('keeps a label that fits as is and reports it as not truncated', () => {
        const stageContainer = new pixi.Container()
        const pool = new StackLabelPool(stageContainer as never)

        pool.begin()
        const label = pool.take('Joie', 100, palette)

        expect(label.truncated).toBe(false)
        expect(label.text.text).toBe('Joie')
    })

    it('applies the palette label color to the text', () => {
        const stageContainer = new pixi.Container()
        const pool = new StackLabelPool(stageContainer as never)

        pool.begin()
        const { text } = pool.take('Joie', 100, palette)

        expect((text.style as unknown as { fill: number }).fill).toBe(palette.labelText)
    })
})
