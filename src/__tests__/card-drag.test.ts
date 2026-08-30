import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Container, FederatedPointerEvent } from 'pixi.js'
import { CardDrag, DRAGGING_OPACITY, DEFAULT_OPACITY } from '../features/drag/card-drag'
import { STACK_HIGHLIGHT_PADDING, STACK_HANDLE_HEIGHT } from '../features/stack/stack'
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

    describe('styling constants', () => {
        it('should have the correct DRAGGING_OPACITY', () => {
            expect(DRAGGING_OPACITY).toBe(0.5)
        })

        it('should have the correct DEFAULT_OPACITY', () => {
            expect(DEFAULT_OPACITY).toBe(1)
        })
    })

    describe('top clearance for the stack handle', () => {
        const handleTopClearance = STACK_HIGHLIGHT_PADDING + STACK_HANDLE_HEIGHT / 2

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
})
