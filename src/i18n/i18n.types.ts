import fr from './locales/fr.json'

export type Locale = 'fr' | 'en' | 'de'

/**
 * Recursively flattens a nested translation dictionary's shape into a union
 * of dotted-path keys (e.g. `toolbar.undo`), so `TranslationKey` gives
 * autocomplete and a compile error when a key is renamed or removed.
 */
type Flatten<T> = T extends string
    ? never
    : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Flatten<T[K]>}` }[keyof T & string]

/** fr.json is the reference shape: every translation key must exist there. */
export type TranslationKey = Flatten<typeof fr>
