import { describe, it, expect } from 'vitest'
import type { Application, Container } from 'pixi.js'
import { CardManager } from '../controllers/CardManager'
import { Card } from '../types/card.types'
import { AnimationTarget } from '../types/animation.types'

function makeCard(x: number, y: number, imageUrl: string): Card {
    return { x, y, imageUrl } as unknown as Card
}

describe('CardManager.buildCompactTargets', () => {
    const manager = new CardManager({} as Application, {} as Container)

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
})
