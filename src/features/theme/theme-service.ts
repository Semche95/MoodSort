import { Store } from '../../shared/utils/store'
import { IStore } from '../../types/store.types'
import { ResolvedTheme, THEME_STORAGE_KEY, Theme } from '../../types/theme.types'

const DATA_THEME_ATTRIBUTE = 'data-theme'

export function resolveTheme(theme: Theme): ResolvedTheme {
    if (theme === 'light' || theme === 'dark') {
        return theme
    }

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return 'light'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export class ThemeService {
    private readonly store: IStore
    private readonly storageKey: string
    private readonly listeners: Set<(resolved: ResolvedTheme) => void> = new Set()

    constructor(store: IStore = new Store(), storageKey: string = THEME_STORAGE_KEY) {
        this.store = store
        this.storageKey = storageKey
    }

    getTheme(): Theme {
        return this.store.load<Theme>(this.storageKey) ?? 'auto'
    }

    setTheme(theme: Theme): void {
        this.store.save<Theme>(this.storageKey, theme)

        const resolved = resolveTheme(theme)
        document.documentElement.setAttribute(DATA_THEME_ATTRIBUTE, resolved)

        for (const listener of this.listeners) {
            listener(resolved)
        }
    }

    getResolvedTheme(): ResolvedTheme {
        const attribute = document.documentElement.getAttribute(DATA_THEME_ATTRIBUTE)
        if (attribute === 'light' || attribute === 'dark') {
            return attribute
        }

        return resolveTheme(this.getTheme())
    }

    onChange(listener: (resolved: ResolvedTheme) => void): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }
}
