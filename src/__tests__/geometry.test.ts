import { describe, it, expect } from 'vitest'
import { constrainPosition } from '../utils/geometry'
import { Position } from '../types/position.types'

describe('constrainPosition', () => {
    const appWidth: number = 800
    const appHeight: number = 600
    const objectWidth: number = 100
    const objectHeight: number = 150

    it('should return the same position when within bounds', () => {
        const position: Position = constrainPosition(200, 300, objectWidth, objectHeight, appWidth, appHeight)

        expect(position.x).toBe(200)
        expect(position.y).toBe(300)
    })

    it('should constrain x position when too far left', () => {
        const position: Position = constrainPosition(-50, 300, objectWidth, objectHeight, appWidth, appHeight)

        expect(position.x).toBe(0)
        expect(position.y).toBe(300)
    })

    it('should constrain y position when too far up', () => {
        const position: Position = constrainPosition(200, -50, objectWidth, objectHeight, appWidth, appHeight)

        expect(position.x).toBe(200)
        expect(position.y).toBe(0)
    })

    it('should constrain x position when too far right', () => {
        const position: Position = constrainPosition(750, 300, objectWidth, objectHeight, appWidth, appHeight)

        expect(position.x).toBe(700) // appWidth - objectWidth
        expect(position.y).toBe(300)
    })

    it('should constrain y position when too far down', () => {
        const position: Position = constrainPosition(200, 500, objectWidth, objectHeight, appWidth, appHeight)

        expect(position.x).toBe(200)
        expect(position.y).toBe(450) // appHeight - objectHeight
    })

    it('should constrain both x and y positions when out of bounds in both directions', () => {
        const position: Position = constrainPosition(850, 650, objectWidth, objectHeight, appWidth, appHeight)

        expect(position.x).toBe(700) // appWidth - objectWidth
        expect(position.y).toBe(450) // appHeight - objectHeight
    })
})
