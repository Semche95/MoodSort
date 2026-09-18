import type { SpritesheetData } from 'pixi.js'
import type { Locale } from './i18n.types'

type AtlasDataModule = { default: SpritesheetData }
type AtlasImageModule = { default: string }

const atlasDataLoaders: Record<string, () => Promise<AtlasDataModule>> = import.meta.glob<AtlasDataModule>('../assets/atlas.*.json')
const atlasImageLoaders: Record<string, () => Promise<AtlasImageModule>> = import.meta.glob<AtlasImageModule>('../assets/atlas.*.webp', { query: '?url' })

/**
 * Loads the card atlas for `locale`. Called once at startup with the
 * session's already-resolved locale: there's no hot-swap of the atlas
 * mid-session.
 */
export async function loadCardAtlas(locale: Locale): Promise<{ atlasData: SpritesheetData; atlasImageUrl: string }> {
    const loadData = atlasDataLoaders[`../assets/atlas.${locale}.json`]
    const loadImage = atlasImageLoaders[`../assets/atlas.${locale}.webp`]
    const [atlasModule, atlasImageModule] = await Promise.all([loadData(), loadImage()])
    return { atlasData: atlasModule.default, atlasImageUrl: atlasImageModule.default }
}
