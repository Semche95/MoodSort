/** Single source of truth for every numeric Pixi color, read via `getPixiThemeColors(resolvedTheme)` instead of local `0x...` literals. */
export interface PixiThemePalette {
    canvasBackground: number
    backgroundDecor: {
        halo: number
        haloAlpha: number
        warmGlow: number
        warmGlowAlpha: number
        coolGlow: number
        coolGlowAlpha: number
        grain: number
        grainAlpha: number
    }
    card: {
        hoverOutline: {
            color: number
            alpha: number
            width: number
        }
        shadow: {
            color: number
            restAlpha: number
            liftAlpha: number
            liftBlurStrength: number
        }
        stackShadow: {
            color: number
            alpha: number
            blurStrength: number
        }
    }
    icon: number
    toolbar: {
        title: number
        titleAccent: number
        buttonDefault: number
        buttonHover: number
        buttonPressed: number
        buttonDisabled: number
        buttonShadow: number
        buttonShadowAlpha: number
        logoShadow: number
        logoShadowAlpha: number
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
        frame: number
        accent: number
        pill: number
        pillShadow: number
        pillShadowAlpha: number
        controlIcon: number
        controlHover: number
        labelText: number
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
