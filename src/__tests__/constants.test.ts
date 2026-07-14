import { describe, it, expect } from 'vitest'
import {
    DRAGGING_OPACITY,
    DEFAULT_OPACITY,
} from '../utils/constants'

describe('Constants', () => {
    describe('Card styling', () => {
        it('should have the correct DRAGGING_OPACITY', () => {
            expect(DRAGGING_OPACITY).toBe(0.5)
        })

        it('should have the correct DEFAULT_OPACITY', () => {
            expect(DEFAULT_OPACITY).toBe(1)
        })
    })
})
