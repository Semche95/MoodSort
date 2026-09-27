/** Single source of truth for every numeric Pixi color, read via `getPixiThemeColors(resolvedTheme)` instead of local `0x...` literals. */
export interface PixiThemePalette {
    canvasBackground: number
    card: {
        hoverTint: number
        shadow: {
            color: number
            alpha: number
            blurStrength: number
            offsetX: number
            offsetY: number
        }
    }
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
