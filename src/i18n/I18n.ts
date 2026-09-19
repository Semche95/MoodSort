import type { Locale, TranslationKey } from './i18n.types'

export const LOCALE_STORAGE_KEY = 'moodsort-locale'

type Dictionary = Record<string, unknown>
type DictionaryModule = { default: Dictionary }

/** Every locale JSON dictionary, keyed by its locale code, discovered from the files present in `./locales`: adding a locale here needs no change to this file. */
const dictionaryModules: Record<string, DictionaryModule> = import.meta.glob<DictionaryModule>('./locales/*.json', { eager: true })
const dictionaries = Object.fromEntries(
    Object.entries(dictionaryModules).map(([path, module]: [string, DictionaryModule]): [string, Dictionary] =>
        [path.replace('./locales/', '').replace('.json', ''), module.default]),
) as Record<Locale, Dictionary>

function resolveTemplate(dictionary: Dictionary, key: TranslationKey): string {
    const value: unknown = key.split('.').reduce<unknown>((node: unknown, part: string): unknown => {
        if (node && typeof node === 'object' && part in node) {
            return (node as Dictionary)[part]
        }
        return undefined
    }, dictionary)
    return typeof value === 'string' ? value : key
}

function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) {
        return template
    }
    return template.replace(/\{(\w+)\}/g, (match: string, name: string): string =>
        name in params ? String(params[name]) : match)
}

/**
 * Central i18n singleton: current locale plus a simple pub/sub so UI pieces
 * that need to react to a locale change can subscribe. In this app locale
 * changes always trigger a full page reload (see the language toolbar
 * button), so `onChange` is mostly unused today but kept as part of the
 * public API for callers that need it.
 */
class I18nStore {
    private locale: Locale = 'fr'
    private readonly listeners: Set<(locale: Locale) => void> = new Set<(locale: Locale) => void>()

    t(key: TranslationKey, params?: Record<string, string | number>, localeOverride?: Locale): string {
        const locale = localeOverride ?? this.locale
        return interpolate(resolveTemplate(dictionaries[locale], key), params)
    }

    getLocale(): Locale {
        return this.locale
    }

    setLocale(locale: Locale): void {
        this.locale = locale
        try {
            localStorage.setItem(LOCALE_STORAGE_KEY, locale)
        } catch {
            // localStorage unavailable
        }
        for (const listener of this.listeners) {
            listener(locale)
        }
    }

    onChange(callback: (locale: Locale) => void): () => void {
        this.listeners.add(callback)
        return (): void => { this.listeners.delete(callback) }
    }

    reload(): void {
        window.location.reload()
    }
}

export const I18n = new I18nStore()

/** Persists `locale` and reloads the page, the app's only supported way to apply a locale change. */
export function switchLocale(locale: Locale): void {
    I18n.setLocale(locale)
    I18n.reload()
}
