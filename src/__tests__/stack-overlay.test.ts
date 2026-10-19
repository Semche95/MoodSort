import { describe, expect, it, vi } from 'vitest'
import type { Application, Container } from 'pixi.js'
import { StackOverlay } from '../features/stack/stack-overlay/stack-overlay'
import { Card } from '../types/card.types'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'
import { createCardLift } from '../features/card/card-lift'

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
        circle(...args: unknown[]): this {
            this.calls.push({ method: 'circle', args })
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
    return { imageUrl, x, y, width, height, scale: { x: 1, y: 1 }, lift: createCardLift() } as unknown as Card
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
        expect(mergeIndicator.calls.some((c: { method: string }): boolean => c.method === 'roundRect')).toBe(true)
    })

    it('showDragHighlights draws merge indicators with colors from the injected getResolvedTheme callback', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        const b = makeCard(300, 0, 200, 300, 'b')
        cardLayer.addChild(a)
        cardLayer.addChild(b)
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => ({}), () => 'dark')

        overlay.showDragHighlights([a], [[b]])

        const mergeIndicator = overlay['mergeIndicator'] as unknown as { calls: Array<{ method: string; args: unknown[] }> }
        const fillCall = mergeIndicator.calls.find((c: { method: string; args: unknown[] }): boolean => c.method === 'fill')!
        expect((fillCall.args[0] as { color: number }).color).toBe(getPixiThemeColors('dark').stackOverlay.accent)
    })

    it('tints a merge target\'s own frame with the accent, under its pill, during a stack drag', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        const b = makeCard(300, 0, 200, 300, 'b')
        cardLayer.addChild(a)
        cardLayer.addChild(b)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()

        overlay.showDragHighlights([a], [[b]])
        tick()

        const border = overlay.stackBorder as unknown as { calls: Array<{ method: string; args: unknown[] }> }
        const stroke = border.calls.filter((c: { method: string }): boolean => c.method === 'stroke').pop()!
        expect((stroke.args[0] as { color: number }).color).toBe(getPixiThemeColors('light').stackOverlay.accent)

        overlay.hide()
        overlay.restoreZOrder()
        tick()
        const restStroke = border.calls.filter((c: { method: string }): boolean => c.method === 'stroke').pop()!
        expect((restStroke.args[0] as { color: number }).color).toBe(getPixiThemeColors('light').stackOverlay.frame)
    })

    it('tints a merge target\'s own frame with the accent while a single card is dragged over it', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        const b = makeCard(1000, 0, 200, 300, 'b')
        cardLayer.addChild(a)
        cardLayer.addChild(b)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        tick()

        a.lift.reasons.add('drag')
        a.x = 1050
        tick()

        const border = overlay.stackBorder as unknown as { calls: Array<{ method: string; args: unknown[] }> }
        const stroke = border.calls.filter((c: { method: string }): boolean => c.method === 'stroke').pop()!
        expect((stroke.args[0] as { color: number }).color).toBe(getPixiThemeColors('light').stackOverlay.accent)
        const mergeIndicator = overlay['mergeIndicator'] as unknown as { calls: Array<{ method: string }> }
        expect(mergeIndicator.calls.some((c: { method: string }): boolean => c.method === 'roundRect')).toBe(true)
    })

    it('keeps the merge plus above the dragged stack, its frame, pill and name on every frame of a stack drag', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        const b = makeCard(300, 0, 200, 300, 'b')
        cardLayer.addChild(a)
        cardLayer.addChild(b)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()

        overlay.showDragHighlights([a], [[b]])
        tick()
        tick()

        const plusIndex = cardLayer.children.indexOf(overlay['mergePlus'])
        for (const dragged of [a, overlay['draggedBorder'], overlay['draggedHandle'], overlay['draggedLabelContainer']]) {
            expect(plusIndex).toBeGreaterThan(cardLayer.children.indexOf(dragged))
        }
    })

    it('keeps the merge plus above a single dragged card on every frame', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        const b = makeCard(1000, 0, 200, 300, 'b')
        cardLayer.addChild(a)
        cardLayer.addChild(b)
        const { app, tick } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.addToStage()
        tick()

        a.lift.reasons.add('drag')
        a.x = 1050
        tick()
        tick()

        expect(cardLayer.children.indexOf(overlay['mergePlus'])).toBeGreaterThan(cardLayer.children.indexOf(a))
    })

    it('showDragHighlights does not draw merge indicators when there are no merge targets', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        cardLayer.addChild(a)
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)

        overlay.showDragHighlights([a], [])

        const mergeIndicator = overlay['mergeIndicator'] as unknown as { calls: Array<{ method: string }> }
        expect(mergeIndicator.calls.some((c: { method: string }): boolean => c.method === 'roundRect')).toBe(false)
    })

    it('restoreZOrder resets the dragged-cards tracking and re-raises the permanent border/handle/action pill', () => {
        const cardLayer = new pixi.Container()
        const a = makeCard(0, 0, 200, 300, 'a')
        cardLayer.addChild(a)
        const { app } = createApp()
        const overlay = new StackOverlay(app, cardLayer as unknown as Container)
        overlay.showDragHighlights([a], [])

        overlay.restoreZOrder()

        expect(cardLayer.children.indexOf(overlay.stackBorder)).toBe(0)
        expect(cardLayer.children.indexOf(overlay.stackDragHandle)).toBe(1)
        expect(cardLayer.children.indexOf(overlay.stackActionsPill)).toBe(2)
    })

    it('setHoveredStack(null) makes the render loop stop drawing the action pill even for a previously hovered stack', () => {
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

        const actionsPill = overlay.stackActionsPill as unknown as { calls: Array<{ method: string }> }
        actionsPill.calls = []
        tick()

        expect(actionsPill.calls.some((c: { method: string }): boolean => c.method === 'roundRect')).toBe(false)
    })

    describe('redraw skipping', () => {
        type Drawn = { calls: Array<{ method: string }> }
        const countClears = (graphics: unknown): number =>
            (graphics as Drawn).calls.filter((c: { method: string }): boolean => c.method === 'clear').length

        function setupSettled(names: Record<string, string> = {}, theme: { value: 'light' | 'dark' } = { value: 'light' }): {
            overlay: StackOverlay
            cardLayer: InstanceType<typeof pixi.Container>
            a: Card
            tick: () => void
        } {
            const cardLayer = new pixi.Container()
            const a = makeCard(0, 0, 200, 300, 'a')
            cardLayer.addChild(a)
            cardLayer.addChild(makeCard(50, 50, 200, 300, 'b'))
            const { app, tick } = createApp()
            const overlay = new StackOverlay(app, cardLayer as unknown as Container, () => names, () => theme.value)
            overlay.addToStage()
            tick()
            return { overlay, cardLayer, a, tick }
        }

        it('keeps the last drawing while nothing it shows changed', () => {
            const { overlay, tick } = setupSettled()
            const clears = countClears(overlay.stackBorder)

            tick()

            expect(countClears(overlay.stackBorder)).toBe(clears)
        })

        it('redraws once a card moved', () => {
            const { overlay, a, tick } = setupSettled()
            const clears = countClears(overlay.stackBorder)

            a.x = 10
            tick()

            expect(countClears(overlay.stackBorder)).toBe(clears + 1)
        })

        it('redraws once a card is brought to the front, since names follow the top card', () => {
            const { overlay, cardLayer, a, tick } = setupSettled()
            const clears = countClears(overlay.stackBorder)

            cardLayer.addChild(a)
            tick()

            expect(countClears(overlay.stackBorder)).toBe(clears + 1)
        })

        it('redraws once the theme flips', () => {
            const theme: { value: 'light' | 'dark' } = { value: 'light' }
            const { overlay, tick } = setupSettled({}, theme)
            const clears = countClears(overlay.stackBorder)

            theme.value = 'dark'
            tick()

            expect(countClears(overlay.stackBorder)).toBe(clears + 1)
        })

        it('redraws once another stack is hovered or armed, but not when the same one is set again', () => {
            const { overlay, cardLayer, tick } = setupSettled()
            const stack = cardLayer.children as Card[]
            const clears = countClears(overlay.stackBorder)

            overlay.setHoveredStack([...stack])
            tick()
            overlay.setHoveredStack([...stack])
            tick()
            overlay.setArmedStack([...stack])
            tick()

            expect(countClears(overlay.stackBorder)).toBe(clears + 2)
        })

        it('leaves the layer order alone when everything is already raised', () => {
            const { cardLayer, tick } = setupSettled()
            const addChild = vi.spyOn(cardLayer, 'addChild')

            tick()

            expect(addChild).not.toHaveBeenCalled()
        })

        it('keeps a held card above the dragged stack label layer, empty without a carried stack', () => {
            const { overlay, cardLayer, a, tick } = setupSettled()

            a.lift.reasons.add('drag')
            tick()

            expect(cardLayer.children.indexOf(a)).toBeGreaterThan(cardLayer.children.indexOf(overlay['draggedLabelContainer']))
        })

        it('re-raises the overlays above a card brought to the front', () => {
            const { overlay, cardLayer, a, tick } = setupSettled()

            cardLayer.addChild(a)
            tick()

            expect(cardLayer.children.indexOf(overlay['nameEditor'].view)).toBe(cardLayer.children.length - 1)
            expect(cardLayer.children.indexOf(a)).toBeLessThan(cardLayer.children.indexOf(overlay['draggedLabelContainer']))
        })
    })
})
