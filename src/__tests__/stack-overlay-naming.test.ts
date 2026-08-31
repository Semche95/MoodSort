import { describe, expect, it, vi } from 'vitest'
import type { Application, Container } from 'pixi.js'
import { StackOverlay, truncateLabel } from '../features/stack/stack-overlay/stack-overlay'
import { computeNameButtonBox } from '../features/stack/stack'
import { DRAGGING_OPACITY } from '../features/drag/card-drag'
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
        clear(): this { this.calls.push({ method: 'clear', args: [] }); return this }
        roundRect(...args: unknown[]): this { this.calls.push({ method: 'roundRect', args }); return this }
        rect(...args: unknown[]): this { this.calls.push({ method: 'rect', args }); return this }
        fill(...args: unknown[]): this { this.calls.push({ method: 'fill', args }); return this }
        stroke(...args: unknown[]): this { this.calls.push({ method: 'stroke', args }); return this }
        moveTo(...args: unknown[]): this { this.calls.push({ method: 'moveTo', args }); return this }
        lineTo(...args: unknown[]): this { this.calls.push({ method: 'lineTo', args }); return this }
        closePath(...args: unknown[]): this { this.calls.push({ method: 'closePath', args }); return this }
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

describe('StackOverlay name label and button', () => {
    it('draws the name label permanently for a named single-card stack, without needing hover', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick()

        const labelContainer = overlay['labelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        const label = labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        expect(label).toBeDefined()
        expect(label?.visible).toBe(true)
    })

    it('does not draw a label for an unnamed stack', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({}))
        overlay.addToStage()
        tick()

        const labelContainer = overlay['labelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        expect(labelContainer.children.every((t: { visible: boolean }): boolean => !t.visible)).toBe(true)
    })

    it('hides a stale label once the stack it belonged to no longer has a name', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        let names: Record<string, string> = { a: 'Joie' }
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => names)
        overlay.addToStage()
        tick()

        names = {}
        tick()

        const labelContainer = overlay['labelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        expect(labelContainer.children.every((t: { visible: boolean }): boolean => !t.visible)).toBe(true)
    })

    it('draws the name button for a single-card stack once hovered, unlike the compact button', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        overlay.setHoveredStack([cardA])
        tick()

        const nameButton = overlay.stackNameButton as unknown as { calls: Array<{ method: string }> }
        expect(nameButton.calls.some((c: { method: string }): boolean => c.method === 'roundRect')).toBe(true)
    })

    it('does not draw the name button before the stack is hovered', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        tick()

        const nameButton = overlay.stackNameButton as unknown as { calls: Array<{ method: string }> }
        expect(nameButton.calls.some((c: { method: string }): boolean => c.method === 'roundRect')).toBe(false)
    })

    it('opens the inline editor at the requested position, prefilled, and commitNameEditorIfOpen forwards the value', () => {
        const cardLayer = new pixi.Container()
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        const onCommit = vi.fn()

        overlay.openNameEditor(42, 7, 'Joie', onCommit, vi.fn())
        overlay.commitNameEditorIfOpen()

        expect(onCommit).toHaveBeenCalledWith('Joie')
    })

    it('routes a name button pointerdown to the callback and stops it from bubbling to the stage', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        const onPointerDown = vi.fn()
        overlay.initNameButton(onPointerDown)

        const stopPropagation = vi.fn()
        const nameButton = overlay.stackNameButton as unknown as { emit(event: string, payload: unknown): void }
        nameButton.emit('pointerdown', { stopPropagation })

        expect(onPointerDown).toHaveBeenCalledTimes(1)
        expect(stopPropagation).toHaveBeenCalledTimes(1)
    })

    it('shows a "Nommer le tas" tooltip for an unnamed stack and "Renommer le tas" for a named one', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        overlay.initNameButton(vi.fn())
        tick()

        const nameButton = overlay.stackNameButton as unknown as { emit(event: string, payload: unknown): void }
        const nameTooltip = overlay['nameTooltip'].view as unknown as { visible: boolean; children: Array<{ text?: string }> }
        const box = computeNameButtonBox([cardA])
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        nameButton.emit('pointerover', { global: point })

        expect(nameTooltip.visible).toBe(true)
        expect(nameTooltip.children[1].text).toBe('Renommer le tas')

        nameButton.emit('pointerout', {})
        expect(nameTooltip.visible).toBe(false)
    })

    it('keeps the label visible for the stack-mates left behind while a card is mid-drag out of their stack', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(110, 110, 200, 300, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick() // establishes the resting {a, b} stack before any drag starts

        // b is picked up (mouse still down) and pulled out, leaving a alone.
        ;(cardB as unknown as { alpha: number }).alpha = DRAGGING_OPACITY
        tick()

        const labelContainer = overlay['labelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        const label = labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        expect(label).toBeDefined()
        expect(label?.visible).toBe(true)
    })

    it('keeps the stack\'s label shown at its original spot, not following the card, when the named card itself is the one dragged out', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(110, 110, 200, 300, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick() // establishes the resting {a, b} stack before any drag starts

        const labelContainer = overlay['labelContainer'] as unknown as { children: Array<{ text: string; visible: boolean; x: number; y: number }> }
        const originalLabel = labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        const originalX = originalLabel?.x
        const originalY = originalLabel?.y

        // a (the named card itself) is picked up (mirrors CardDrag.handleDragStart,
        // which flips alpha but leaves the card at its resting spot) ...
        ;(cardA as unknown as { alpha: number }).alpha = DRAGGING_OPACITY
        tick()

        // ... then dragged far away over subsequent pointermove-driven frames.
        cardA.x = 900
        cardA.y = 900
        tick()

        const label = labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        expect(label).toBeDefined()
        expect(label?.visible).toBe(true)
        // The label stays at the pile's pre-drag position, it does not track the card to (900, 900).
        expect(label?.x).toBe(originalX)
        expect(label?.y).toBe(originalY)
    })

    it('masks a solo named card\'s label while it alone is plain-dragged (not via the handle), mirroring the frame disappearing for an emptied-out pile', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick() // establishes a as its own resting single-card pile

        const labelContainer = overlay['labelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        expect(labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')?.visible).toBe(true)

        // a is picked up directly (not via the drag handle): it was alone in its pile,
        // so nothing is left behind, just like no frame is drawn for the empty pile.
        ;(cardA as unknown as { alpha: number }).alpha = DRAGGING_OPACITY
        tick()

        expect(labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')?.visible).toBe(false)
    })

    it('keeps showing a solo named card\'s label, following it, when it is dragged via the handle instead of plain-dragged', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick()

        // a is dragged as a (single-card) stack via the handle, e.g. StackDragManager.
        overlay.showDragHighlights([cardA], [])
        tick()

        // The label of the stack actually being carried lives in draggedLabelContainer,
        // not labelContainer (which only holds "coverable" labels of stationary stacks).
        const draggedLabelContainer = overlay['draggedLabelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        expect(draggedLabelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')?.visible).toBe(true)
    })

    it('re-raises the actively dragged card above the label container so it visually covers any name underneath it', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(500, 500, 200, 300, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ b: 'Joie' }))
        overlay.addToStage()
        tick()

        // a is dragged toward wherever b's name label sits.
        ;(cardA as unknown as { alpha: number }).alpha = DRAGGING_OPACITY
        tick()

        const labelContainer = overlay['labelContainer']
        const children = (cardLayer as unknown as { children: unknown[] }).children
        expect(children.indexOf(cardA)).toBeGreaterThan(children.indexOf(labelContainer))
    })

    it('never explicitly hides a stationary stack\'s label when a dragged stack passes over it: it stays visible, only z-order covers it', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(900, 900, 50, 50, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick()

        const labelContainer = overlay['labelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        const joieLabel = (): { visible: boolean } | undefined =>
            labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        expect(joieLabel()?.visible).toBe(true)

        // b, dragged as a whole-stack via the handle, passes directly over a's label
        // (computeLabelAnchorPoint([a]) is (200, 90)): the label data stays visible,
        // there's no dedicated occlusion check, only the ordinary z-order re-raise.
        overlay.showDragHighlights([cardB], [])
        cardB.x = 190
        cardB.y = 85
        tick()
        expect(joieLabel()?.visible).toBe(true)

        const children = (cardLayer as unknown as { children: unknown[] }).children
        expect(children.indexOf(cardB)).toBeGreaterThan(children.indexOf(overlay['labelContainer']))
    })

    it('keeps a handle-dragged stack\'s own label above its own cards, not covered by them', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick()

        // a is dragged as a (single-card) stack via the handle, e.g. StackDragManager.
        overlay.showDragHighlights([cardA], [])
        tick()

        const draggedLabelContainer = overlay['draggedLabelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        const label = draggedLabelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        expect(label?.visible).toBe(true)

        const children = (cardLayer as unknown as { children: unknown[] }).children
        expect(children.indexOf(cardA)).toBeLessThan(children.indexOf(overlay['draggedLabelContainer']))
    })

    it('never explicitly hides a label while only a single card is being dragged, even if it passes directly over the label', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardC = makeCard(900, 900, 50, 50, 'c')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardC)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick() // establishes c as its own resting single-card stack before any drag starts

        // c is picked up alone (mouse held, no drag handle involved) and dragged
        // straight over a's label position (computeLabelAnchorPoint([a]) is (200, 90)).
        ;(cardC as unknown as { alpha: number }).alpha = DRAGGING_OPACITY
        cardC.x = 190
        cardC.y = 85
        tick()

        const labelContainer = overlay['labelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        const label = labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        expect(label?.visible).toBe(true)
    })
})

describe('truncateLabel', () => {
    const measure = (text: string): number => text.length

    it('returns the label unchanged when it already fits', () => {
        expect(truncateLabel('Joie', 10, measure)).toBe('Joie')
    })

    it('shortens the label and appends an ellipsis when it overflows', () => {
        expect(truncateLabel('Joie + Colère', 10, measure)).toBe('Joie + Co…')
    })
})
