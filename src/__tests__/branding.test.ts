import { describe, expect, it, vi } from 'vitest'
import type { Texture } from 'pixi.js'
import { loadBrandingTextures } from '../features/toolbar/branding'

const { pixi } = vi.hoisted(() => {
    class Texture {
        src: string
        resolution: number
        constructor(src: string, resolution: number) {
            this.src = src
            this.resolution = resolution
        }
    }

    const Assets = {
        load: async (asset: { src: string; data: { resolution: number } }): Promise<unknown> => new Texture(asset.src, asset.data.resolution),
    }

    return { pixi: { Assets, Texture } }
})

vi.mock('pixi.js', () => ({ ...pixi }))

function describeTextures(textures: Texture[]): Array<{ src: string; resolution: number }> {
    return textures.map((texture: Texture) => texture as unknown as { src: string; resolution: number })
}

describe('branding', () => {
    it('loads the logo and the two title parts from their SVG sources', async () => {
        const textures = await loadBrandingTextures(1)
        const [logo, titleAccent, titleRest] = describeTextures([textures.logo, textures.titleAccent, textures.titleRest])

        expect(logo.src).toContain('logo.svg')
        expect(titleAccent.src).toContain('title-mood.svg')
        expect(titleRest.src).toContain('title-sort.svg')
    })

    it('rasterizes every SVG at the given resolution so they are drawn 1:1 on physical pixels', async () => {
        const textures = await loadBrandingTextures(2)

        for (const texture of describeTextures([textures.logo, textures.titleAccent, textures.titleRest])) {
            expect(texture.resolution).toBe(2)
        }
    })
})
