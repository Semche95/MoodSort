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
        expect(service.load('stackNames')).toEqual({})
    })

    it('saves and reloads the full state', () => {
        service.save({
            positions: { 'card-a': { x: 10, y: 20 } },
            order: ['card-a'],
            onboardingDismissed: true,
            stackNames: { 'card-a': 'Joy' },
        })

        expect(service.load('positions')).toEqual({ 'card-a': { x: 10, y: 20 } })
        expect(service.load('order')).toEqual(['card-a'])
        expect(service.load('onboardingDismissed')).toBe(true)
        expect(service.load('stackNames')).toEqual({ 'card-a': 'Joy' })
    })

    it('overwrites the previous state entirely on save', () => {
        service.save({ positions: { a: { x: 1, y: 1 } }, order: ['a'], onboardingDismissed: true, stackNames: { a: 'Joy' } })
        service.save({ positions: {}, order: [], onboardingDismissed: false, stackNames: {} })

        expect(service.load('positions')).toEqual({})
        expect(service.load('order')).toEqual([])
        expect(service.load('onboardingDismissed')).toBe(false)
        expect(service.load('stackNames')).toEqual({})
    })

    it('returns default values again after clear', () => {
        service.save({ positions: { a: { x: 1, y: 1 } }, order: ['a'], onboardingDismissed: true, stackNames: { a: 'Joy' } })

        service.clear()

        expect(service.load('positions')).toEqual({})
        expect(service.load('order')).toEqual([])
        expect(service.load('onboardingDismissed')).toBe(false)
        expect(service.load('stackNames')).toEqual({})
    })

    it('migrates a pre-stackNames saved blob to the current schema, defaulting to no names', () => {
        store.save('moodsort-card-state', { positions: { a: { x: 1, y: 1 } }, order: ['a'], onboardingDismissed: true })

        expect(service.wasMigrated).toBe(false)
        expect(service.load('stackNames')).toEqual({})
        expect(service.wasMigrated).toBe(true)
        expect(service.load('positions')).toEqual({ a: { x: 1, y: 1 } })
        expect(store.load<{ schemaVersion: number }>('moodsort-card-state')?.schemaVersion).toBe(2)
    })
})
