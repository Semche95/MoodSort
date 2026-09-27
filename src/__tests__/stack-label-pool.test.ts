import { describe, expect, it, vi } from 'vitest'
import { StackLabelPool, truncateLabel } from '../features/stack/stack-overlay/stack-label-pool'
import { Card } from '../types/card.types'
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

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { imageUrl, x, y, width, height, alpha: 1 } as unknown as Card
}

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

    it('reuses pooled Text instances across repeated update calls instead of creating new ones each time', () => {
        const cardLayer = new pixi.Container()
        const stageContainer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const pool = new StackLabelPool(stageContainer as never, cardLayer as never, () => ({ a: 'Joie' }))

        pool.update([{ stack: [cardA], point: { x: 1, y: 2 } }], palette)
        const firstText = stageContainer.children[0]
        pool.update([{ stack: [cardA], point: { x: 3, y: 4 } }], palette)

        expect(stageContainer.children.length).toBe(1)
        expect(stageContainer.children[0]).toBe(firstText)
    })

    it('hides surplus pool entries that are no longer used when the entry count shrinks between calls', () => {
        const cardLayer = new pixi.Container()
        const stageContainer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(400, 100, 200, 300, 'b')
        const pool = new StackLabelPool(stageContainer as never, cardLayer as never, () => ({ a: 'Joie', b: 'Colère' }))

        pool.update(
            [
                { stack: [cardA], point: { x: 1, y: 2 } },
                { stack: [cardB], point: { x: 5, y: 6 } },
            ],
            palette,
        )
        const texts = stageContainer.children as unknown as Array<{ visible: boolean; text: string }>
        expect(texts.every((t: { visible: boolean }): boolean => t.visible)).toBe(true)

        pool.update([{ stack: [cardA], point: { x: 1, y: 2 } }], palette)
        expect(texts[0].visible).toBe(true)
        expect(texts[1].visible).toBe(false)
    })

    it('applies palette colors to the text style', () => {
        const cardLayer = new pixi.Container()
        const stageContainer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const pool = new StackLabelPool(stageContainer as never, cardLayer as never, () => ({ a: 'Joie' }))

        pool.update([{ stack: [cardA], point: { x: 1, y: 2 } }], palette)

        const text = stageContainer.children[0] as unknown as { style: { fill: number; stroke: { color: number } } }
        expect(text.style.fill).toBe(palette.labelText)
        expect(text.style.stroke.color).toBe(palette.labelStroke)
    })
})
