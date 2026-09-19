import { I18n, LOCALE_STORAGE_KEY } from './I18n'
import type { Locale } from './i18n.types'
import { AVAILABLE_LOCALES } from './locales'

function toSupportedLocale(tag: string): Locale | null {
    const lower = tag.toLowerCase()
    const match = AVAILABLE_LOCALES.find((locale: { code: Locale }): boolean => lower.startsWith(locale.code))
    return match?.code ?? null
}

/** Falls back to English for any browser language outside the supported locales. */
function detectBrowserLocale(): Locale {
    const tags = [navigator.language, ...(navigator.languages ?? [])].filter((tag: string): boolean => Boolean(tag))
    for (const tag of tags) {
        const locale = toSupportedLocale(tag)
        if (locale) {
            return locale
        }
    }
    return 'en'
}

function readStoredLocale(): Locale | null {
    try {
        const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
        return AVAILABLE_LOCALES.some((locale: { code: Locale }): boolean => locale.code === raw) ? (raw as Locale) : null
    } catch {
        return null
    }
}

/**
 * Resolves the locale to use for this session and persists it to
 * `moodsort-locale` (a key dedicated to i18n, independent of
 * PositionPersistence's own storage schema). Must be called once at app
 * startup, before any rendering, since it also sets the active locale on the
 * `I18n` singleton.
 */
export function resolveLocale(): Locale {
    const stored = readStoredLocale()
    const locale = stored ?? detectBrowserLocale()
    I18n.setLocale(locale)
    return locale
}
