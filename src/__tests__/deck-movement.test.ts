import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { onDeckDragStart, onDeckDragMove, onDeckDragEnd } from '../utils/drag'
import { DeckDragState } from '../types/drag.types'
import { Container, FederatedPointerEvent } from 'pixi.js'

// Mock PixiJS objects
vi.mock('pixi.js', () => {
    return {
        Container: class MockContainer {
            children: unknown[] = []
            x: number = 0
            y: number = 0
            addChild(child: unknown): unknown {
                this.children.push(child)
                ;(child as Record<string, unknown>).parent = this
                return child
            }
            removeChild(child: unknown): unknown {
                const index: number = this.children.indexOf(child)
                if (index !== -1) {
                    this.children.splice(index, 1)
                    ;(child as Record<string, unknown>).parent = null
                }
                return child
            }
            on(): this { return this }
            off(): this { return this }
            toLocal(position: Record<string, number>): Record<string, number> {
                return position
            }
            getGlobalPosition(): Record<string, number> {
                return { x: this.x, y: this.y }
            }
        },
        FederatedPointerEvent: class MockFederatedPointerEvent {
            constructor(type: string, options: Record<string, unknown>) {
                this.type = type
                this.global = (options?.global as Record<string, number>) || { x: 0, y: 0 }
            }
            type: string = ''
            global: Record<string, number> = { x: 0, y: 0 }
            currentTarget: unknown = null
            stopPropagation(): void {}
        },
    }
})

// Mock card.ts functions
vi.mock('../utils/card', () => ({
    constrainPosition: vi.fn((x: number, y: number) => ({ x, y })),
}))

// Import mocked functions
import { constrainPosition } from '../utils/card'
import { Deck } from '../models/Deck.ts'

// Get mocked functions directly from vi.mocked
const mockedConstrainPosition: Mock = constrainPosition as Mock

describe('Deck Movement Rules', () => {
    let deckDragState: DeckDragState
    let mockDeck: Deck
    let mockStage: Container
    let mockEvent: FederatedPointerEvent
    let onDeckDragMoveMock: (event: FederatedPointerEvent) => void
    let onDeckDragEndMock: () => void

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks()

        // Create mock deck using the real Deck class (extends mocked Container)
        mockDeck = new Deck()
        mockDeck.x = 20
        mockDeck.y = 30
        mockDeck.width = 150
        mockDeck.height = 200

        mockStage = new Container()
        vi.spyOn(mockStage, 'addChild')
        vi.spyOn(mockStage, 'removeChild')
        vi.spyOn(mockStage, 'on')
        vi.spyOn(mockStage, 'off')

        // Create a mock title bar hit area
        const mockTitleBarHitArea: Record<string, unknown> = {
            parent: {
                parent: mockDeck,
            },
        }

        mockEvent = Reflect.construct(FederatedPointerEvent, []) as FederatedPointerEvent
        Object.defineProperty(mockEvent, 'global', {
            value: { x: 100, y: 120 },
            writable: true,
            configurable: true,
            enumerable: true,
        })
        Object.defineProperty(mockEvent, 'currentTarget', {
            value: mockTitleBarHitArea,
            writable: true,
            configurable: true,
            enumerable: true,
        })

        // Create drag state
        deckDragState = {
            dragDeckTarget: null,
            dragDeckOffset: { x: 0, y: 0 },
        }

        // Mock functions
        onDeckDragMoveMock = vi.fn().mockName('onDeckDragMove')
        onDeckDragEndMock = vi.fn().mockName('onDeckDragEnd')

        // Mock constrainPosition to return the input position
        mockedConstrainPosition.mockImplementation((x: number, y: number) => ({ x, y }))
    })

    describe('onDeckDragStart', () => {
        it('should set up the drag state correctly', () => {
            onDeckDragStart(
                mockEvent,
                deckDragState,
                mockStage,
                onDeckDragMoveMock,
                onDeckDragEndMock,
            )

            // Check that the drag state is set up correctly
            expect(deckDragState.dragDeckTarget).toBe(mockDeck)

            // Check that the drag offset is calculated correctly
            expect(deckDragState.dragDeckOffset).toEqual({
                x: mockDeck.x - mockEvent.global.x,
                y: mockDeck.y - mockEvent.global.y,
            })

            // Check that the stage.on method was called with the correct arguments
            expect(vi.mocked(mockStage.on)).toHaveBeenCalledWith('pointermove', onDeckDragMoveMock)
            expect(vi.mocked(mockStage.on)).toHaveBeenCalledWith('pointerup', onDeckDragEndMock)
            expect(vi.mocked(mockStage.on)).toHaveBeenCalledWith('pointerupoutside', onDeckDragEndMock)
        })

        it('should do nothing if the event has no currentTarget', () => {
            // Create a new event with no currentTarget
            const eventWithoutTarget: FederatedPointerEvent = Reflect.construct(FederatedPointerEvent, []) as FederatedPointerEvent
            Object.defineProperty(eventWithoutTarget, 'global', {
                value: { x: 100, y: 120 },
                writable: true,
                configurable: true,
                enumerable: true,
            })
            Object.defineProperty(eventWithoutTarget, 'currentTarget', {
                value: null,
                writable: true,
                configurable: true,
                enumerable: true,
            })

            onDeckDragStart(
                eventWithoutTarget,
                deckDragState,
                mockStage,
                onDeckDragMoveMock,
                onDeckDragEndMock,
            )

            // Check that the drag state is not set up
            expect(deckDragState.dragDeckTarget).toBeNull()

            // Check that the drag move and end handlers are not set up
            expect(onDeckDragMoveMock).not.toHaveBeenCalled()
            expect(onDeckDragEndMock).not.toHaveBeenCalled()
        })
    })

    describe('onDeckDragMove', () => {
        beforeEach(() => {
            // Set up the drag state
            deckDragState.dragDeckTarget = mockDeck
            deckDragState.dragDeckOffset = { x: 10, y: 20 }
        })

        it('should update the deck position based on the event and offset', () => {
            // Reset the mock to clear any previous calls
            mockedConstrainPosition.mockClear()

            // Set up the mock to return a specific value
            mockedConstrainPosition.mockReturnValue({
                x: mockEvent.global.x - deckDragState.dragDeckOffset.x,
                y: mockEvent.global.y - deckDragState.dragDeckOffset.y,
            })

            onDeckDragMove(
                mockEvent,
                deckDragState,
                mockStage,
                800,
                600,
            )

            // The deck position should be updated based on the event global position and the drag offset
            expect(mockDeck.x).toBe(mockEvent.global.x - deckDragState.dragDeckOffset.x)
            expect(mockDeck.y).toBe(mockEvent.global.y - deckDragState.dragDeckOffset.y)
        })

        it('should do nothing if no deck is being dragged', () => {
            // Reset the drag target
            deckDragState.dragDeckTarget = null

            // Store the original position
            const originalX: number = mockDeck.x
            const originalY: number = mockDeck.y

            onDeckDragMove(
                mockEvent,
                deckDragState,
                mockStage,
                800,
                600,
            )

            // The deck position should not change
            expect(mockDeck.x).toBe(originalX)
            expect(mockDeck.y).toBe(originalY)
        })

        it('should constrain the deck position to keep it within the viewport', () => {
            // Reset the mock to clear any previous calls
            mockedConstrainPosition.mockClear()

            // Mock constrainPosition to return a constrained position
            const constrainedPosition: Record<string, number> = { x: 50, y: 60 }
            mockedConstrainPosition.mockReturnValue(constrainedPosition)

            onDeckDragMove(
                mockEvent,
                deckDragState,
                mockStage,
                800,
                600,
            )

            // The deck position should be constrained
            expect(mockDeck.x).toBe(constrainedPosition.x)
            expect(mockDeck.y).toBe(constrainedPosition.y)

            // Check that constrainPosition was called
            expect(mockedConstrainPosition).toHaveBeenCalled()
        })
    })

    describe('onDeckDragEnd', () => {
        beforeEach(() => {
            // Set up the drag state
            deckDragState.dragDeckTarget = mockDeck
            deckDragState.dragDeckOffset = { x: 10, y: 20 }
        })

        it('should reset the drag state', () => {
            onDeckDragEnd(
                deckDragState,
                mockStage,
                onDeckDragMoveMock,
                onDeckDragEndMock,
            )

            // Check that the drag state is reset
            expect(deckDragState.dragDeckTarget).toBeNull()
        })

        it('should do nothing if no deck is being dragged', () => {
            // Reset the drag target
            deckDragState.dragDeckTarget = null

            onDeckDragEnd(
                deckDragState,
                mockStage,
                onDeckDragMoveMock,
                onDeckDragEndMock,
            )

            // The drag state should still be null
            expect(deckDragState.dragDeckTarget).toBeNull()
        })
    })
})
