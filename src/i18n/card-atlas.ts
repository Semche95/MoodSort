import { Assets, Spritesheet } from 'pixi.js'
import type { SpritesheetData } from 'pixi.js'
import atlasData from '../assets/atlas.json'
import type { Locale } from './i18n.types'
import type { ResolvedTheme } from '../types/theme.types'

type AtlasImageModule = { default: string }

const atlasImageLoaders: Record<string, () => Promise<AtlasImageModule>> = import.meta.glob<AtlasImageModule>('../assets/atlas.*.*.webp', { query: '?url' })

/** Loads the image URL matching `locale` and `theme`; the manifest is shared by every locale and theme. */
export async function loadCardAtlas(locale: Locale, theme: ResolvedTheme): Promise<{ atlasData: SpritesheetData; atlasImageUrl: string }> {
    const loadImage = atlasImageLoaders[`../assets/atlas.${locale}.${theme}.webp`]
    const atlasImageModule = await loadImage()
    return { atlasData: atlasData as SpritesheetData, atlasImageUrl: atlasImageModule.default }
}

/**
 * Loads and parses the full spritesheet for `locale`/`theme`. The locale is
 * fixed for the session (a locale switch still reloads the page), but the
 * theme can change at runtime, so this is called again on every theme
 * change to hot-swap card textures without a reload.
 */
export async function loadCardAtlasSpritesheet(locale: Locale, theme: ResolvedTheme): Promise<Spritesheet> {
    const { atlasData, atlasImageUrl } = await loadCardAtlas(locale, theme)
    const baseTexture = await Assets.load(atlasImageUrl)
    const spritesheet = new Spritesheet(baseTexture, atlasData)
    await spritesheet.parse()
    return spritesheet
}
