import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import {
    onCardDragStart,
    onCardDragMove,
    onCardDragEnd,
    relocateCardAtGlobalPosition,
} from '../utils/drag'
import { CardDragState } from '../types/drag.types'
import { Card } from '../types/card.types'
import { DRAGGING_OPACITY, DEFAULT_OPACITY } from '../utils/constants'
import { Container, FederatedPointerEvent, Graphics, Sprite } from 'pixi.js'

// Mock PixiJS objects
vi.mock('pixi.js', () => {
    return {
        Container: class MockContainer {
            children: unknown[] = []
            x: number = 0
            y: number = 0
            addChild(child: unknown): unknown {
                this.children.push(child);
                (child as Record<string, unknown>).parent = this
                return child
            }
            removeChild(child: unknown): unknown {
                const index: number = this.children.indexOf(child)
                if (index !== -1) {
                    this.children.splice(index, 1);
                    (child as Record<string, unknown>).parent = null
                }
                return child
            }
            getChildAt(index: number): unknown {
                return this.children[index]
            }
            on(): this {
                return this
            }
            off(): this {
                return this
            }
            toLocal(position: Record<string, number>): Record<string, number> {
                return position
            }
        },
        Sprite: class MockSprite {
            x: number = 0
            y: number = 0
            width: number = 100
            height: number = 150
            alpha: number = 1
            parent: unknown = null
            eventMode: string = 'static'
            cursor: string = 'move'
            position: Record<string, unknown> = {
                set: vi.fn(),
            }
            getGlobalPosition(): Record<string, number> {
                return { x: this.x, y: this.y }
            }
            on(): this {
                return this
            }
        },
        FederatedPointerEvent: class MockFederatedPointerEvent {
            constructor(type: string, options: Record<string, unknown>) {
                this.type = type
                this.global = (options?.global as Record<string, number>) || {
                    x: 0,
                    y: 0,
                }
            }
            type: string = ''
            global: Record<string, number> = { x: 0, y: 0 }
            currentTarget: unknown = null
            stopPropagation(): void {}
        },
        Graphics: class MockGraphics {
            clear(): this {
                return this
            }
            beginFill(): this {
                return this
            }
            lineStyle(): this {
                return this
            }
            drawRoundedRect(): this {
                return this
            }
            endFill(): this {
                return this
            }
            eventMode: string = 'none'
            cursor: string = 'default'
            on(): this {
                return this
            }
            children: unknown[] = []
            getChildAt(): unknown {
                return null
            }
            getBounds(): Record<string, number> {
                return { x: 0, y: 0, width: 100, height: 100 }
            }
        },
    }
})

// Mock DeckController static methods used by drag utilities
vi.mock('../controllers/DeckController', () => ({
    DeckController: {
        getDeckUnderCard: vi.fn(),
        isOverAnyDeck: vi.fn(),
        unhighlightAll: vi.fn(),
    },
}))

// Import DeckController to access mocked static methods
import { DeckController } from '../controllers/DeckController'
import { Deck } from '../models/Deck.ts'

// Get mocked functions directly
const mockedGetDeckUnderCard: Mock =
    DeckController.getDeckUnderCard as Mock
const mockedIsOverAnyDeck: Mock =
    DeckController.isOverAnyDeck as Mock

// Mock card.ts functions
vi.mock('../utils/card', () => ({
    constrainPosition: vi.fn((x: number, y: number) => ({ x, y })),
}))

describe('Card Movement Rules', () => {
    let cardDragState: CardDragState
    let mockCard: Card
    let mockDeck: Deck
    let mockStage: Container
    let mockEvent: FederatedPointerEvent
    let mockDecks: Deck[]
    let onDragMoveMock: (event: FederatedPointerEvent) => void
    let onTitleBarClickMock: (event: FederatedPointerEvent) => void
    let createDeckMock: () => Deck

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks()

        // Create mock card using the mocked Sprite class
        mockCard = new Sprite() as Card
        mockCard.x = 50
        mockCard.y = 60
        mockCard.width = 100
        mockCard.height = 150
        mockCard.alpha = 1
        mockCard.parent = null
        vi.spyOn(mockCard.position, 'set')

        // Create mock deck using the real Deck class (extends mocked Container)
        mockDeck = new Deck()
        vi.spyOn(mockDeck, 'addChild')
        vi.spyOn(mockDeck, 'removeChild')
        vi.spyOn(mockDeck, 'centerCard').mockReturnValue(undefined)
        vi.spyOn(mockDeck, 'updateBorder').mockReturnValue(undefined)
        vi.spyOn(mockDeck, 'updateBorderViewer').mockReturnValue(undefined)
        // Set up initial children (background + card)
        mockDeck.addChild(new Graphics())
        mockDeck.addChild(mockCard)
        mockCard.parent = mockDeck
        // Clear setup calls
        vi.mocked(mockDeck.addChild).mockClear()
        vi.mocked(mockDeck.removeChild).mockClear()
        vi.mocked(mockDeck.centerCard).mockClear()
        vi.mocked(mockDeck.updateBorder).mockClear()
        vi.mocked(mockDeck.updateBorderViewer).mockClear()

        mockDeck.x = 20
        mockDeck.y = 30

        // Create mock stage
        mockStage = new Container()
        vi.spyOn(mockStage, 'addChild')
        vi.spyOn(mockStage, 'removeChild')
        vi.spyOn(mockStage, 'on')
        vi.spyOn(mockStage, 'off')

        // Create mock event
        mockEvent = Reflect.construct(FederatedPointerEvent, []) as FederatedPointerEvent
        Object.defineProperty(mockEvent, 'global', {
            value: { x: 100, y: 120 },
            writable: true,
            configurable: true,
            enumerable: true,
        })
        Object.defineProperty(mockEvent, 'currentTarget', {
            value: mockCard,
            writable: true,
            configurable: true,
            enumerable: true,
        })

        mockDecks = [mockDeck]

        // Create drag state
        cardDragState = {
            dragTarget: null,
            dragOffset: { x: 0, y: 0 },
            originalParent: null,
            originalPosition: { x: 0, y: 0 },
            cardMoved: false,
        }

        // Mock functions
        onDragMoveMock = vi.fn()
        onTitleBarClickMock = vi.fn()
        createDeckMock = vi.fn(() => new Deck()) as Mock

        // Set up mock return values
        mockedGetDeckUnderCard.mockReturnValue(null)
        mockedIsOverAnyDeck.mockReturnValue(false)
    })

    describe('onCardDragStart', () => {
        it('should set up the drag state correctly', () => {
            onCardDragStart(
                mockEvent,
                cardDragState,
                mockDecks,
                mockStage,
                onDragMoveMock,
                150,
                200,
                onTitleBarClickMock,
            )

            // Check that the drag state is set up correctly
            expect(cardDragState.dragTarget).toBe(mockCard)
            expect(cardDragState.originalParent).toBe(mockDeck)
            expect(cardDragState.originalPosition).toEqual({ x: 50, y: 60 })
            expect(cardDragState.cardMoved).toBe(false)

            // Check that the card's opacity is reduced
            expect(mockCard.alpha).toBe(DRAGGING_OPACITY)

            // Check that the card is removed from its parent and added to the stage
            expect(vi.mocked(mockDeck.removeChild)).toHaveBeenCalledWith(mockCard)
            expect(vi.mocked(mockStage.addChild)).toHaveBeenCalledWith(mockCard)

            // Check that the stage.on method was called with the correct arguments
            expect(vi.mocked(mockStage.on)).toHaveBeenCalledWith(
                'pointermove',
                onDragMoveMock,
            )
        })

        it('should calculate the drag offset correctly', () => {
            onCardDragStart(
                mockEvent,
                cardDragState,
                mockDecks,
                mockStage,
                onDragMoveMock,
                150,
                200,
                onTitleBarClickMock,
            )

            // The drag offset should be the difference between the card's global position and the event global position
            expect(cardDragState.dragOffset).toEqual({
                x: mockCard.getGlobalPosition().x - mockEvent.global.x,
                y: mockCard.getGlobalPosition().y - mockEvent.global.y,
            })
        })
    })

    describe('onCardDragMove', () => {
        beforeEach(() => {
            // Set up the drag state
            cardDragState.dragTarget = mockCard
            cardDragState.dragOffset = { x: 10, y: 20 }
            cardDragState.originalParent = mockDeck
            cardDragState.originalPosition = { x: 50, y: 60 }
        })

        it('should update the card position based on the event and offset', () => {
            onCardDragMove(
                mockEvent,
                cardDragState,
                mockDecks,
                800,
                600,
                150,
                200,
                onTitleBarClickMock,
            )

            const expectedX: number =
                mockEvent.global.x + cardDragState.dragOffset.x
            const expectedY: number =
                mockEvent.global.y + cardDragState.dragOffset.y

            expect(mockCard.position.set).toHaveBeenCalledWith(
                expectedX,
                expectedY,
            )
            expect(cardDragState.cardMoved).toBe(true)
        })

        it('should highlight decks when the card is over them', () => {
            // Mock isOverAnyDeck to return true
            mockedIsOverAnyDeck.mockReturnValue(true)
            mockedGetDeckUnderCard.mockReturnValue(mockDeck)

            onCardDragMove(
                mockEvent,
                cardDragState,
                mockDecks,
                800,
                600,
                150,
                200,
                onTitleBarClickMock,
            )

            // Check that deck.updateBorder is called with highlight=true
            expect(
                vi.mocked(mockDeck.updateBorder),
            ).toHaveBeenCalledWith(true, 150, 200, onTitleBarClickMock)
        })

        it('should unhighlight all decks when the card is not over any deck', () => {
            // Mock isOverAnyDeck to return false
            mockedIsOverAnyDeck.mockReturnValue(false)

            onCardDragMove(
                mockEvent,
                cardDragState,
                mockDecks,
                800,
                600,
                150,
                200,
                onTitleBarClickMock,
            )

            // Check that DeckController.unhighlightAll is called
            expect(DeckController.unhighlightAll).toHaveBeenCalledWith(
                mockDecks,
                150,
                200,
                onTitleBarClickMock,
            )
        })
    })

    describe('onCardDragEnd', () => {
        beforeEach(() => {
            // Set up the drag state
            cardDragState.dragTarget = mockCard
            cardDragState.dragOffset = { x: 10, y: 20 }
            cardDragState.originalParent = mockDeck
            cardDragState.originalPosition = { x: 50, y: 60 }
            cardDragState.cardMoved = true
        })

        it('should do nothing if no card is being dragged', () => {
            // Reset the drag target
            cardDragState.dragTarget = null

            onCardDragEnd(
                cardDragState,
                mockDecks,
                mockStage,
                onDragMoveMock,
                createDeckMock,
                150,
                200,
                800,
                600,
                onTitleBarClickMock,
            )

            // Check that no functions are called
            expect(vi.mocked(mockStage.removeChild)).not.toHaveBeenCalled()
            expect(vi.mocked(mockDeck.addChild)).not.toHaveBeenCalled()
            expect(createDeckMock).not.toHaveBeenCalled()
        })

        it('should return the card to its original position if it was not moved', () => {
            // Set cardMoved to false
            cardDragState.cardMoved = false

            // Set up the drag state
            cardDragState.dragTarget = mockCard
            cardDragState.originalParent = mockDeck
            cardDragState.originalPosition = { x: 50, y: 60 }

            // Set the card's parent to the stage to simulate it being dragged
            mockCard.parent = mockStage

            onCardDragEnd(
                cardDragState,
                mockDecks,
                mockStage,
                onDragMoveMock,
                createDeckMock,
                150,
                200,
                800,
                600,
                onTitleBarClickMock,
            )

            // Check that the card is removed from the stage and added back to its original parent
            expect(vi.mocked(mockStage.removeChild)).toHaveBeenCalledWith(mockCard)
            expect(vi.mocked(mockDeck.addChild)).toHaveBeenCalledWith(mockCard)

            // Check that the card's position is reset to its original position
            // Note: The card's position is set to the original position in the test setup
            expect(mockCard.x).toBe(50)
            expect(mockCard.y).toBe(60)

            // Check that the card's opacity is reset
            expect(mockCard.alpha).toBe(DEFAULT_OPACITY)

            // Check that the drag state is reset
            expect(cardDragState.dragTarget).toBeNull()
            expect(cardDragState.originalParent).toBeNull()
        })

        it('should add the card to the deck under it if there is one', () => {
            // Mock isOverAnyDeck to return true and getDeckUnderCard to return a deck
            mockedIsOverAnyDeck.mockReturnValue(true)
            mockedGetDeckUnderCard.mockReturnValue(mockDeck)

            // Create a different deck as the original parent
            const originalDeck: Deck = new Deck()
            vi.spyOn(originalDeck, 'addChild')
            vi.spyOn(originalDeck, 'removeChild')

            // Add the original deck to the decks array
            mockDecks.push(originalDeck)

            // Set up the drag state
            cardDragState.dragTarget = mockCard
            cardDragState.originalParent = originalDeck
            cardDragState.originalPosition = { x: 50, y: 60 }
            cardDragState.cardMoved = true

            // Set the card's parent to the stage to simulate it being dragged
            mockCard.parent = mockStage

            onCardDragEnd(
                cardDragState,
                mockDecks,
                mockStage,
                onDragMoveMock,
                createDeckMock,
                150,
                200,
                800,
                600,
                onTitleBarClickMock,
            )

            // Check that the card is removed from the stage and added to the deck
            expect(vi.mocked(mockStage.removeChild)).toHaveBeenCalledWith(mockCard)
            expect(vi.mocked(mockDeck.addChild)).toHaveBeenCalledWith(mockCard)

            // Check that deck.centerCard is called
            expect(
                vi.mocked(mockDeck.centerCard),
            ).toHaveBeenCalledWith(mockCard, 150, 200)

            // Check that the card's opacity is reset
            expect(mockCard.alpha).toBe(DEFAULT_OPACITY)

            // Check that DeckController.unhighlightAll is called
            expect(DeckController.unhighlightAll).toHaveBeenCalledWith(
                mockDecks,
                150,
                200,
                onTitleBarClickMock,
            )

            // Check that the drag state is reset
            expect(cardDragState.dragTarget).toBeNull()
            expect(cardDragState.originalParent).toBeNull()
        })

        it('should create a new deck if the card is not over any deck', () => {
            // Mock getDeckUnderCard to return null
            mockedGetDeckUnderCard.mockReturnValue(null)

            // Create a new deck
            const newDeck: Deck = new Deck()
            vi.spyOn(newDeck, 'addChild')
            vi.spyOn(newDeck, 'removeChild')
            vi.spyOn(newDeck, 'centerCard').mockReturnValue(undefined)
            vi.spyOn(newDeck, 'updateBorder').mockReturnValue(undefined)
            vi.spyOn(newDeck, 'updateBorderViewer').mockReturnValue(undefined)
            // Override the createDeckMock function to return the new deck
            createDeckMock = vi.fn(() => newDeck) as Mock

            // Set up the drag state
            cardDragState.dragTarget = mockCard
            cardDragState.originalParent = mockDeck
            cardDragState.originalPosition = { x: 50, y: 60 }
            cardDragState.cardMoved = true

            // Set the card's parent to the stage to simulate it being dragged
            mockCard.parent = mockStage

            onCardDragEnd(
                cardDragState,
                mockDecks,
                mockStage,
                onDragMoveMock,
                createDeckMock,
                150,
                200,
                800,
                600,
                onTitleBarClickMock,
            )

            // Check that createDeckMock is called
            expect(createDeckMock).toHaveBeenCalled()

            // Check that the card is removed from the stage and added to the new deck
            expect(vi.mocked(mockStage.removeChild)).toHaveBeenCalledWith(mockCard)
            expect(newDeck.addChild).toHaveBeenCalledWith(mockCard)

            // Check that the card's opacity is reset
            expect(mockCard.alpha).toBe(DEFAULT_OPACITY)

            // Check that the drag state is reset
            expect(cardDragState.dragTarget).toBeNull()
            expect(cardDragState.originalParent).toBeNull()
        })
    })

    describe('relocateCardAtGlobalPosition', () => {
        let relocateCreateDeckMock: Mock

        beforeEach(() => {
            relocateCreateDeckMock = vi.fn(() => new Deck()) as Mock

            mockedGetDeckUnderCard.mockReset()
        })

        it('should do nothing on self-drop within the original deck bounds', () => {
            const globalX: number = 100
            const globalY: number = 120

            relocateCardAtGlobalPosition(
                mockCard,
                globalX,
                globalY,
                mockDecks,
                mockStage,
                relocateCreateDeckMock,
                150,
                200,
                800,
                600,
                onTitleBarClickMock,
            )

            expect(vi.mocked(mockStage.addChild)).not.toHaveBeenCalled()
            expect(vi.mocked(mockDeck.addChild)).not.toHaveBeenCalled()
            expect(relocateCreateDeckMock).not.toHaveBeenCalled()
        })

        it('should add the card to a deck when dropped over one', () => {
            const globalX: number = 300
            const globalY: number = 400

            mockedGetDeckUnderCard.mockReturnValue(mockDeck)

            relocateCardAtGlobalPosition(
                mockCard,
                globalX,
                globalY,
                mockDecks,
                mockStage,
                relocateCreateDeckMock,
                150,
                200,
                800,
                600,
                onTitleBarClickMock,
            )

            expect(vi.mocked(mockStage.addChild)).toHaveBeenCalledWith(mockCard)
            expect(vi.mocked(mockDeck.addChild)).toHaveBeenCalledWith(mockCard)
            expect(vi.mocked(mockDeck.centerCard)).toHaveBeenCalledWith(
                mockCard,
                150,
                200,
            )
            expect(relocateCreateDeckMock).not.toHaveBeenCalled()
        })

        it('should create a new deck when dropped in empty space', () => {
            const globalX: number = 300
            const globalY: number = 400

            mockedGetDeckUnderCard.mockReturnValue(null)

            relocateCardAtGlobalPosition(
                mockCard,
                globalX,
                globalY,
                mockDecks,
                mockStage,
                relocateCreateDeckMock,
                150,
                200,
                800,
                600,
                onTitleBarClickMock,
            )

            expect(relocateCreateDeckMock).toHaveBeenCalled()
            expect(vi.mocked(mockStage.addChild)).toHaveBeenCalledWith(mockCard)
        })
    })
})
