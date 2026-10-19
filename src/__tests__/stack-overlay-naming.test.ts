import { describe, expect, it, vi } from 'vitest'
import type { Application, Container } from 'pixi.js'
import { StackOverlay } from '../features/stack/stack-overlay/stack-overlay'
import { computeStackNameMaxWidth, computeStackPillLayout } from '../features/stack/stack-hit-testing'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'
import { createCardLift } from '../features/card/card-lift'
import { Card } from '../types/card.types'
import { StackOverlayEntry } from '../types/stack-overlay-entry.types'
import { I18n } from '../i18n/I18n'

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
        circle(...args: unknown[]): this { this.calls.push({ method: 'circle', args }); return this }
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
        style: Record<string, unknown>
        constructor(options: { text?: string; style?: Record<string, unknown> } = {}) {
            super()
            this.text = options.text ?? ''
            this.style = options.style ?? {}
        }
    }

    return { pixi: { Container, Graphics, Text } }
})

vi.mock('pixi.js', () => ({ ...pixi }))

function makeCard(x: number, y: number, width: number, height: number, imageUrl: string): Card {
    return { imageUrl, x, y, width, height, lift: createCardLift() } as unknown as Card
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

        const labelContainer = overlay['labelPool'].container as unknown as { children: Array<{ text: string; visible: boolean }> }
        const label = labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        expect(label).toBeDefined()
        expect(label?.visible).toBe(true)
    })

    it('draws the frame and pill with the dark theme colors when the injected getResolvedTheme reports dark, re-read fresh on every render', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(300, 100, 200, 300, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)

        let theme: 'light' | 'dark' = 'light'
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({}), () => theme)
        overlay.addToStage()
        tick()

        const border = overlay.stackBorder as unknown as { calls: Array<{ method: string; args: unknown[] }> }
        const handle = overlay.stackDragHandle as unknown as { calls: Array<{ method: string; args: unknown[] }> }
        const strokeColor = (): number => (border.calls.filter((c: { method: string }): boolean => c.method === 'stroke').pop()!.args[0] as { color: number }).color
        const fillColors = (): number[] => handle.calls
            .filter((c: { method: string }): boolean => c.method === 'fill')
            .map((c: { args: unknown[] }): number => (c.args[0] as { color: number }).color)
        const light = getPixiThemeColors('light').stackOverlay
        expect(strokeColor()).toBe(light.frame)
        expect(fillColors()).toContain(light.pill)

        theme = 'dark'
        border.calls = []
        handle.calls = []
        tick()

        const dark = getPixiThemeColors('dark').stackOverlay
        expect(strokeColor()).toBe(dark.frame)
        expect(fillColors()).toContain(dark.pill)
    })

    it('tints only the hovered stack frame with the accent', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        const border = overlay.stackBorder as unknown as { calls: Array<{ method: string; args: unknown[] }> }
        const strokeColor = (): number => (border.calls.filter((c: { method: string }): boolean => c.method === 'stroke').pop()!.args[0] as { color: number }).color
        const palette = getPixiThemeColors('light').stackOverlay

        tick()
        expect(strokeColor()).toBe(palette.frame)

        overlay.setHoveredStack([cardA])
        tick()
        expect(strokeColor()).toBe(palette.accent)
    })

    it('does not draw a label for an unnamed stack', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({}))
        overlay.addToStage()
        tick()

        const labelContainer = overlay['labelPool'].container as unknown as { children: Array<{ text: string; visible: boolean }> }
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

        const labelContainer = overlay['labelPool'].container as unknown as { children: Array<{ text: string; visible: boolean }> }
        expect(labelContainer.children.every((t: { visible: boolean }): boolean => !t.visible)).toBe(true)
    })

    it('draws the rename button on every stack, faded at rest and fully shown once hovered', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        const nameButton = overlay.stackNameButton as unknown as { calls: Array<{ method: string; args: unknown[] }> }
        const iconAlpha = (): number => (nameButton.calls.filter((c: { method: string }): boolean => c.method === 'fill').pop()!.args[0] as { alpha: number }).alpha

        tick()
        const restAlpha = iconAlpha()
        overlay.setHoveredStack([cardA])
        tick()

        expect(restAlpha).toBeGreaterThan(0)
        expect(iconAlpha()).toBeGreaterThan(restAlpha)
    })

    it('draws a hover chip behind the rename button while the pointer is over it, and drops it once the pointer leaves', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        overlay.initNameButton(vi.fn())
        overlay.setHoveredStack([cardA])
        tick()
        const nameButton = overlay.stackNameButton as unknown as {
            calls: Array<{ method: string }>
            emit(event: string, payload: unknown): void
        }
        const hasChip = (): boolean => nameButton.calls.slice(nameButton.calls.map((c: { method: string }): string => c.method).lastIndexOf('clear')).some((c: { method: string }): boolean => c.method === 'circle')
        const { pencil } = (overlay['entries'] as StackOverlayEntry[])[0].layout

        expect(hasChip()).toBe(false)
        nameButton.emit('pointerover', { global: { x: pencil.x + 1, y: pencil.y + 1 } })
        tick()
        expect(hasChip()).toBe(true)
        nameButton.emit('pointerout', {})
        tick()
        expect(hasChip()).toBe(false)
    })

    it('finds the stack whose rename button is under a point, as drawn on the last frame', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick()

        const { pencil } = (overlay['entries'] as StackOverlayEntry[])[0].layout

        expect(overlay.findStackByNameButtonAtPoint({ x: pencil.x + 1, y: pencil.y + 1 })).toEqual([cardA])
        expect(overlay.findStackByNameButtonAtPoint({ x: 0, y: 0 })).toBeNull()
    })

    it('opens the inline editor over the stack pill, prefilled, and commitNameEditorIfOpen forwards the value', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        const onCommit = vi.fn()

        overlay.openNameEditor([cardA], 'Joie', onCommit, vi.fn())
        const editor = overlay['nameEditor'].view as unknown as { x: number; y: number }
        const { frame } = computeStackPillLayout({ x: 100, y: 100, width: 200, height: 300 }, null)
        expect(editor.x).toBe(frame.x + frame.width / 2)
        expect(editor.y).toBe(frame.y)

        overlay.commitNameEditorIfOpen()
        expect(onCommit).toHaveBeenCalledWith('Joie')
    })

    it('hides the edited stack\'s own name while its editor is open, and shows it again once closed', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        const labelContainer = overlay['labelPool'].container as unknown as { children: Array<{ text: string; visible: boolean }> }
        const labelVisible = (): boolean => labelContainer.children.some((t: { text: string; visible: boolean }): boolean => t.text === 'Joie' && t.visible)

        overlay.openNameEditor([cardA], 'Joie', vi.fn(), vi.fn())
        tick()
        expect(labelVisible()).toBe(false)

        overlay.commitNameEditorIfOpen()
        tick()
        expect(labelVisible()).toBe(true)
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
        const { pencil } = (overlay['entries'] as StackOverlayEntry[])[0].layout
        const point = { x: pencil.x + pencil.width / 2, y: pencil.y + pencil.height / 2 }

        nameButton.emit('pointerover', { global: point })

        expect(nameTooltip.visible).toBe(true)
        expect(nameTooltip.children[1].text).toBe(I18n.t('stack.nameTooltipNamed'))

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
        cardB.lift.reasons.add('drag')
        tick()

        const labelContainer = overlay['labelPool'].container as unknown as { children: Array<{ text: string; visible: boolean }> }
        const label = labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        expect(label).toBeDefined()
        expect(label?.visible).toBe(true)
    })

    it('keeps the name on the pile left behind, not following the card, when the named card itself is dragged out', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(110, 110, 200, 300, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick() // establishes the resting {a, b} stack before any drag starts

        // a (the named card itself) is picked up, then dragged far away.
        cardA.lift.reasons.add('drag')
        tick()
        cardA.x = 900
        cardA.y = 900
        tick()

        const labelContainer = overlay['labelPool'].container as unknown as { children: Array<{ text: string; visible: boolean; x: number; y: number }> }
        const label = labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        // The mocked Text is 40px wide; the name sits in the pill of b, the pile left behind.
        const { name } = computeStackPillLayout({ x: 110, y: 110, width: 200, height: 300 }, 40)
        expect(label?.visible).toBe(true)
        expect(label?.x).toBe(name!.x)
        expect(label?.y).toBe(name!.y)
    })

    it('spells out a truncated name in a tooltip wrapped to the frame width when its pill is hovered', () => {
        const cardLayer = new pixi.Container()
        // Too narrow for the mocked 40px-wide text, so the name gets truncated.
        const cardA = makeCard(100, 100, 60, 300, 'a')
        cardLayer.addChild(cardA)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        overlay.initHandle(vi.fn())
        tick()
        expect(computeStackNameMaxWidth({ x: 100, y: 100, width: 60, height: 300 })).toBeLessThan(40)

        const handle = overlay.stackDragHandle as unknown as { emit(event: string, payload: unknown): void }
        const tooltip = overlay['nameTooltip'].view as unknown as { visible: boolean; children: Array<{ text?: string; style?: { wordWrapWidth?: number } }> }
        const { pill, frame } = (overlay['entries'] as StackOverlayEntry[])[0].layout
        handle.emit('pointerover', { global: { x: pill.x + 1, y: pill.y + 1 } })

        expect(tooltip.visible).toBe(true)
        expect(tooltip.children[1].text).toBe('Joie')
        expect(tooltip.children[1].style?.wordWrapWidth).toBeLessThan(frame.width)

        handle.emit('pointerout', {})
        expect(tooltip.visible).toBe(false)
    })

    it('shows no tooltip when hovering the pill of a name that fits', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        overlay.initHandle(vi.fn())
        tick()

        const handle = overlay.stackDragHandle as unknown as { emit(event: string, payload: unknown): void }
        const tooltip = overlay['nameTooltip'].view as unknown as { visible: boolean }
        const { pill } = (overlay['entries'] as StackOverlayEntry[])[0].layout
        handle.emit('pointerover', { global: { x: pill.x + 1, y: pill.y + 1 } })

        expect(tooltip.visible).toBe(false)
    })

    it('masks a solo named card\'s label while it alone is plain-dragged (not via the handle), mirroring the frame disappearing for an emptied-out pile', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        cardLayer.addChild(cardA)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ a: 'Joie' }))
        overlay.addToStage()
        tick() // establishes a as its own resting single-card pile

        const labelContainer = overlay['labelPool'].container as unknown as { children: Array<{ text: string; visible: boolean }> }
        expect(labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')?.visible).toBe(true)

        // a is picked up directly (not via the drag handle): it was alone in its pile,
        // so nothing is left behind, just like no frame is drawn for the empty pile.
        cardA.lift.reasons.add('drag')
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
        // not in the pill layer under the cards, which only holds stationary stacks' labels.
        const draggedLabelContainer = overlay['draggedLabelContainer'] as unknown as { children: Array<{ text: string; visible: boolean }> }
        expect(draggedLabelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')?.visible).toBe(true)
    })

    it('keeps stationary stacks\' names in their pill layer, under every card, so a neighbouring pile covers name and pill alike', () => {
        const cardLayer = new pixi.Container()
        const cardA = makeCard(100, 100, 200, 300, 'a')
        const cardB = makeCard(500, 500, 200, 300, 'b')
        cardLayer.addChild(cardA)
        cardLayer.addChild(cardB)

        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({ b: 'Joie' }))
        overlay.addToStage()
        cardA.lift.reasons.add('drag')
        tick()

        const children = (cardLayer as unknown as { children: unknown[] }).children
        const pillLayer = overlay['pillTopLayer']
        expect((pillLayer as unknown as { children: unknown[] }).children).toEqual([overlay['labelPool'].container, overlay.stackNameButton])
        expect(children.indexOf(pillLayer)).toBe(3)
        expect(children.indexOf(pillLayer)).toBeLessThan(children.indexOf(cardA))
        expect(children.indexOf(pillLayer)).toBeLessThan(children.indexOf(cardB))
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

        const labelContainer = overlay['labelPool'].container as unknown as { children: Array<{ text: string; visible: boolean }> }
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
        expect(children.indexOf(cardB)).toBeGreaterThan(children.indexOf(overlay['pillTopLayer']))
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
        cardC.lift.reasons.add('drag')
        cardC.x = 190
        cardC.y = 85
        tick()

        const labelContainer = overlay['labelPool'].container as unknown as { children: Array<{ text: string; visible: boolean }> }
        const label = labelContainer.children.find((t: { text: string }): boolean => t.text === 'Joie')
        expect(label?.visible).toBe(true)
    })
})
