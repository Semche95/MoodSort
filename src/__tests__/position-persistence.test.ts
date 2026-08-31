import { describe, it, expect, beforeEach } from 'vitest'
import type { Container } from 'pixi.js'
import { PositionPersistence } from '../features/card/position-persistence'
import { CardStateService } from '../features/card/card-state-service'
import { InMemoryStore } from './in-memory-store'
import { Card } from '../types/card.types'

function fakeStage(children: unknown[]): Container {
    return { children } as unknown as Container
}

function fakeCard(imageUrl: string, x: number, y: number): Card {
    return { imageUrl, x, y } as unknown as Card
}

describe('PositionPersistence', () => {
    let rawStore: InMemoryStore
    let cardStateService: CardStateService
    let persistence: PositionPersistence

    beforeEach(() => {
        rawStore = new InMemoryStore()
        cardStateService = new CardStateService(rawStore)
        persistence = new PositionPersistence(cardStateService)
    })

    it('load returns defaults when nothing was saved', () => {
        const state = persistence.load()

        expect(state).toEqual({ positions: {}, order: [], onboardingDismissed: false, stackNames: {} })
        expect(persistence.wasMigrated).toBe(false)
    })

    it('save delegates directly to the underlying store', () => {
        persistence.save({ positions: { a: { x: 1, y: 2 } }, order: ['a'], onboardingDismissed: true, stackNames: { a: 'Joy' } })

        expect(cardStateService.load('positions')).toEqual({ a: { x: 1, y: 2 } })
        expect(cardStateService.load('order')).toEqual(['a'])
        expect(cardStateService.load('onboardingDismissed')).toBe(true)
        expect(cardStateService.load('stackNames')).toEqual({ a: 'Joy' })
    })

    it('saveFromStage reads position and order from cards on the stage, in child order', () => {
        const stage = fakeStage([fakeCard('card-a', 10, 20), fakeCard('card-b', 30, 40)])

        persistence.saveFromStage(stage)

        expect(cardStateService.load('positions')).toEqual({
            'card-a': { x: 10, y: 20 },
            'card-b': { x: 30, y: 40 },
        })
        expect(cardStateService.load('order')).toEqual(['card-a', 'card-b'])
    })

    it('saveFromStage ignores stage children without an imageUrl', () => {
        const decoration = { x: 0, y: 0 } as unknown as Card
        const stage = fakeStage([decoration, fakeCard('card-a', 10, 20)])

        persistence.saveFromStage(stage)

        expect(cardStateService.load('order')).toEqual(['card-a'])
    })

    it('saveFromStage preserves the existing onboardingDismissed flag', () => {
        cardStateService.save({ positions: {}, order: [], onboardingDismissed: true, stackNames: {} })

        persistence.saveFromStage(fakeStage([]))

        expect(cardStateService.load('onboardingDismissed')).toBe(true)
    })

    it('saveFromStage persists the given stackNames', () => {
        const stage = fakeStage([fakeCard('card-a', 10, 20)])

        persistence.saveFromStage(stage, { 'card-a': 'Joy' })

        expect(cardStateService.load('stackNames')).toEqual({ 'card-a': 'Joy' })
    })

    it('migrates legacy hashed-URL keys to plain frame names and flags wasMigrated', () => {
        cardStateService.save({
            positions: { '/assets/sad-cat-Ab12xY.webp': { x: 5, y: 6 } },
            order: ['/assets/sad-cat-Ab12xY.webp'],
            onboardingDismissed: false,
            stackNames: {},
        })

        const state = persistence.load()

        expect(state.positions).toEqual({ 'sad-cat': { x: 5, y: 6 } })
        expect(state.order).toEqual(['sad-cat'])
        expect(persistence.wasMigrated).toBe(true)
        expect(cardStateService.load('positions')).toEqual({ 'sad-cat': { x: 5, y: 6 } })
    })

    it('does not flag a migration when keys are already plain frame names', () => {
        cardStateService.save({
            positions: { 'sad-cat': { x: 5, y: 6 } },
            order: ['sad-cat'],
            onboardingDismissed: false,
            stackNames: {},
        })

        persistence.load()

        expect(persistence.wasMigrated).toBe(false)
    })

    it('load defaults stackNames to {} for a legacy save that predates the field entirely', () => {
        // Simulates a blob saved by an older MoodSort version, before stackNames existed:
        // no stackNames key at all, bypassing CardStateService's own typed save().
        rawStore.save('moodsort-card-state', {
            positions: { a: { x: 1, y: 1 } },
            order: ['a'],
            onboardingDismissed: false,
        })

        const state = persistence.load()

        expect(state.stackNames).toEqual({})
        expect(state.positions).toEqual({ a: { x: 1, y: 1 } })
    })

    it('clear empties positions, order and stackNames but keeps onboardingDismissed', () => {
        cardStateService.save({ positions: { a: { x: 1, y: 1 } }, order: ['a'], onboardingDismissed: true, stackNames: { a: 'Joy' } })

        persistence.clear()

        expect(cardStateService.load('positions')).toEqual({})
        expect(cardStateService.load('order')).toEqual([])
        expect(cardStateService.load('stackNames')).toEqual({})
        expect(cardStateService.load('onboardingDismissed')).toBe(true)
    })
})
