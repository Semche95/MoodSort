import type { GetResolvedTheme, ResolvedTheme } from '../../types/theme.types'
import type { PixiThemePalette } from '../../types/pixi-theme-palette.types'

const LIGHT_PIXI_THEME_COLORS: PixiThemePalette = {
    canvasBackground: 0xcdbfad,
    backgroundDecor: {
        halo: 0xffffff,
        haloAlpha: 0.12,
        warmGlow: 0xf4a480,
        warmGlowAlpha: 0.2,
        coolGlow: 0x8cd2b4,
        coolGlowAlpha: 0.2,
        grain: 0x806650,
        grainAlpha: 0.09,
    },
    card: {
        hoverOutline: {
            color: 0xb4462c,
            alpha: 0.9,
            width: 2,
        },
        shadow: {
            color: 0x4f342a,
            restAlpha: 0.35,
            liftAlpha: 0.28,
            liftBlurStrength: 10,
        },
    },
    icon: 0x6b4a3d,
    toolbar: {
        title: 0x4f342a,
        titleAccent: 0xb4462c,
        buttonDefault: 0xffffff,
        buttonHover: 0xfffaf5,
        buttonPressed: 0xf0e4d8,
        buttonDisabled: 0xffffff,
        buttonShadow: 0x785040,
        buttonShadowAlpha: 0.18,
        logoShadow: 0x4f342a,
        logoShadowAlpha: 0.7,
        shareButton: 0xb4462c,
        shareButtonHover: 0xbf5236,
        shareButtonPressed: 0x9c3a24,
        shareButtonDisabled: 0xf3bba9,
        shareLabel: 0xffffff,
        shareActiveIndicator: 0xf59e0b,
        shareViewerIndicator: 0x22c55e,
        shareIndicatorStroke: 0xffffff,
        shareIndicatorShadow: 0x0f172a,
    },
    stackOverlay: {
        border: 0x333333,
        handle: 0x444444,
        controlIcon: 0xaaaaaa,
        mergeDim: 0x000000,
        mergePlus: 0x333333,
        labelText: 0xffffff,
        labelStroke: 0x000000,
    },
    stackNameEditor: {
        background: 0x222222,
        text: 0xffffff,
        border: 0x6699ff,
        clearButton: 0x444444,
        clearIcon: 0xdddddd,
    },
    tooltip: {
        background: 0x111111,
        text: 0xffffff,
    },
}

const DARK_PIXI_THEME_COLORS: PixiThemePalette = {
    canvasBackground: 0x24202a,
    backgroundDecor: {
        halo: 0xffffff,
        haloAlpha: 0.05,
        warmGlow: 0xe8785a,
        warmGlowAlpha: 0.12,
        coolGlow: 0x6eaa96,
        coolGlowAlpha: 0.1,
        grain: 0x000000,
        grainAlpha: 0.12,
    },
    card: {
        hoverOutline: {
            color: 0xe9775a,
            alpha: 0.9,
            width: 2,
        },
        shadow: {
            color: 0x000000,
            restAlpha: 0.6,
            liftAlpha: 0.5,
            liftBlurStrength: 12,
        },
    },
    icon: 0xf3dccb,
    toolbar: {
        title: 0xf3dccb,
        titleAccent: 0xe9775a,
        buttonDefault: 0x4a4350,
        buttonHover: 0x564e5d,
        buttonPressed: 0x352f3a,
        buttonDisabled: 0x4a4350,
        buttonShadow: 0x000000,
        buttonShadowAlpha: 0.4,
        logoShadow: 0x000000,
        logoShadowAlpha: 0.4,
        shareButton: 0xb4462c,
        shareButtonHover: 0xbf5236,
        shareButtonPressed: 0x9c3a24,
        shareButtonDisabled: 0x7a4436,
        shareLabel: 0xffffff,
        shareActiveIndicator: 0xf59e0b,
        shareViewerIndicator: 0x22c55e,
        shareIndicatorStroke: 0x1a1a1a,
        shareIndicatorShadow: 0x000000,
    },
    stackOverlay: {
        border: 0xcccccc,
        handle: 0x888888,
        controlIcon: 0xdddddd,
        mergeDim: 0x000000,
        mergePlus: 0xdddddd,
        labelText: 0xffffff,
        labelStroke: 0x000000,
    },
    stackNameEditor: {
        background: 0x3a3a3a,
        text: 0xffffff,
        border: 0x88aaff,
        clearButton: 0x666666,
        clearIcon: 0xeeeeee,
    },
    tooltip: {
        background: 0x2a2a2a,
        text: 0xffffff,
    },
}

/** Looks up the full Pixi color palette for a resolved (non-`'auto'`) theme. */
export function getPixiThemeColors(resolvedTheme: ResolvedTheme): PixiThemePalette {
    return resolvedTheme === 'dark' ? DARK_PIXI_THEME_COLORS : LIGHT_PIXI_THEME_COLORS
}

/** Shared fallback for constructors that accept an optional `GetResolvedTheme`, so a standalone instance (e.g. in a test) still renders with a sensible palette. */
export const DEFAULT_GET_RESOLVED_THEME: GetResolvedTheme = (): ResolvedTheme => 'light'
