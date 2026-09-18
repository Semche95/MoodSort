import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveLocale } from '../i18n/locale-resolution'
import { I18n } from '../i18n/I18n'

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
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true })
    Object.defineProperty(navigator, 'languages', { value: ['fr-FR', 'fr'], configurable: true })
})

describe('resolveLocale', () => {
    it('detects and persists the browser locale on first launch (nothing stored yet)', () => {
        const result = resolveLocale()

        expect(result).toBe('fr')
        expect(localStorage.getItem('moodsort-locale')).toBe('fr')
        expect(I18n.getLocale()).toBe('fr')
    })

    it('falls back to English for an unsupported browser language', () => {
        Object.defineProperty(navigator, 'language', { value: 'de-DE', configurable: true })
        Object.defineProperty(navigator, 'languages', { value: ['de-DE'], configurable: true })

        expect(resolveLocale()).toBe('en')
    })

    it('prioritizes a previously persisted locale over the detected browser locale', () => {
        localStorage.setItem('moodsort-locale', 'en')

        const result = resolveLocale()

        expect(result).toBe('en')
        expect(I18n.getLocale()).toBe('en')
    })
})
