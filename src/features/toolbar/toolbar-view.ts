import { BlurFilter, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { FancyButton } from '@pixi/ui'
import type { CanvasTooltip } from '../../shared/ui/canvas-tooltip'
import { ICON_SIZE, applyIconTheme } from '../../shared/ui/icons'
import type { ResolvedTheme } from '../../types/theme.types'
import { getPixiThemeColors } from '../theme/pixi-theme-colors'
import type { PixiThemePalette } from '../../types/pixi-theme-palette.types'
import type { RoundButtonViews } from '../../types/round-button-views.types'
import type { BrandingTextures } from '../../types/branding-textures.types'

export const BUTTON_SIZE = 48
export const TOP_MARGIN = 16
/** Lowest point of the toolbar row, which UI drawn under it must clear */
export const TOOLBAR_BOTTOM: number = TOP_MARGIN + BUTTON_SIZE
export const LOGO_SIZE = 32
export const FONT_FAMILY = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
const ICON_SOURCE_SIZE = 64
const DISABLED_ICON_ALPHA = 0.35
const TOOLTIP_GAP = 8
const SHARE_ICON_GAP = 8
const SHARE_BUTTON_PADDING_X = 18
const SHARE_INDICATOR_RADIUS = 4
const SHARE_INDICATOR_GAP = 7
const SHARE_INDICATOR_STROKE_WIDTH = 1.5
const SHARE_INDICATOR_SHADOW_ALPHA = 0.4
const SHARE_INDICATOR_SHADOW_OFFSET = 1
const BUTTON_SHADOW_OFFSET_Y = 1.5
const TITLE_HEIGHT = 18
const LOGO_TITLE_GAP = 10
const LOGO_SHADOW_BLUR = 2
const LOGO_SHADOW_OFFSET_Y = 1

export function createCircleView(fill: number, alpha: number, shadow?: { color: number; alpha: number }): Graphics {
    const view = new Graphics()
    if (shadow) {
        view.circle(BUTTON_SIZE / 2, BUTTON_SIZE / 2 + BUTTON_SHADOW_OFFSET_Y, BUTTON_SIZE / 2)
        view.fill({ color: shadow.color, alpha: shadow.alpha })
    }
    view.circle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2)
    view.fill({ color: fill, alpha })
    return view
}

/** Builds the four state views shared by every round icon button, from the toolbar palette. Used both to construct a button and to re-theme one in place. */
function roundButtonViews(palette: PixiThemePalette['toolbar']): RoundButtonViews {
    const shadow = { color: palette.buttonShadow, alpha: palette.buttonShadowAlpha }
    return {
        defaultView: createCircleView(palette.buttonDefault, 0.85, shadow),
        hoverView: createCircleView(palette.buttonHover, 1, shadow),
        pressedView: createCircleView(palette.buttonPressed, 1),
        disabledView: createCircleView(palette.buttonDisabled, 0.45),
    }
}

function createTitlePart(texture: Texture, label: string, tint: number): Sprite {
    const part = new Sprite(texture)
    part.label = label
    part.anchor.set(0, 0.5)
    part.scale.set(TITLE_HEIGHT / texture.height)
    part.tint = tint
    return part
}

function createLogoSprite(logoTexture: Texture, label: string): Sprite {
    const sprite = new Sprite(logoTexture)
    sprite.label = label
    sprite.anchor.set(0, 0.5)
    sprite.width = LOGO_SIZE
    sprite.height = LOGO_SIZE
    return sprite
}

function applyLogoShadowTheme(shadow: Sprite, palette: PixiThemePalette['toolbar']): void {
    shadow.tint = palette.logoShadow
    shadow.alpha = palette.logoShadowAlpha
}

export function createLogo(textures: BrandingTextures, resolvedTheme: ResolvedTheme = 'light'): Container {
    const palette = getPixiThemeColors(resolvedTheme)
    const shadow = createLogoSprite(textures.logo, 'toolbar-logo-shadow')
    shadow.filters = [new BlurFilter({ strength: LOGO_SHADOW_BLUR })]
    shadow.y = LOGO_SHADOW_OFFSET_Y
    applyLogoShadowTheme(shadow, palette.toolbar)
    const image = createLogoSprite(textures.logo, 'toolbar-logo-image')

    const titleAccent = createTitlePart(textures.titleAccent, 'toolbar-title-accent', palette.toolbar.titleAccent)
    const titleRest = createTitlePart(textures.titleRest, 'toolbar-title-rest', palette.toolbar.title)

    const logo = new Container()
    logo.label = 'toolbar-logo'
    logo.eventMode = 'none'
    logo.addChild(shadow)
    logo.addChild(image)
    logo.addChild(titleAccent)
    logo.addChild(titleRest)
    titleAccent.x = LOGO_SIZE + LOGO_TITLE_GAP
    titleRest.x = titleAccent.x
    return logo
}

/** Re-theme an already-created round icon button in place, so a theme flip doesn't require rebuilding the toolbar. */
export function applyButtonTheme(button: FancyButton, resolvedTheme: ResolvedTheme): void {
    const palette = getPixiThemeColors(resolvedTheme).toolbar
    const views = roundButtonViews(palette)
    button.defaultView = views.defaultView
    button.hoverView = views.hoverView
    button.pressedView = views.pressedView
    button.disabledView = views.disabledView
    const icon = button.iconView
    if (icon instanceof Sprite) {
        applyIconTheme(icon, resolvedTheme)
    } else if (icon instanceof Text) {
        icon.style.fill = getPixiThemeColors(resolvedTheme).icon
    }
}

/** Re-theme the logo's shadow and both title parts in place; the image keeps its own colors. */
export function applyLogoTheme(logo: Container, resolvedTheme: ResolvedTheme): void {
    const palette = getPixiThemeColors(resolvedTheme)
    for (const child of logo.children) {
        if (child instanceof Sprite && child.label === 'toolbar-logo-shadow') {
            applyLogoShadowTheme(child, palette.toolbar)
        } else if (child instanceof Sprite && child.label === 'toolbar-title-accent') {
            child.tint = palette.toolbar.titleAccent
        } else if (child instanceof Sprite && child.label === 'toolbar-title-rest') {
            child.tint = palette.toolbar.title
        }
    }
}

export function setButtonEnabled(button: FancyButton, icon: Container, enabled: boolean, tooltip: CanvasTooltip): void {
    button.enabled = enabled
    icon.alpha = enabled ? 1 : DISABLED_ICON_ALPHA
    if (!enabled) {
        tooltip.hide()
    }
}

/** Wires the press/hover/out behavior shared by every toolbar button: run the click handler and hide the tooltip on press, show it on hover, hide it on out. */
function attachTooltipBehavior(button: FancyButton, tooltip: CanvasTooltip, onClick: () => void, tooltipLabel: string): void {
    button.accessible = true
    button.accessibleTitle = tooltipLabel
    button.onPress.connect((): void => {
        onClick()
        tooltip.hide()
    })
    button.onHover.connect((): void => {
        // Read at hover time so a label swapped later through accessibleTitle (fullscreen toggle) is shown
        tooltip.show(button.x, button.y + BUTTON_SIZE / 2 + TOOLTIP_GAP, button.accessibleTitle ?? tooltipLabel)
    })
    button.onOut.connect((): void => { tooltip.hide() })
}

export function createButton(tooltip: CanvasTooltip, icon: Container, onClick: () => void, label: string, tooltipLabel: string, iconScale: number = ICON_SIZE / ICON_SOURCE_SIZE, resolvedTheme: ResolvedTheme = 'light'): FancyButton {
    const palette = getPixiThemeColors(resolvedTheme).toolbar
    const button = new FancyButton({
        ...roundButtonViews(palette),
        icon,
        anchor: 0.5,
        defaultIconScale: iconScale,
        animations: {
            hover: { props: { scale: { x: 1.06, y: 1.06 } }, duration: 90 },
            pressed: { props: { scale: { x: 0.94, y: 0.94 } }, duration: 90 },
        },
    })
    button.label = label
    attachTooltipBehavior(button, tooltip, onClick, tooltipLabel)
    return button
}

function createPillView(fill: number, width: number): Graphics {
    const view = new Graphics()
    view.roundRect(0, 0, width, BUTTON_SIZE, BUTTON_SIZE / 2)
    view.fill({ color: fill, alpha: 1 })
    return view
}

/** Builds the four pill-shaped state views shared by the share button, from the toolbar palette. Used both to construct the button and to re-theme it in place. */
function shareButtonViews(palette: PixiThemePalette['toolbar'], buttonWidth: number): RoundButtonViews {
    return {
        defaultView: createPillView(palette.shareButton, buttonWidth),
        hoverView: createPillView(palette.shareButtonHover, buttonWidth),
        pressedView: createPillView(palette.shareButtonPressed, buttonWidth),
        disabledView: createPillView(palette.shareButtonDisabled, buttonWidth),
    }
}

// Pill-shaped accent CTA button (icon + share label), reading as the primary action.
// Two dots over its top-right corner: amber when sharing is active, green once a viewer is connected.
export function setShareIndicators(activeIndicator: Graphics, viewerIndicator: Graphics, status: 'inactive' | 'waiting' | 'connected' | 'stopped'): void {
    activeIndicator.visible = status === 'waiting' || status === 'connected'
    viewerIndicator.visible = status === 'connected'
}

function redrawShareIndicatorDot(dot: Graphics, color: number, resolvedTheme: ResolvedTheme): void {
    const palette = getPixiThemeColors(resolvedTheme).toolbar
    dot.clear()
    dot.circle(SHARE_INDICATOR_SHADOW_OFFSET, SHARE_INDICATOR_SHADOW_OFFSET, SHARE_INDICATOR_RADIUS)
    dot.fill({ color: palette.shareIndicatorShadow, alpha: SHARE_INDICATOR_SHADOW_ALPHA })
    dot.circle(0, 0, SHARE_INDICATOR_RADIUS)
    dot.fill({ color })
    dot.stroke({ width: SHARE_INDICATOR_STROKE_WIDTH, color: palette.shareIndicatorStroke })
}

/** A small dot with a soft shadow, used to flag share-button status (active / has a viewer) at a given x offset from the pill's center-top. */
function createShareIndicatorDot(label: string, color: number, x: number, resolvedTheme: ResolvedTheme): Graphics {
    const dot = new Graphics()
    dot.label = label
    redrawShareIndicatorDot(dot, color, resolvedTheme)
    dot.position.set(x, -BUTTON_SIZE / 2 + SHARE_INDICATOR_RADIUS + 2)
    dot.visible = false
    return dot
}

export function createShareButton(tooltip: CanvasTooltip, icon: Sprite, onClick: () => void, tooltipLabel: string, buttonLabel: string, resolvedTheme: ResolvedTheme = 'light'): { button: FancyButton; content: Container; activeIndicator: Graphics; viewerIndicator: Graphics } {
    const palette = getPixiThemeColors(resolvedTheme).toolbar
    icon.scale.set(ICON_SIZE / ICON_SOURCE_SIZE)
    icon.tint = palette.shareLabel

    const label = new Text({
        text: buttonLabel,
        style: {
            fontFamily: FONT_FAMILY,
            fontSize: 15,
            fontWeight: '600',
            fill: palette.shareLabel,
        },
    })
    label.label = 'toolbar-share-label'

    // Anchoring icon/label at their own centers would offset FancyButton's pivot calculation
    // (derived from width/height alone) and push the group off-center. Top-left anchoring
    // within a shared top-aligned band keeps bounds starting at 0 while still centering them.
    const contentHeight = Math.max(icon.height, label.height)
    icon.anchor.set(0, 0)
    icon.position.set(0, (contentHeight - icon.height) / 2)
    label.anchor.set(0, 0)
    label.position.set(ICON_SIZE + SHARE_ICON_GAP, (contentHeight - label.height) / 2)

    const content = new Container()
    content.label = 'toolbar-share-content'
    content.addChild(icon, label)

    const buttonWidth = ICON_SIZE + SHARE_ICON_GAP + label.width + SHARE_BUTTON_PADDING_X * 2

    const button = new FancyButton({
        ...shareButtonViews(palette, buttonWidth),
        icon: content,
        anchor: 0.5,
        animations: {
            hover: { props: { scale: { x: 1.03, y: 1.03 } }, duration: 90 },
            pressed: { props: { scale: { x: 0.97, y: 0.97 } }, duration: 90 },
        },
    })
    button.label = 'toolbar-sharebutton'
    attachTooltipBehavior(button, tooltip, onClick, tooltipLabel)

    // Added to `innerView` (not the button's root container) since that's where FancyButton
    // shifts the actual visuals to; adding indicators to the root would offset them off the pill.
    const viewerIndicator = createShareIndicatorDot('toolbar-share-viewer-indicator', palette.shareViewerIndicator, buttonWidth / 2 - SHARE_INDICATOR_RADIUS - 2, resolvedTheme)
    button.innerView.addChild(viewerIndicator)

    const activeIndicator = createShareIndicatorDot('toolbar-share-active-indicator', palette.shareActiveIndicator, buttonWidth / 2 - SHARE_INDICATOR_RADIUS * 3 - SHARE_INDICATOR_GAP - 2, resolvedTheme)
    button.innerView.addChild(activeIndicator)

    return { button, content, activeIndicator, viewerIndicator }
}

/** Re-theme an already-created share button (pill views, icon/label tint, status dots) in place. */
export function applyShareButtonTheme(button: FancyButton, content: Container, activeIndicator: Graphics, viewerIndicator: Graphics, resolvedTheme: ResolvedTheme): void {
    const palette = getPixiThemeColors(resolvedTheme).toolbar
    const buttonWidth = button.width
    const views = shareButtonViews(palette, buttonWidth)
    button.defaultView = views.defaultView
    button.hoverView = views.hoverView
    button.pressedView = views.pressedView
    button.disabledView = views.disabledView

    const icon = content.children.find((child: Container): boolean => child instanceof Sprite) as Sprite | undefined
    const label = content.children.find((child: Container): boolean => child instanceof Text) as Text | undefined
    if (icon) {
        icon.tint = palette.shareLabel
    }
    if (label) {
        label.style.fill = palette.shareLabel
    }

    redrawShareIndicatorDot(activeIndicator, palette.shareActiveIndicator, resolvedTheme)
    redrawShareIndicatorDot(viewerIndicator, palette.shareViewerIndicator, resolvedTheme)
}
