import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PositionStore, InMemoryPositionStore } from '../services/PositionStore'
import { Position } from '../types/position.types'

// Mock localStorage for jsdom environment
const localStorageMock: Record<string, string> = {}

beforeEach(() => {
    Object.keys(localStorageMock).forEach((key: string) => delete localStorageMock[key])

    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: vi.fn((key: string): string | null => localStorageMock[key] ?? null),
            setItem: vi.fn((key: string, value: string): void => { localStorageMock[key] = value }),
            clear: vi.fn((): void => { Object.keys(localStorageMock).forEach((k: string) => delete localStorageMock[k]) }),
        },
        writable: true,
        configurable: true,
    })
})

describe('PositionStore', () => {
    let store: PositionStore

    beforeEach(() => {
        store = new PositionStore('test-positions')
    })

    it('should return empty object when no positions are saved', () => {
        expect(store.load()).toEqual({})
    })

    it('should save and load positions', () => {
        const positions: Record<string, Position> = {
            'image1.png': { x: 100, y: 200 },
            'image2.png': { x: 300, y: 400 },
        }

        store.save(positions)
        const loaded: Record<string, Position> = store.load()

        expect(loaded).toEqual(positions)
    })

    it('should overwrite previous positions on save', () => {
        const first: Record<string, Position> = { 'a.png': { x: 1, y: 2 } }
        const second: Record<string, Position> = { 'b.png': { x: 3, y: 4 } }

        store.save(first)
        store.save(second)

        expect(store.load()).toEqual(second)
    })

    it('should handle corrupt localStorage gracefully', () => {
        localStorageMock['test-positions'] = '{corrupt json'
        expect(store.load()).toEqual({})
    })

    it('should handle localStorage throwing on getItem', () => {
        vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('unavailable') })
        expect(store.load()).toEqual({})
    })

    it('should handle localStorage throwing on setItem', () => {
        vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('unavailable') })
        expect(() => store.save({ 'a.png': { x: 0, y: 0 } })).not.toThrow()
    })
})

describe('InMemoryPositionStore', () => {
    let store: InMemoryPositionStore

    beforeEach(() => {
        store = new InMemoryPositionStore()
    })

    it('should return empty object initially', () => {
        expect(store.load()).toEqual({})
    })

    it('should save and load positions', () => {
        const positions: Record<string, Position> = {
            'image1.png': { x: 100, y: 200 },
        }

        store.save(positions)
        expect(store.load()).toEqual(positions)
    })

    it('should return independent copies on load', () => {
        const positions: Record<string, Position> = { 'a.png': { x: 1, y: 2 } }
        store.save(positions)

        const loaded: Record<string, Position> = store.load()
        loaded['a.png'] = { x: 999, y: 999 }

        expect(store.load()['a.png']).toEqual({ x: 1, y: 2 })
    })
})
