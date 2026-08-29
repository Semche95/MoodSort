import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Application, Container } from 'pixi.js'
import { StackDragManager } from '../controllers/StackDragManager'
import { StackOverlay } from '../controllers/StackOverlay'
import { ActionHistory } from '../services/ActionHistory'
import { InMemoryStore } from './InMemoryStore'
import { Card } from '../types/card.types'

vi.mock('pixi.js', () => {
    class MockContainer {
        children: unknown[] = []
        x: number = 0
        y: number = 0
        width: number = 100
        height: number = 150
        parent: unknown = null
        addChild(child: unknown): unknown {
            const existing = this.children.indexOf(child)
            if (existing !== -1) this.children.splice(existing, 1)
            this.children.push(child);
            (child as Record<string, unknown>).parent = this
            return child
        }
        on(): this { return this }
        off(): this { return this }
    }
    return { Container: MockContainer }
})

function makeCard(imageUrl: string, x: number, y: number): Card {
    return { imageUrl, x, y, width: 100, height: 150 } as unknown as Card
}

describe('StackDragManager', () => {
    let cardLayer: Container
    let app: Application
    let overlay: StackOverlay
    let actionHistory: ActionHistory
    let manager: StackDragManager

    beforeEach(async () => {
        const { Container: MockContainer } = await import('pixi.js')
        cardLayer = new MockContainer() as unknown as Container
        app = { stage: new MockContainer() } as unknown as Application
        overlay = { restoreZOrder: vi.fn(), showDragHighlights: vi.fn() } as unknown as StackOverlay
        actionHistory = new ActionHistory(new InMemoryStore(), vi.fn())
        manager = new StackDragManager(app, cardLayer, overlay, () => [], actionHistory)
    })

    it('is not dragging before startDrag is called', () => {
        expect(manager.isDragging).toBe(false)
        expect(manager.dragTarget).toEqual([])
    })

    it('startDrag captures the pre-drag z-order and keeps every card on the cardLayer', () => {
        const a = makeCard('a', 10, 10)
        const b = makeCard('b', 20, 20)
        cardLayer.addChild(a)
        cardLayer.addChild(b)
        const captureSpy = vi.spyOn(actionHistory, 'captureBefore')

        manager.startDrag([a, b], [a, b], { x: 100, y: 100 })

        expect(manager.isDragging).toBe(true)
        expect(manager.dragTarget).toEqual([a, b])
        expect(cardLayer.children).toEqual([a, b])
        expect(captureSpy).toHaveBeenCalledWith([
            { id: 'a', x: 10, y: 10, index: 0 },
            { id: 'b', x: 20, y: 20, index: 1 },
        ])
    })

    it('moves every dragged card by the pointer delta on stage pointermove', async () => {
        const a = makeCard('a', 10, 10)
        const b = makeCard('b', 20, 20)
        cardLayer.addChild(a)
        cardLayer.addChild(b)
        const onSpy = vi.spyOn(app.stage, 'on')

        manager.startDrag([a, b], [a, b], { x: 100, y: 100 })
        const moveHandler = onSpy.mock.calls.find((call: unknown[]): boolean => call[0] === 'pointermove')?.[1] as (e: unknown) => void

        moveHandler({ global: { x: 130, y: 90 } })

        expect(a.x).toBe(40)
        expect(a.y).toBe(0)
        expect(b.x).toBe(50)
        expect(b.y).toBe(10)
        expect(overlay.showDragHighlights).toHaveBeenCalled()
    })

    it('end records the after-snapshot, stops dragging and restores the overlay z-order', () => {
        const a = makeCard('a', 10, 10)
        cardLayer.addChild(a)
        manager.startDrag([a], [a], { x: 0, y: 0 })
        const recordSpy = vi.spyOn(actionHistory, 'recordAfter')
        const offSpy = vi.spyOn(app.stage, 'off')

        manager.end()

        expect(recordSpy).toHaveBeenCalledWith([{ id: 'a', x: 10, y: 10, index: 0 }])
        expect(manager.isDragging).toBe(false)
        expect(manager.dragTarget).toEqual([])
        expect(offSpy).toHaveBeenCalled()
        expect(overlay.restoreZOrder).toHaveBeenCalledTimes(1)
    })

    it('end is a no-op when no drag is in progress', () => {
        const recordSpy = vi.spyOn(actionHistory, 'recordAfter')

        manager.end()

        expect(recordSpy).not.toHaveBeenCalled()
        expect(overlay.restoreZOrder).not.toHaveBeenCalled()
    })
})
