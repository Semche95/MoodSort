import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Store } from '../shared/utils/store'
import { InMemoryStore } from './in-memory-store'

// Mock localStorage for jsdom environment
const localStorageMock: Record<string, string> = {}

beforeEach(() => {
    Object.keys(localStorageMock).forEach((key: string) => delete localStorageMock[key])

    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: vi.fn((key: string): string | null => localStorageMock[key] ?? null),
            setItem: vi.fn((key: string, value: string): void => { localStorageMock[key] = value }),
            removeItem: vi.fn((key: string): void => { delete localStorageMock[key] }),
            clear: vi.fn((): void => { Object.keys(localStorageMock).forEach((k: string) => delete localStorageMock[k]) }),
        },
        writable: true,
        configurable: true,
    })
})

describe('Store', () => {
    let store: Store

    beforeEach(() => {
        store = new Store()
    })

    it('should return null when nothing is saved', () => {
        expect(store.load('test-key')).toBeNull()
    })

    it('should save and load any value', () => {
        const state: { hello: string; count: number } = { hello: 'world', count: 42 }

        store.save('test-key', state)
        const loaded: { hello: string; count: number } | null = store.load<{ hello: string; count: number }>('test-key')

        expect(loaded).toEqual(state)
    })

    it('should overwrite previous state on save', () => {
        const first: { a: number } = { a: 1 }
        const second: { b: number } = { b: 2 }

        store.save('test-key', first)
        store.save('test-key', second)

        expect(store.load('test-key')).toEqual(second)
    })

    it('should return null for corrupt localStorage', () => {
        localStorageMock['test-key'] = '{corrupt json'
        expect(store.load('test-key')).toBeNull()
    })

    it('should handle localStorage throwing on getItem', () => {
        vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('unavailable') })
        expect(store.load('test-key')).toBeNull()
    })

    it('should handle localStorage throwing on setItem', () => {
        vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('unavailable') })
        expect(() => store.save('test-key', { a: 1 })).not.toThrow()
    })

    it('should clear only the specified key', () => {
        store.save('key-a', 1)
        store.save('key-b', 2)
        store.clear('key-a')

        expect(store.load('key-a')).toBeNull()
        expect(store.load('key-b')).toBe(2)
    })

    it('should support different keys independently', () => {
        store.save('positions', { x: 10, y: 20 })
        store.save('order', ['a', 'b'])

        expect(store.load('positions')).toEqual({ x: 10, y: 20 })
        expect(store.load('order')).toEqual(['a', 'b'])
    })
})

describe('InMemoryStore', () => {
    let store: InMemoryStore

    beforeEach(() => {
        store = new InMemoryStore()
    })

    it('should return null initially', () => {
        expect(store.load('test-key')).toBeNull()
    })

    it('should save and load any value', () => {
        const state: { hello: string } = { hello: 'world' }
        store.save('test-key', state)
        expect(store.load('test-key')).toEqual(state)
    })

    it('should return independent copies on load', () => {
        const state: { positions: Record<string, { x: number; y: number }> } = { positions: { 'a.png': { x: 1, y: 2 } } }
        store.save('test-key', state)

        const loaded: { positions: Record<string, { x: number; y: number }> } = store.load<{ positions: Record<string, { x: number; y: number }> }>('test-key')!
        loaded.positions['a.png'] = { x: 999, y: 999 }

        const reloaded: { positions: Record<string, { x: number; y: number }> } = store.load<{ positions: Record<string, { x: number; y: number }> }>('test-key')!
        expect(reloaded.positions['a.png']).toEqual({ x: 1, y: 2 })
    })

    it('should clear only the specified key', () => {
        store.save('key-a', 1)
        store.save('key-b', 2)
        store.clear('key-a')

        expect(store.load('key-a')).toBeNull()
        expect(store.load('key-b')).toBe(2)
    })
})
