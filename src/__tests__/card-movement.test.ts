import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DragController } from '../controllers/drag-controller'
import { Card } from '../types/card.types'
import { DRAGGING_OPACITY, DEFAULT_OPACITY } from '../utils/constants'
import { Container, FederatedPointerEvent, Sprite } from 'pixi.js'

// Mock PixiJS objects
vi.mock('pixi.js', () => {
    return {
        Container: class MockContainer {
            children: unknown[] = []
            x: number = 0
            y: number = 0
            width: number = 100
            height: number = 150
            alpha: number = 1
            position: Record<string, unknown> = {
                set: vi.fn(),
            }
            scale: { set(v: number): void } = { set: vi.fn() }
            getGlobalPosition(): Record<string, number> {
                return { x: this.x, y: this.y }
            }
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
            buttons: number = 1
            stopPropagation(): void {}
        },
    }
})

// Mock geometry.ts functions
vi.mock('../utils/geometry', () => ({
    constrainPosition: vi.fn((x: number, y: number) => ({ x, y })),
}))

describe('DragController', () => {
    let controller: DragController
    let mockCard: Card
    let mockStage: Container
    let mockCardLayer: Container
    let mockEvent: FederatedPointerEvent
    let onDragMoveMock: (event: FederatedPointerEvent) => void

    beforeEach(() => {
        vi.clearAllMocks()

        controller = new DragController()

        mockCard = new Container() as Card
        mockCard.imageUrl = 'test.png'
        mockCard.innerSprite = new Sprite()
        mockCard.x = 50
        mockCard.y = 60
        mockCard.width = 100
        mockCard.height = 150
        mockCard.alpha = 1
        mockCard.parent = null
        vi.spyOn(mockCard.position, 'set')

        mockStage = new Container()
        vi.spyOn(mockStage, 'addChild')
        vi.spyOn(mockStage, 'removeChild')
        vi.spyOn(mockStage, 'on')
        vi.spyOn(mockStage, 'off')

        mockCardLayer = new Container()
        vi.spyOn(mockCardLayer, 'addChild')

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
        Object.defineProperty(mockEvent, 'buttons', {
            value: 1,
            writable: true,
            configurable: true,
            enumerable: true,
        })

        onDragMoveMock = vi.fn()
    })

    describe('handleDragStart', () => {
        it('should set up the drag state correctly', () => {
            controller.handleDragStart(mockEvent, mockStage, mockCardLayer, onDragMoveMock)

            expect(controller.dragState.dragTarget).toBe(mockCard)
            expect(controller.dragState.cardMoved).toBe(false)
            expect(mockCard.alpha).toBe(DRAGGING_OPACITY)
            expect(vi.mocked(mockCardLayer.addChild)).toHaveBeenCalledWith(mockCard)
            expect(vi.mocked(mockStage.on)).toHaveBeenCalledWith('pointermove', onDragMoveMock)
        })

        it('should calculate the drag offset correctly', () => {
            controller.handleDragStart(mockEvent, mockStage, mockCardLayer, onDragMoveMock)

            expect(controller.dragState.dragOffset).toEqual({
                x: mockCard.getGlobalPosition().x - mockEvent.global.x,
                y: mockCard.getGlobalPosition().y - mockEvent.global.y,
            })
        })
    })

    describe('handleDragMove', () => {
        beforeEach(() => {
            controller.dragState.dragTarget = mockCard
            controller.dragState.dragOffset = { x: 10, y: 20 }
            controller.dragState.originalParent = mockStage
            controller.dragState.originalPosition = { x: 50, y: 60 }
        })

        it('should update the card position based on the event and offset', () => {
            controller.handleDragMove(mockEvent, 800, 600)

            const expectedX: number = mockEvent.global.x + controller.dragState.dragOffset.x
            const expectedY: number = mockEvent.global.y + controller.dragState.dragOffset.y

            expect(mockCard.position.set).toHaveBeenCalledWith(expectedX, expectedY)
            expect(controller.dragState.cardMoved).toBe(true)
        })

        it('should do nothing if no card is being dragged', () => {
            controller.dragState.dragTarget = null

            controller.handleDragMove(mockEvent, 800, 600)

            expect(controller.dragState.cardMoved).toBe(false)
        })
    })

    describe('handleDragEnd', () => {
        beforeEach(() => {
            controller.dragState.dragTarget = mockCard
            controller.dragState.dragOffset = { x: 10, y: 20 }
            controller.dragState.originalParent = mockStage
            controller.dragState.originalPosition = { x: 50, y: 60 }
            controller.dragState.cardMoved = true
        })

        it('should do nothing if no card is being dragged', () => {
            controller.dragState.dragTarget = null

            controller.handleDragEnd(mockStage, onDragMoveMock, 800, 600)

            expect(vi.mocked(mockStage.off)).not.toHaveBeenCalled()
        })

        it('should reset the card opacity and drag state', () => {
            mockCard.parent = mockStage

            controller.handleDragEnd(mockStage, onDragMoveMock, 800, 600)

            expect(mockCard.alpha).toBe(DEFAULT_OPACITY)
            expect(controller.dragState.dragTarget).toBeNull()
            expect(controller.dragState.originalParent).toBeNull()
        })

        it('should return the card to its original position if it was not moved', () => {
            controller.dragState.cardMoved = false
            mockCard.parent = mockStage

            controller.handleDragEnd(mockStage, onDragMoveMock, 800, 600)

            expect(mockCard.x).toBe(50)
            expect(mockCard.y).toBe(60)
            expect(mockCard.alpha).toBe(DEFAULT_OPACITY)
            expect(controller.dragState.dragTarget).toBeNull()
        })

        it('should remove the pointermove listener from the stage', () => {
            mockCard.parent = mockStage

            controller.handleDragEnd(mockStage, onDragMoveMock, 800, 600)

            expect(vi.mocked(mockStage.off)).toHaveBeenCalledWith('pointermove', onDragMoveMock)
        })
    })
})
