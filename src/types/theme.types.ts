export type Theme = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'
/** Read fresh on every draw so callers pick up a theme flip without needing to be rebuilt. */
export type GetResolvedTheme = () => ResolvedTheme

export const THEME_STORAGE_KEY = 'moodsort-theme' as const
export const VIEWER_THEME_STORAGE_KEY = 'moodsort-viewer-theme' as const
