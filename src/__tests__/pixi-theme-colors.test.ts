import { describe, expect, it } from 'vitest'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'

describe('getPixiThemeColors', () => {
    it('returns the light palette for "light"', () => {
        const palette = getPixiThemeColors('light')

        expect(palette.canvasBackground).toBe(0xa9a9a9)
        expect(palette.card.hoverTint).toBe(0xffeedd)
        expect(palette.icon).toBe(0x111111)
        expect(palette.card.shadow).toEqual({ color: 0x000000, alpha: 0.18, blurStrength: 4, offsetX: 0, offsetY: 0 })
    })

    it('returns the dark palette for "dark"', () => {
        const palette = getPixiThemeColors('dark')

        expect(palette.canvasBackground).toBe(0x1e1e1e)
        expect(palette.card.hoverTint).toBe(0xffd9a8)
        expect(palette.icon).toBe(0xf2f2f2)
        expect(palette.card.shadow).toEqual({ color: 0x000000, alpha: 0.55, blurStrength: 6, offsetX: 0, offsetY: 0 })
    })

    it('keeps the share button blue and the active/viewer status colors identical across themes, since they carry meaning', () => {
        const light = getPixiThemeColors('light')
        const dark = getPixiThemeColors('dark')

        expect(dark.toolbar.shareButton).toBe(light.toolbar.shareButton)
        expect(dark.toolbar.shareActiveIndicator).toBe(light.toolbar.shareActiveIndicator)
        expect(dark.toolbar.shareViewerIndicator).toBe(light.toolbar.shareViewerIndicator)
    })

    it('returns a different palette object for each theme (no shared mutable state)', () => {
        const light = getPixiThemeColors('light')
        const dark = getPixiThemeColors('dark')

        expect(light).not.toBe(dark)
    })
})
