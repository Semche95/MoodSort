import { describe, expect, it, vi } from 'vitest'
import type { Application, Container } from 'pixi.js'
import { StackOverlay } from '../features/stack/stack-overlay/stack-overlay'
import { computeCompactButtonBox } from '../features/stack/stack'
import { Card } from '../types/card.types'

type Handler = (payload: unknown) => void

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
            this.children.push(child)
            return child
        }
        addChildAt(child: unknown, index: number): unknown {
            this.children.splice(index, 0, child)
            return child
        }
        on(...args: unknown[]): this {
            void args
            return this
        }
        off(): this {
            return this
        }
    }

    class Graphics extends Container {
        calls: Array<{ method: string; args: unknown[] }> = []
        private handlers: Record<string, Handler[]> = {}
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
        quadraticCurveTo(...args: unknown[]): this {
            this.calls.push({ method: 'quadraticCurveTo', args })
            return this
        }
        closePath(...args: unknown[]): this {
            this.calls.push({ method: 'closePath', args })
            return this
        }
        override on(event: string, fn: Handler): this {
            (this.handlers[event] ??= []).push(fn)
            return this
        }
        emit(event: string, payload: unknown): void {
            for (const fn of this.handlers[event] ?? []) {
                fn(payload)
            }
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

describe('StackOverlay compact button', () => {
    it('does not draw the compact button before the stack is hovered', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(110, 110, 200, 300, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        tick()

        const compactButton = overlay.stackCompactButton as unknown as { calls: Array<{ method: string }> }
        expect(compactButton.calls.some((call: { method: string }): boolean => call.method === 'roundRect')).toBe(false)
    })

    it('draws the compact button only once the stack with 2+ overlapping cards is hovered', () => {
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

        const compactButton = overlay.stackCompactButton as unknown as { calls: Array<{ method: string }> }
        expect(compactButton.calls.some((call: { method: string }): boolean => call.method === 'roundRect')).toBe(true)
    })

    it('stops drawing the compact button once the hover leaves the stack', () => {
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
        tick()

        const compactButton = overlay.stackCompactButton as unknown as { calls: Array<{ method: string }> }
        const lastClearIndex = compactButton.calls.map((call: { method: string }): string => call.method).lastIndexOf('clear')
        const callsSinceLastClear = compactButton.calls.slice(lastClearIndex + 1)
        expect(callsSinceLastClear.some((call: { method: string }): boolean => call.method === 'roundRect')).toBe(false)
    })

    it('does not draw the compact button for a lone single-card stack, even when "hovered"', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        overlay.setHoveredStack([cardA])
        tick()

        const compactButton = overlay.stackCompactButton as unknown as { calls: Array<{ method: string }> }
        expect(compactButton.calls.some((call: { method: string }): boolean => call.method === 'roundRect')).toBe(false)
    })

    it('shows a "Compacter le tas" tooltip when hovering the compact button of a multi-card stack', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(110, 110, 200, 300, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        overlay.initCompactButton(vi.fn())
        overlay.setHoveredStack([cardA, cardB])
        tick()

        const compactButton = overlay.stackCompactButton as unknown as { emit(event: string, payload: unknown): void }
        const tooltipView = cardLayer.children[cardLayer.children.length - 1] as {
            visible: boolean
            children: Array<{ text?: string }>
        }
        const box = computeCompactButtonBox([cardA, cardB])!
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        compactButton.emit('pointerover', { global: point })

        expect(tooltipView.visible).toBe(true)
        expect(tooltipView.children[1].text).toBe('Compacter le tas')

        compactButton.emit('pointerout', {})
        expect(tooltipView.visible).toBe(false)
    })
})
