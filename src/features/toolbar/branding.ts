import { Assets, Texture } from 'pixi.js'
import logoUrl from '../../logo/logo.svg?url'
import titleMoodUrl from '../../logo/title-mood.svg?url'
import titleSortUrl from '../../logo/title-sort.svg?url'
import type { BrandingTextures } from '../../types/branding-textures.types'

// Rasterized at the renderer resolution and drawn at their intrinsic size: a downscaled texture aliases without mipmaps.
function loadSvgTexture(src: string, resolution: number): Promise<Texture> {
    return Assets.load<Texture>({ src, data: { resolution } })
}

export async function loadBrandingTextures(resolution: number): Promise<BrandingTextures> {
    return {
        logo: await loadSvgTexture(logoUrl, resolution),
        titleAccent: await loadSvgTexture(titleMoodUrl, resolution),
        titleRest: await loadSvgTexture(titleSortUrl, resolution),
    }
}
