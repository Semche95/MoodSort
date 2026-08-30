import { describe, expect, it, vi } from 'vitest'
import type { Application, Container } from 'pixi.js'
import { StackOverlay } from '../features/stack/stack-overlay/stack-overlay'
import { Card } from '../types/card.types'

const { pixi } = vi.hoisted(() => {
    class Container {
        label: string = ''
        x: number = 0
        y: number = 0
        width: number = 0
        height: number = 0
        eventMode: string = 'auto'
        cursor: string = 'default'
        visible: boolean = true
        children: unknown[] = []
        position: { set(x: number, y: number): void } = {
            set: (x: number, y: number): void => {
                this.x = x
                this.y = y
            },
        }
        addChild(child: unknown): unknown {
            const existing = this.children.indexOf(child)
            if (existing !== -1) this.children.splice(existing, 1)
            this.children.push(child)
            return child
        }
        addChildAt(child: unknown, index: number): unknown {
            const existing = this.children.indexOf(child)
            if (existing !== -1) this.children.splice(existing, 1)
            this.children.splice(index, 0, child)
            return child
        }
        on(): this { return this }
        off(): this { return this }
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
        rect(...args: unknown[]): this {
            this.calls.push({ method: 'rect', args })
            return this
        }
        fill(...args: unknown[]): this {
            this.calls.push({ method: 'fill', args })
            return this
        }
        stroke(...args: unknown[]): this {
            this.calls.push({ method: 'stroke', args })
            return this
        }
        moveTo(...args: unknown[]): this {
            this.calls.push({ method: 'moveTo', args })
            return this
        }
        lineTo(...args: unknown[]): this {
            this.calls.push({ method: 'lineTo', args })
            return this
        }
        closePath(...args: unknown[]): this {
            this.calls.push({ method: 'closePath', args })
            return this
        }
    }

    class Text extends Container {
        text: string
        override width: number = 40
        override height: number = 16
        anchor: { set(x: number, y: number): void } = { set: (): void => {} }
        constructor(options: { text?: string } = {}) {
            super()
            this.text = options.text ?? ''
        }
    }

    return { pixi: { Container, Graphics, Text } }
})

vi.mock('pixi.js', () => ({ ...pixi }))

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { imageUrl, x, y, width, height, alpha: 1 } as unknown as Card
}

function createApp(): { tick: () => void; app: Application } {
    let tickFn: (() => void) | null = null
    const app = {
        ticker: {
            add: (fn: () => void): void => {
                tickFn = fn
            },
        },
    } as unknown as Application
    return { app, tick: (): void => tickFn?.() }
}

describe('StackOverlay', () => {
    it('showHighlight clears any pending merge indicator drawing', () => {
        const cardLayer = new pixi.Container()
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)

        const mergeIndicator = overlay['mergeIndicator'] as unknown as { calls: Array<{ method: string }> }
        const mergePlus = overlay['mergePlus'] as unknown as { calls: Array<{ method: string }> }

        overlay.showHighlight([makeCard(0, 0, 200, 300, 'a')])

        expect(mergeIndicator.calls.some((c: { method: string }): boolean => c.method === 'clear')).toBe(true)
        expect(mergePlus.calls.some((c: { method: string }): boolean => c.method === 'clear')).toBe(true)
    })

    it('hide clears the merge indicator and plus icon', () => {
        const cardLayer = new pixi.Container()
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)

        const mergeIndicator = overlay['mergeIndicator'] as unknown as { calls: Array<{ method: string }> }
        const mergePlus = overlay['mergePlus'] as unknown as { calls: Array<{ method: string }> }
        mergeIndicator.calls = []
        mergePlus.calls = []

        overlay.hide()

        expect(mergeIndicator.calls).toEqual([{ method: 'clear', args: [] }])
        expect(mergePlus.calls).toEqual([{ method: 'clear', args: [] }])
    })

    it('showDragHighlights re-parents the dragged cards, its own border/handle, and draws merge targets on top of the card layer', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        const b = makeCard(300, 0, 200, 300, 'b')
        cardLayer.addChild(a)
        cardLayer.addChild(b)
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)

        overlay.showDragHighlights([a], [[b]])

        expect(cardLayer.children.indexOf(a)).toBeGreaterThan(cardLayer.children.indexOf(b))
        expect(cardLayer.children).toContain(overlay['draggedBorder'])
        expect(cardLayer.children).toContain(overlay['draggedHandle'])
        const mergeIndicator = overlay['mergeIndicator'] as unknown as { calls: Array<{ method: string }> }
        expect(mergeIndicator.calls.some((c: { method: string }): boolean => c.method === 'rect')).toBe(true)
    })

    it('showDragHighlights does not draw merge indicators when there are no merge targets', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        cardLayer.addChild(a)
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)

        overlay.showDragHighlights([a], [])

        const mergeIndicator = overlay['mergeIndicator'] as unknown as { calls: Array<{ method: string }> }
        expect(mergeIndicator.calls.some((c: { method: string }): boolean => c.method === 'rect')).toBe(false)
    })

    it('restoreZOrder resets the dragged-cards tracking and re-raises the permanent border/handle/compact button', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        cardLayer.addChild(a)
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.showDragHighlights([a], [])

        overlay.restoreZOrder()

        expect(cardLayer.children.indexOf(overlay.stackBorder)).toBe(0)
        expect(cardLayer.children.indexOf(overlay.stackDragHandle)).toBe(1)
        expect(cardLayer.children.indexOf(overlay.stackCompactButton)).toBe(2)
    })

    it('setHoveredStack(null) makes the render loop stop drawing the compact button even for a previously hovered stack', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(110, 110, 200, 300, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()

        overlay.setHoveredStack([cardA, cardB])
        tick()
        overlay.setHoveredStack(null)

        const compactButton = overlay.stackCompactButton as unknown as { calls: Array<{ method: string }> }
        compactButton.calls = []
        tick()

        expect(compactButton.calls.some((c: { method: string }): boolean => c.method === 'roundRect')).toBe(false)
    })
})
