import { Assets, Sprite, Text, Texture } from 'pixi.js'
import undoIconUrl from '../../assets/icons/undo-2.webp?url'
import redoIconUrl from '../../assets/icons/redo-2.webp?url'
import settingsIconUrl from '../../assets/icons/sliders-horizontal.webp?url'
import screenShareIconUrl from '../../assets/icons/screen-share.webp?url'
import globeIconUrl from '../../assets/icons/globe.webp?url'
import type { ResolvedTheme } from '../../types/theme.types'
import { getPixiThemeColors } from '../../features/theme/pixi-theme-colors'

export const ICON_NAMES = ['undo-2', 'redo-2', 'sliders-horizontal', 'screen-share', 'globe'] as const

export type IconName = (typeof ICON_NAMES)[number]

export const ICON_SIZE = 22

export async function loadIconTextures(): Promise<Record<string, Texture>> {
    const urls: Record<IconName, string> = {
        'undo-2': undoIconUrl,
        'redo-2': redoIconUrl,
        'sliders-horizontal': settingsIconUrl,
        'screen-share': screenShareIconUrl,
        globe: globeIconUrl,
    }
    const textures: Record<string, Texture> = {}
    for (const name of ICON_NAMES) {
        textures[name] = await Assets.load<Texture>(urls[name])
    }
    return textures
}

export function createIcon(texture: Texture, resolvedTheme: ResolvedTheme = 'light'): Sprite {
    const icon = new Sprite(texture)
    icon.anchor.set(0.5)
    icon.tint = getPixiThemeColors(resolvedTheme).icon
    return icon
}

/** Re-tints an already-created icon sprite in place, e.g. from a theme-change listener, without rebuilding it. */
export function applyIconTheme(icon: Sprite, resolvedTheme: ResolvedTheme): void {
    icon.tint = getPixiThemeColors(resolvedTheme).icon
}

export function createHelpIcon(resolvedTheme: ResolvedTheme = 'light'): Text {
    return new Text({
        text: '?',
        style: {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            fontSize: ICON_SIZE,
            fontWeight: '500',
            fill: getPixiThemeColors(resolvedTheme).icon,
        },
    })
}
