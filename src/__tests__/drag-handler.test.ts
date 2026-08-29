import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Application, Container, FederatedPointerEvent } from 'pixi.js'
import { DragHandler } from '../controllers/drag-handler'
import { DragController } from '../controllers/drag-controller'
import { ActionHistory } from '../services/action-history'
import { InMemoryStore } from './in-memory-store'
import { Card } from '../types/card.types'

vi.mock('pixi.js', () => {
    class MockContainer {
        children: unknown[] = []
        x: number = 0
        y: number = 0
        width: number = 100
        height: number = 150
        alpha: number = 1
        parent: unknown = null
        position: { set(x: number, y: number): void } = {
            set: (x: number, y: number): void => {
                this.x = x
                this.y = y
            },
        }
        getGlobalPosition(): { x: number; y: number } {
            return { x: this.x, y: this.y }
        }
        addChild(child: unknown): unknown {
            this.children.push(child);
            (child as Record<string, unknown>).parent = this
            return child
        }
        removeChild(child: unknown): unknown {
            const index = this.children.indexOf(child)
            if (index !== -1) {
                this.children.splice(index, 1);
                (child as Record<string, unknown>).parent = null
            }
            return child
        }
        on(): this { return this }
        off(): this { return this }
    }
    return {
        Container: MockContainer,
        Sprite: class MockSprite extends MockContainer {
            imageUrl: string = ''
        },
    }
})

async function makeCard(imageUrl: string): Promise<Card> {
    const { Sprite } = await import('pixi.js')
    const card = new Sprite() as unknown as Card
    card.imageUrl = imageUrl
    return card
}

function makeEvent(currentTarget: unknown, buttons: number = 1): FederatedPointerEvent {
    return {
        currentTarget,
        buttons,
        global: { x: 0, y: 0 },
        stopPropagation: (): void => {},
    } as unknown as FederatedPointerEvent
}

describe('DragHandler', () => {
    let cardLayer: Container
    let app: Application
    let actionHistory: ActionHistory
    let onDragEnd: () => void
    let dragHandler: DragHandler

    beforeEach(async () => {
        const { Container: MockContainer } = await import('pixi.js')
        cardLayer = new MockContainer() as unknown as Container
        app = { stage: new MockContainer(), screen: { width: 800, height: 600 } } as unknown as Application
        actionHistory = new ActionHistory(new InMemoryStore(), vi.fn())
        onDragEnd = vi.fn()
        dragHandler = new DragHandler(new DragController(), app, cardLayer, onDragEnd, actionHistory)
    })

    it('is not dragging before a drag starts', () => {
        expect(dragHandler.isDragging).toBe(false)
    })

    it('captures the before-snapshot and starts dragging on handleDragStart', async () => {
        const card = await makeCard('card-a')
        const captureSpy = vi.spyOn(actionHistory, 'captureBefore')
        const event = makeEvent(card)

        dragHandler.handleDragStart(event)

        expect(dragHandler.isDragging).toBe(true)
        // Captured before the card is reparented onto cardLayer, so it isn't in cardLayer.children yet.
        expect(captureSpy).toHaveBeenCalledWith([{ id: 'card-a', x: 0, y: 0, index: -1 }])
    })

    it('ends the drag and records the after-snapshot on handleDragEnd', async () => {
        const card = await makeCard('card-a')
        const recordSpy = vi.spyOn(actionHistory, 'recordAfter')
        dragHandler.handleDragStart(makeEvent(card))

        dragHandler.handleDragEnd()

        expect(dragHandler.isDragging).toBe(false)
        expect(recordSpy).toHaveBeenCalledTimes(1)
        expect(onDragEnd).toHaveBeenCalledTimes(1)
    })

    it('does not record a second time if handleDragEnd is called again', async () => {
        const card = await makeCard('card-a')
        const recordSpy = vi.spyOn(actionHistory, 'recordAfter')
        dragHandler.handleDragStart(makeEvent(card))
        dragHandler.handleDragEnd()

        dragHandler.handleDragEnd()

        expect(recordSpy).toHaveBeenCalledTimes(1)
        expect(onDragEnd).toHaveBeenCalledTimes(2)
    })

    it('treats a pointermove with no buttons pressed as a drag end', async () => {
        const card = await makeCard('card-a')
        dragHandler.handleDragStart(makeEvent(card))

        dragHandler.handleDragMove(makeEvent(card, 0))

        expect(dragHandler.isDragging).toBe(false)
        expect(onDragEnd).toHaveBeenCalledTimes(1)
    })

    it('wires pointerup and pointerupoutside handlers on the stage', () => {
        const onSpy = vi.spyOn(app.stage, 'on')

        dragHandler.wireStageHandlers()

        expect(onSpy).toHaveBeenCalledWith('pointerup', dragHandler.handleDragEnd)
        expect(onSpy).toHaveBeenCalledWith('pointerupoutside', dragHandler.handleDragEnd)
        expect(app.stage.eventMode).toBe('static')
        expect(app.stage.hitArea).toBe(app.screen)
    })
})
