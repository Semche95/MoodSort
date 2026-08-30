import { describe, it, expect, vi } from 'vitest'
import type { Application, Container } from 'pixi.js'
import { CardManager } from '../features/card/card-manager'
import { STACK_HANDLE_TOP_CLEARANCE } from '../features/stack/stack'
import { Card } from '../types/card.types'
import { AnimationTarget } from '../types/animation.types'

vi.mock('pixi.js', () => ({
    Container: class MockContainer {},
    Graphics: class MockGraphics {},
    Sprite: class MockSprite {},
    BlurFilter: class MockBlurFilter {},
}))

function makeCard(x: number, y: number, imageUrl: string): Card {
    return { x, y, width: 100, height: 150, imageUrl } as unknown as Card
}

describe('CardManager.buildCompactTargets', () => {
    const app = { screen: { width: 800, height: 600 } } as unknown as Application
    const manager = new CardManager(app, {} as Container)

    it('does not include the top card in the returned targets', () => {
        const top = makeCard(500, 400, 'top')
        const others = [makeCard(10, 10, 'a'), makeCard(20, 20, 'b')]

        const targets = manager.buildCompactTargets(top, others)

        expect(targets).toHaveLength(2)
        expect(targets.map((t: AnimationTarget): Card => t.card)).toEqual(others)
    })

    it('disperses each other card within the same ±25px jitter range as the natural first-visit stacking, centered on the top card', () => {
        const top = makeCard(500, 400, 'top')
        const others = [makeCard(10, 10, 'a')]

        const [target] = manager.buildCompactTargets(top, others)

        expect(target.fromX).toBe(10)
        expect(target.fromY).toBe(10)
        expect(target.toX).toBeGreaterThanOrEqual(500 - 25)
        expect(target.toX).toBeLessThanOrEqual(500 + 25)
        expect(target.toY).toBeGreaterThanOrEqual(400 - 25)
        expect(target.toY).toBeLessThanOrEqual(400 + 25)
    })

    it('does not add a rotation property to the animation targets', () => {
        const top = makeCard(500, 400, 'top')
        const others = [makeCard(10, 10, 'a')]

        const [target] = manager.buildCompactTargets(top, others)

        expect(Object.prototype.hasOwnProperty.call(target, 'rotation')).toBe(false)
    })

    it('returns no targets when there are no other cards to disperse', () => {
        const top = makeCard(500, 400, 'top')

        expect(manager.buildCompactTargets(top, [])).toEqual([])
    })

    it('keeps the dispersed target below the handle top clearance when the stack sits near the canvas top', () => {
        const top = makeCard(500, STACK_HANDLE_TOP_CLEARANCE, 'top')
        const others = [makeCard(10, 10, 'a')]
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

        const [target] = manager.buildCompactTargets(top, others)

        randomSpy.mockRestore()
        expect(target.toY).toBe(STACK_HANDLE_TOP_CLEARANCE)
    })

    it('keeps the dispersed target within the canvas when the stack sits near the right/bottom edge', () => {
        const top = makeCard(780, 580, 'top')
        const others = [makeCard(10, 10, 'a')]
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1)

        const [target] = manager.buildCompactTargets(top, others)

        randomSpy.mockRestore()
        expect(target.toX).toBe(700) // appWidth (800) - card width (100)
        expect(target.toY).toBe(450) // appHeight (600) - card height (150)
    })
})
