import type { GetResolvedTheme, ResolvedTheme } from '../../types/theme.types'
import type { PixiThemePalette } from '../../types/pixi-theme-palette.types'

const LIGHT_ICON = 0x6b4a3d

const LIGHT_TOOLBAR: PixiThemePalette['toolbar'] = {
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
}

const DARK_ICON = 0xf3dccb

const DARK_TOOLBAR: PixiThemePalette['toolbar'] = {
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
}

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
        stackShadow: {
            color: 0x4f342a,
            alpha: 0.35,
            blurStrength: 12,
        },
    },
    icon: LIGHT_ICON,
    toolbar: LIGHT_TOOLBAR,
    stackOverlay: {
        frame: 0x5b3f34,
        accent: LIGHT_TOOLBAR.titleAccent,
        pill: LIGHT_TOOLBAR.buttonDefault,
        pillShadow: LIGHT_TOOLBAR.buttonShadow,
        pillShadowAlpha: LIGHT_TOOLBAR.buttonShadowAlpha,
        controlIcon: LIGHT_ICON,
        controlHover: LIGHT_TOOLBAR.buttonPressed,
        labelText: LIGHT_TOOLBAR.title,
    },
    stackNameEditor: {
        background: LIGHT_TOOLBAR.buttonDefault,
        text: LIGHT_TOOLBAR.title,
        border: LIGHT_TOOLBAR.titleAccent,
        clearButton: LIGHT_TOOLBAR.buttonPressed,
        clearIcon: LIGHT_ICON,
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
        stackShadow: {
            color: 0x000000,
            alpha: 0.6,
            blurStrength: 14,
        },
    },
    icon: DARK_ICON,
    toolbar: DARK_TOOLBAR,
    stackOverlay: {
        frame: DARK_ICON,
        accent: DARK_TOOLBAR.titleAccent,
        pill: DARK_TOOLBAR.buttonDefault,
        pillShadow: DARK_TOOLBAR.buttonShadow,
        pillShadowAlpha: DARK_TOOLBAR.buttonShadowAlpha,
        controlIcon: DARK_ICON,
        controlHover: DARK_TOOLBAR.buttonPressed,
        labelText: DARK_TOOLBAR.title,
    },
    stackNameEditor: {
        background: DARK_TOOLBAR.buttonDefault,
        text: DARK_TOOLBAR.title,
        border: DARK_TOOLBAR.titleAccent,
        clearButton: DARK_TOOLBAR.buttonPressed,
        clearIcon: DARK_ICON,
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
