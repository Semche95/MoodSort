import { describe, it, expect, beforeEach } from 'vitest'
import { CardStateService } from '../features/card/card-state-service'
import { InMemoryStore } from './in-memory-store'

describe('CardStateService', () => {
    let store: InMemoryStore
    let service: CardStateService

    beforeEach(() => {
        store = new InMemoryStore()
        service = new CardStateService(store)
    })

    it('returns default values when nothing was ever saved', () => {
        expect(service.load('positions')).toEqual({})
        expect(service.load('order')).toEqual([])
        expect(service.load('onboardingDismissed')).toBe(false)
    })

    it('saves and reloads the full state', () => {
        service.save({
            positions: { 'card-a': { x: 10, y: 20 } },
            order: ['card-a'],
            onboardingDismissed: true,
        })

        expect(service.load('positions')).toEqual({ 'card-a': { x: 10, y: 20 } })
        expect(service.load('order')).toEqual(['card-a'])
        expect(service.load('onboardingDismissed')).toBe(true)
    })

    it('overwrites the previous state entirely on save', () => {
        service.save({ positions: { a: { x: 1, y: 1 } }, order: ['a'], onboardingDismissed: true })
        service.save({ positions: {}, order: [], onboardingDismissed: false })

        expect(service.load('positions')).toEqual({})
        expect(service.load('order')).toEqual([])
        expect(service.load('onboardingDismissed')).toBe(false)
    })

    it('returns default values again after clear', () => {
        service.save({ positions: { a: { x: 1, y: 1 } }, order: ['a'], onboardingDismissed: true })

        service.clear()

        expect(service.load('positions')).toEqual({})
        expect(service.load('order')).toEqual([])
        expect(service.load('onboardingDismissed')).toBe(false)
    })
})
