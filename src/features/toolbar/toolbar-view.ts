import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { FancyButton } from '@pixi/ui'
import type { CanvasTooltip } from '../../shared/ui/canvas-tooltip'
import { ICON_SIZE, applyIconTheme } from '../../shared/ui/icons'
import type { ResolvedTheme } from '../../types/theme.types'
import { getPixiThemeColors } from '../theme/pixi-theme-colors'
import type { PixiThemePalette } from '../../types/pixi-theme-palette.types'
import type { RoundButtonViews } from '../../types/round-button-views.types'

export const BUTTON_SIZE = 48
export const LOGO_EMOJI_SIZE = 28
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

export function createCircleView(fill: number, alpha: number): Graphics {
    const view = new Graphics()
    view.circle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2)
    view.fill({ color: fill, alpha })
    return view
}

/** Builds the four state views shared by every round icon button, from the toolbar palette. Used both to construct a button and to re-theme one in place. */
function roundButtonViews(palette: PixiThemePalette['toolbar']): RoundButtonViews {
    return {
        defaultView: createCircleView(palette.buttonDefault, 0.85),
        hoverView: createCircleView(palette.buttonHover, 1),
        pressedView: createCircleView(palette.buttonPressed, 1),
        disabledView: createCircleView(palette.buttonDisabled, 0.45),
    }
}

export function createLogo(resolvedTheme: ResolvedTheme = 'light'): Container {
    const palette = getPixiThemeColors(resolvedTheme)
    const emoji = new Text({
        text: '🎭',
        style: {
            fontFamily: FONT_FAMILY,
            fontSize: LOGO_EMOJI_SIZE,
            fill: palette.icon,
        },
    })
    emoji.label = 'toolbar-logo-emoji'
    emoji.anchor.set(0, 0.5)

    const title = new Text({
        text: 'MoodSort',
        style: {
            fontFamily: FONT_FAMILY,
            fontSize: 20,
            fontWeight: '700',
            fill: palette.toolbar.title,
        },
    })
    title.label = 'toolbar-title'
    title.anchor.set(0, 0.5)

    const logo = new Container()
    logo.label = 'toolbar-logo'
    logo.addChild(emoji)
    logo.addChild(title)
    title.position.set(LOGO_EMOJI_SIZE + 10, 0)
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

/** Re-theme the logo's emoji and title text in place. */
export function applyLogoTheme(logo: Container, resolvedTheme: ResolvedTheme): void {
    const palette = getPixiThemeColors(resolvedTheme)
    for (const child of logo.children) {
        if (child instanceof Text && child.label === 'toolbar-logo-emoji') {
            child.style.fill = palette.icon
        } else if (child instanceof Text && child.label === 'toolbar-title') {
            child.style.fill = palette.toolbar.title
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

// Pill-shaped blue CTA button (icon + share label), reading as the primary action.
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
