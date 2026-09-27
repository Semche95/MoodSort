import { describe, it, expect, vi } from 'vitest'
import type { Texture } from 'pixi.js'

const mockParse = vi.fn().mockResolvedValue(undefined)

vi.mock('pixi.js', () => ({
    Assets: { load: vi.fn().mockResolvedValue({} as Texture) },
    Spritesheet: class MockSpritesheet {
        textures: Record<string, unknown> = { joy: {} }
        parse: typeof mockParse = mockParse
        constructor() {}
    },
}))

import { loadCardAtlas, loadCardAtlasSpritesheet } from '../i18n/card-atlas'

describe('loadCardAtlas', () => {
    it('resolves the shared manifest and the image URL matching the given locale and theme', async () => {
        const { atlasData, atlasImageUrl } = await loadCardAtlas('en', 'light')

        expect(atlasData.frames).toBeDefined()
        expect(atlasImageUrl).toContain('atlas.en.light.webp')
    })

    it('resolves a different image URL for the dark theme of the same locale, sharing the same manifest', async () => {
        const light = await loadCardAtlas('en', 'light')
        const dark = await loadCardAtlas('en', 'dark')

        expect(dark.atlasImageUrl).toContain('atlas.en.dark.webp')
        expect(dark.atlasData).toEqual(light.atlasData)
    })

    it('resolves the same manifest for two different locales, since frame layout never depends on locale', async () => {
        const en = await loadCardAtlas('en', 'light')
        const fr = await loadCardAtlas('fr', 'light')

        expect(fr.atlasData).toEqual(en.atlasData)
    })
})

describe('loadCardAtlasSpritesheet', () => {
    it('loads the base texture, builds a Spritesheet from it, and parses it before returning', async () => {
        const spritesheet = await loadCardAtlasSpritesheet('en', 'light')

        expect(mockParse).toHaveBeenCalled()
        expect(spritesheet.textures).toEqual({ joy: {} })
    })
})
