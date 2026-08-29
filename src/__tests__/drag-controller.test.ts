import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DragController } from '../controllers/DragController'

describe('DragController', () => {
    let controller: DragController

    beforeEach(() => {
        vi.clearAllMocks()
        controller = new DragController()
    })

    describe('constructor', () => {
        it('should initialize with empty drag state', () => {
            expect(controller.dragState.dragTarget).toBeNull()
            expect(controller.dragState.originalParent).toBeNull()
            expect(controller.dragState.originalPosition).toEqual({ x: 0, y: 0 })
            expect(controller.dragState.cardMoved).toBe(false)
        })
    })
})
