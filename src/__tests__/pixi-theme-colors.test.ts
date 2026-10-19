import { describe, expect, it } from 'vitest'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'

function relativeLuminance(color: number): number {
    const [r, g, b] = [16, 8, 0].map((shift: number): number => {
        const channel = ((color >> shift) & 0xff) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: number, b: number): number {
    const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x: number, y: number): number => y - x)
    return (lighter + 0.05) / (darker + 0.05)
}

describe('getPixiThemeColors', () => {
    it('returns the light palette for "light"', () => {
        const palette = getPixiThemeColors('light')

        expect(palette.canvasBackground).toBe(0xcdbfad)
        expect(palette.card.hoverOutline).toEqual({ color: 0xb4462c, alpha: 0.9, width: 2 })
        expect(palette.icon).toBe(0x6b4a3d)
        expect(palette.card.shadow).toEqual({ color: 0x4f342a, restAlpha: 0.35, liftAlpha: 0.28, liftBlurStrength: 10 })
        expect(palette.card.stackShadow).toEqual({ color: 0x4f342a, alpha: 0.35, blurStrength: 12 })
    })

    it('returns the dark palette for "dark"', () => {
        const palette = getPixiThemeColors('dark')

        expect(palette.canvasBackground).toBe(0x24202a)
        expect(palette.card.hoverOutline).toEqual({ color: 0xe9775a, alpha: 0.9, width: 2 })
        expect(palette.icon).toBe(0xf3dccb)
        expect(palette.card.shadow).toEqual({ color: 0x000000, restAlpha: 0.6, liftAlpha: 0.5, liftBlurStrength: 12 })
        expect(palette.card.stackShadow).toEqual({ color: 0x000000, alpha: 0.6, blurStrength: 14 })
    })

    it('keeps the share button and the active/viewer status colors identical across themes, since they carry meaning', () => {
        const light = getPixiThemeColors('light')
        const dark = getPixiThemeColors('dark')

        expect(dark.toolbar.shareButton).toBe(light.toolbar.shareButton)
        expect(dark.toolbar.shareActiveIndicator).toBe(light.toolbar.shareActiveIndicator)
        expect(dark.toolbar.shareViewerIndicator).toBe(light.toolbar.shareViewerIndicator)
    })

    it.each(['light', 'dark'] as const)('keeps the share label readable (WCAG AA, 4.5:1) on every enabled share button state in the %s theme', (theme: 'light' | 'dark') => {
        const { toolbar } = getPixiThemeColors(theme)

        for (const fill of [toolbar.shareButton, toolbar.shareButtonHover, toolbar.shareButtonPressed]) {
            expect(contrastRatio(toolbar.shareLabel, fill)).toBeGreaterThanOrEqual(4.5)
        }
    })

    it.each(['light', 'dark'] as const)('sets the title accent apart from the backdrop (3:1 for large bold text) and from the rest of the title in the %s theme', (theme: 'light' | 'dark') => {
        const palette = getPixiThemeColors(theme)

        expect(contrastRatio(palette.toolbar.titleAccent, palette.canvasBackground)).toBeGreaterThanOrEqual(3)
        expect(palette.toolbar.titleAccent).not.toBe(palette.toolbar.title)
    })

    it('reuses the share button color as the title accent in the light theme, so the brand accent stays a single color', () => {
        const { toolbar } = getPixiThemeColors('light')

        expect(toolbar.titleAccent).toBe(toolbar.shareButton)
    })

    it('returns a different palette object for each theme (no shared mutable state)', () => {
        const light = getPixiThemeColors('light')
        const dark = getPixiThemeColors('dark')

        expect(light).not.toBe(dark)
    })
})
