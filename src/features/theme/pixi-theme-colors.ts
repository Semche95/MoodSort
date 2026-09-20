import type { ResolvedTheme } from '../../types/theme.types'

/**
 * Every numeric Pixi color used to draw the scene (cards, toolbar, stack
 * overlay, name editor, tooltip, canvas background), grouped by the feature
 * that owns it. This is the single source of truth: no controller should
 * keep its own `0x...` literal or locally-named color constant anymore,
 * they all read through `getPixiThemeColors(resolvedTheme)` instead.
 *
 * The share button's blue and the amber/green status dots are intentionally
 * identical across both themes: they carry meaning (brand action, "sharing
 * active", "viewer connected") that graying out in dark mode would blur.
 */
export interface PixiThemePalette {
    /** Flat fill passed to `app.init({ backgroundColor })`; the closest thing to a canvas "background" in this app. */
    canvasBackground: number
    card: {
        /** Sprite tint applied on card hover. */
        hoverTint: number
        /** Drop-shadow fill behind a card; kept identical across themes since a soft shadow reads the same regardless of background. */
        shadow: number
    }
    /** Shared by toolbar icons and the help "?" glyph. */
    icon: number
    toolbar: {
        title: number
        buttonDefault: number
        buttonHover: number
        buttonPressed: number
        buttonDisabled: number
        shareButton: number
        shareButtonHover: number
        shareButtonPressed: number
        shareButtonDisabled: number
        shareLabel: number
        shareActiveIndicator: number
        shareViewerIndicator: number
        shareIndicatorStroke: number
        shareIndicatorShadow: number
    }
    stackOverlay: {
        border: number
        handle: number
        controlIcon: number
        mergeDim: number
        mergePlus: number
        labelText: number
        labelStroke: number
    }
    stackNameEditor: {
        background: number
        text: number
        border: number
        clearButton: number
        clearIcon: number
    }
    tooltip: {
        background: number
        text: number
    }
}

const LIGHT_PIXI_THEME_COLORS: PixiThemePalette = {
    canvasBackground: 0xa9a9a9,
    card: {
        hoverTint: 0xffeedd,
        shadow: 0x000000,
    },
    icon: 0x111111,
    toolbar: {
        title: 0x3a3a3a,
        buttonDefault: 0xffffff,
        buttonHover: 0xffffff,
        buttonPressed: 0xe1e1e1,
        buttonDisabled: 0xffffff,
        shareButton: 0x2563eb,
        shareButtonHover: 0x1d4ed8,
        shareButtonPressed: 0x1e40af,
        shareButtonDisabled: 0x93c5fd,
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
    canvasBackground: 0x1e1e1e,
    card: {
        hoverTint: 0xffd9a8,
        shadow: 0x000000,
    },
    icon: 0xf2f2f2,
    toolbar: {
        title: 0xf0f0f0,
        buttonDefault: 0x76767f,
        buttonHover: 0x82828c,
        buttonPressed: 0x44444c,
        buttonDisabled: 0x76767f,
        shareButton: 0x2563eb,
        shareButtonHover: 0x1d4ed8,
        shareButtonPressed: 0x1e40af,
        shareButtonDisabled: 0x1e3a8a,
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
