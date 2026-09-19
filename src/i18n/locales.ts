import type { Locale } from './i18n.types'

export interface LocaleOption {
    code: Locale
    /** The language's own name, written in that language (e.g. "Français", "English"). */
    nativeName: string
}

/**
 * Every locale the app ships translations for, in display order. This is the
 * single place that knows the full set of locales: the toolbar's language
 * menu and any other locale-listing UI derive their options from here, so
 * adding a locale (dictionary, atlas assets, then an entry here) is enough
 * to offer it everywhere without touching UI code.
 */
export const AVAILABLE_LOCALES: LocaleOption[] = [
    { code: 'fr', nativeName: 'Français' },
    { code: 'en', nativeName: 'English' },
    { code: 'de', nativeName: 'Deutsch' },
    { code: 'nl', nativeName: 'Nederlands' },
]
