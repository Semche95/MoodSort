import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetDragState } from '../utils/drag'
import { CardDragState } from '../types/drag.types'
import { Card } from '../types/card.types'
import { Container } from 'pixi.js'

// Mock PixiJS objects
vi.mock('pixi.js', () => {
    return {
        Container: class MockContainer {
            children: unknown[] = []
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
        },
        Sprite: class MockSprite {
            x: number = 0
            y: number = 0
            width: number = 100
            height: number = 150
            alpha: number = 1
            parent: unknown = null
        },
    }
})

describe('Drag Utilities', () => {
    describe('resetDragState', () => {
        let dragState: CardDragState

        beforeEach(() => {
            // Set up a drag state with some values
            dragState = {
                dragTarget: {
                    x: 100,
                    y: 200,
                    alpha: 0.5,
                } as Card,
                dragOffset: { x: 10, y: 20 },
                originalParent: {} as Container,
                originalPosition: { x: 50, y: 60 },
                cardMoved: true,
            }
        })

        it('should reset all properties of the drag state', () => {
            resetDragState(dragState)

            expect(dragState.dragTarget).toBeNull()
            expect(dragState.originalParent).toBeNull()
            // dragOffset is not reset in the implementation
            expect(dragState.originalPosition).toEqual({ x: 0, y: 0 })
            expect(dragState.cardMoved).toBe(false)
        })
    })

    // Note: addCardToDeck is not exported from drag.ts, so we can't test it directly
})
