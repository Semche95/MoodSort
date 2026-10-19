import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Container, FederatedPointerEvent } from 'pixi.js'
import { CardDrag } from '../features/drag/card-drag'
import { STACK_FRAME_CLEARANCE } from '../features/stack/stack'
import { Card } from '../types/card.types'
import { createCardLift } from '../features/card/card-lift'

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
    card.lift = createCardLift()
    return card
}

function makeEvent(currentTarget: unknown, global: { x: number; y: number }): FederatedPointerEvent {
    return { currentTarget, global } as unknown as FederatedPointerEvent
}

describe('CardDrag', () => {
    let cardDrag: CardDrag

    beforeEach(() => {
        vi.clearAllMocks()
        cardDrag = new CardDrag()
    })

    describe('constructor', () => {
        it('should initialize with empty drag state', () => {
            expect(cardDrag.dragState.dragTarget).toBeNull()
            expect(cardDrag.dragState.originalParent).toBeNull()
            expect(cardDrag.dragState.originalPosition).toEqual({ x: 0, y: 0 })
            expect(cardDrag.dragState.cardMoved).toBe(false)
        })
    })

    describe('top clearance for the stack handle', () => {
        const handleTopClearance = STACK_FRAME_CLEARANCE

        it('keeps the card below the handle clearance while dragging toward the top', async () => {
            const { Container: MockContainer } = await import('pixi.js')
            const stage = new MockContainer() as unknown as Container
            const cardLayer = new MockContainer() as unknown as Container
            const card = await makeCard('card-a')

            cardDrag.handleDragStart(makeEvent(card, { x: 0, y: 0 }), stage, cardLayer, vi.fn())
            cardDrag.handleDragMove(makeEvent(card, { x: 0, y: -1000 }), 800, 600)

            expect(cardDrag.dragState.dragTarget!.y).toBe(handleTopClearance)
        })

        it('keeps the card below the handle clearance after the drag ends', async () => {
            const { Container: MockContainer } = await import('pixi.js')
            const stage = new MockContainer() as unknown as Container
            const cardLayer = new MockContainer() as unknown as Container
            const card = await makeCard('card-a')

            cardDrag.handleDragStart(makeEvent(card, { x: 0, y: 0 }), stage, cardLayer, vi.fn())
            cardDrag.handleDragMove(makeEvent(card, { x: 0, y: -1000 }), 800, 600)
            cardDrag.handleDragEnd(stage, vi.fn(), 800, 600)

            expect(card.y).toBe(handleTopClearance)
        })
    })

    describe('startDrag', () => {
        it('keeps the card where it is, under the pointer offset of the press, when no grab offset is given', async () => {
            const { Container: MockContainer } = await import('pixi.js')
            const stage = new MockContainer() as unknown as Container
            const cardLayer = new MockContainer() as unknown as Container
            const card = await makeCard('card-a')
            card.position.set(100, 200)

            cardDrag.startDrag(card, { x: 130, y: 250 }, stage, cardLayer, vi.fn())
            cardDrag.handleDragMove(makeEvent(card, { x: 140, y: 260 }), 800, 600)

            expect({ x: card.x, y: card.y }).toEqual({ x: 110, y: 210 })
        })

        it('moves the card to the grab offset from the pointer at once, and snaps it back to its board spot if it never moves', async () => {
            const { Container: MockContainer } = await import('pixi.js')
            const stage = new MockContainer() as unknown as Container
            const cardLayer = new MockContainer() as unknown as Container
            const card = await makeCard('card-a')
            card.position.set(100, 200)

            cardDrag.startDrag(card, { x: 400, y: 300 }, stage, cardLayer, vi.fn(), { x: -20, y: -30 })
            expect({ x: card.x, y: card.y }).toEqual({ x: 380, y: 270 })
            expect(cardDrag.dragState.originalPosition).toEqual({ x: 100, y: 200 })

            cardDrag.handleDragEnd(stage, vi.fn(), 800, 600)
            expect({ x: card.x, y: card.y }).toEqual({ x: 100, y: 200 })
        })

        it('keeps the grab offset while the pointer moves', async () => {
            const { Container: MockContainer } = await import('pixi.js')
            const stage = new MockContainer() as unknown as Container
            const cardLayer = new MockContainer() as unknown as Container
            const card = await makeCard('card-a')

            cardDrag.startDrag(card, { x: 400, y: 300 }, stage, cardLayer, vi.fn(), { x: -20, y: -30 })
            cardDrag.handleDragMove(makeEvent(card, { x: 450, y: 320 }), 800, 600)

            expect({ x: card.x, y: card.y }).toEqual({ x: 430, y: 290 })
        })
    })
})
