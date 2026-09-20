import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStore } from './in-memory-store'
import { ThemeService, resolveTheme } from '../features/theme/theme-service'

function mockMatchMedia(matches: boolean): void {
    window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia
}

describe('resolveTheme', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('resolves light as-is', () => {
        expect(resolveTheme('light')).toBe('light')
    })

    it('resolves dark as-is', () => {
        expect(resolveTheme('dark')).toBe('dark')
    })

    it('resolves auto to dark when the OS prefers dark', () => {
        mockMatchMedia(true)

        expect(resolveTheme('auto')).toBe('dark')
    })

    it('resolves auto to light when the OS prefers light', () => {
        mockMatchMedia(false)

        expect(resolveTheme('auto')).toBe('light')
    })

    it('falls back to light for auto when matchMedia is unavailable', () => {
        const original = window.matchMedia
        // @ts-expect-error simulating an environment without matchMedia
        delete window.matchMedia

        expect(resolveTheme('auto')).toBe('light')

        window.matchMedia = original
    })
})

describe('ThemeService', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme')
    })

    it('defaults to auto when nothing was ever persisted', () => {
        const service = new ThemeService(new InMemoryStore(), 'test-theme-key')

        expect(service.getTheme()).toBe('auto')
    })

    it('reads back a previously persisted theme', () => {
        const store = new InMemoryStore()
        store.save('test-theme-key', 'dark')
        const service = new ThemeService(store, 'test-theme-key')

        expect(service.getTheme()).toBe('dark')
    })

    it('persists the theme under the given storage key, independently from other keys', () => {
        const store = new InMemoryStore()
        const service = new ThemeService(store, 'test-theme-key')

        service.setTheme('dark')

        expect(store.load('test-theme-key')).toBe('dark')
        expect(store.load('other-key')).toBeNull()
    })

    it('applies the resolved theme to the document element', () => {
        const service = new ThemeService(new InMemoryStore(), 'test-theme-key')

        service.setTheme('dark')

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('resolves auto against the OS preference when applying the theme', () => {
        mockMatchMedia(true)
        const service = new ThemeService(new InMemoryStore(), 'test-theme-key')

        service.setTheme('auto')

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('notifies subscribed listeners with the resolved theme', () => {
        const service = new ThemeService(new InMemoryStore(), 'test-theme-key')
        const listener = vi.fn()
        service.onChange(listener)

        service.setTheme('light')

        expect(listener).toHaveBeenCalledWith('light')
    })

    it('stops notifying a listener once it has unsubscribed', () => {
        const service = new ThemeService(new InMemoryStore(), 'test-theme-key')
        const listener = vi.fn()
        const unsubscribe = service.onChange(listener)

        unsubscribe()
        service.setTheme('dark')

        expect(listener).not.toHaveBeenCalled()
    })

    it('getResolvedTheme reads the live data-theme attribute when present', () => {
        document.documentElement.setAttribute('data-theme', 'dark')
        const service = new ThemeService(new InMemoryStore(), 'test-theme-key')

        expect(service.getResolvedTheme()).toBe('dark')
    })

    it('getResolvedTheme falls back to resolving getTheme when the attribute is missing', () => {
        const store = new InMemoryStore()
        store.save('test-theme-key', 'light')
        const service = new ThemeService(store, 'test-theme-key')

        expect(service.getResolvedTheme()).toBe('light')
    })
})
