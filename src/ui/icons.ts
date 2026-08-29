import { Assets, Sprite, Text, Texture } from 'pixi.js'
import undoIconUrl from '../assets/icons/undo-2.webp?url'
import redoIconUrl from '../assets/icons/redo-2.webp?url'
import settingsIconUrl from '../assets/icons/sliders-horizontal.webp?url'

export const ICON_NAMES = ['undo-2', 'redo-2', 'sliders-horizontal'] as const

export type IconName = (typeof ICON_NAMES)[number]

export const ICON_COLOR = 0x111111
export const ICON_SIZE = 22

export async function loadIconTextures(): Promise<Record<string, Texture>> {
    const urls: Record<IconName, string> = {
        'undo-2': undoIconUrl,
        'redo-2': redoIconUrl,
        'sliders-horizontal': settingsIconUrl,
    }
    const textures: Record<string, Texture> = {}
    for (const name of ICON_NAMES) {
        textures[name] = await Assets.load<Texture>(urls[name])
    }
    return textures
}

export function createIcon(texture: Texture): Sprite {
    const icon = new Sprite(texture)
    icon.anchor.set(0.5)
    icon.tint = ICON_COLOR
    return icon
}

export function createHelpIcon(): Text {
    return new Text({
        text: '?',
        style: {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            fontSize: ICON_SIZE,
            fontWeight: '500',
            fill: ICON_COLOR,
        },
    })
}
