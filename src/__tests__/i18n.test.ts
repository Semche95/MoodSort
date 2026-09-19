import { describe, it, expect, beforeEach, vi } from 'vitest'
import { I18n } from '../i18n/I18n'

const dictionaryModules = import.meta.glob<{ default: Record<string, unknown> }>('../i18n/locales/*.json', { eager: true })
const dictionariesByLocale = Object.fromEntries(
    Object.entries(dictionaryModules).map(([path, module]: [string, { default: Record<string, unknown> }]): [string, Record<string, unknown>] =>
        [path.replace('../i18n/locales/', '').replace('.json', ''), module.default]),
)

function flattenKeys(value: unknown, prefix: string = ''): string[] {
    if (typeof value === 'string') {
        return [prefix]
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]: [string, unknown]): string[] =>
        flattenKeys(child, prefix ? `${prefix}.${key}` : key))
}

describe('i18n dictionaries', () => {
    it('every locale dictionary exposes exactly the same set of keys as fr.json', () => {
        const referenceKeys = flattenKeys(dictionariesByLocale.fr).sort()

        for (const [locale, dictionary] of Object.entries(dictionariesByLocale)) {
            expect(flattenKeys(dictionary).sort(), `locale "${locale}"`).toEqual(referenceKeys)
        }
    })
})

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

describe('I18n', () => {
    it('translates a key in the current locale', () => {
        I18n.setLocale('fr')
        expect(I18n.t('toolbar.undo')).toBe('Annuler')

        I18n.setLocale('en')
        expect(I18n.t('toolbar.undo')).toBe('Undo')
    })

    it('translates a key in an explicit locale override, regardless of the active locale', () => {
        I18n.setLocale('fr')
        expect(I18n.t('toolbar.undo', undefined, 'en')).toBe('Undo')
    })

    it('persists the locale to localStorage on setLocale', () => {
        I18n.setLocale('en')
        expect(localStorage.getItem('moodsort-locale')).toBe('en')
    })

    it('notifies onChange subscribers and lets them unsubscribe', () => {
        const callback = vi.fn()
        const unsubscribe = I18n.onChange(callback)

        I18n.setLocale('en')
        expect(callback).toHaveBeenCalledWith('en')

        unsubscribe()
        I18n.setLocale('fr')
        expect(callback).toHaveBeenCalledTimes(1)
    })
})
