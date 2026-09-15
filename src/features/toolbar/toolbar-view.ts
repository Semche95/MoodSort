import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { FancyButton } from '@pixi/ui'
import type { CanvasTooltip } from '../../shared/ui/canvas-tooltip'
import { ICON_COLOR, ICON_SIZE } from '../../shared/ui/icons'

export const BUTTON_SIZE = 48
export const LOGO_EMOJI_SIZE = 28
const ICON_SOURCE_SIZE = 64
const TITLE_COLOR = 0x3a3a3a
const DISABLED_ICON_ALPHA = 0.35
const TOOLTIP_GAP = 8
const SHARE_BUTTON_COLOR = 0x2563eb
const SHARE_BUTTON_HOVER_COLOR = 0x1d4ed8
const SHARE_BUTTON_PRESSED_COLOR = 0x1e40af
const SHARE_BUTTON_DISABLED_COLOR = 0x93c5fd
const SHARE_LABEL_COLOR = 0xffffff
const SHARE_ICON_GAP = 8
const SHARE_BUTTON_PADDING_X = 18
const SHARE_INDICATOR_RADIUS = 4
const SHARE_INDICATOR_GAP = 7
const SHARE_ACTIVE_INDICATOR_COLOR = 0xf59e0b
const SHARE_VIEWER_INDICATOR_COLOR = 0x22c55e
const SHARE_INDICATOR_STROKE_COLOR = 0xffffff
const SHARE_INDICATOR_STROKE_WIDTH = 1.5
const SHARE_INDICATOR_SHADOW_COLOR = 0x0f172a
const SHARE_INDICATOR_SHADOW_ALPHA = 0.4
const SHARE_INDICATOR_SHADOW_OFFSET = 1

export function createCircleView(fill: number, alpha: number): Graphics {
    const view = new Graphics()
    view.circle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2)
    view.fill({ color: fill, alpha })
    return view
}

export function createLogo(): Container {
    const emoji = new Text({
        text: '🎭',
        style: {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            fontSize: LOGO_EMOJI_SIZE,
            fill: ICON_COLOR,
        },
    })
    emoji.label = 'toolbar-logo-emoji'
    emoji.anchor.set(0, 0.5)

    const title = new Text({
        text: 'MoodSort',
        style: {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            fontSize: 20,
            fontWeight: '700',
            fill: TITLE_COLOR,
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

export function setButtonEnabled(button: FancyButton, icon: Container, enabled: boolean, tooltip: CanvasTooltip): void {
    button.enabled = enabled
    icon.alpha = enabled ? 1 : DISABLED_ICON_ALPHA
    if (!enabled) {
        tooltip.hide()
    }
}

export function createButton(tooltip: CanvasTooltip, icon: Container, onClick: () => void, label: string, tooltipLabel: string, iconScale: number = ICON_SIZE / ICON_SOURCE_SIZE): FancyButton {
    const button = new FancyButton({
        defaultView: createCircleView(0xffffff, 0.85),
        hoverView: createCircleView(0xffffff, 1),
        pressedView: createCircleView(0xe1e1e1, 1),
        disabledView: createCircleView(0xffffff, 0.45),
        icon,
        anchor: 0.5,
        defaultIconScale: iconScale,
        animations: {
            hover: { props: { scale: { x: 1.06, y: 1.06 } }, duration: 90 },
            pressed: { props: { scale: { x: 0.94, y: 0.94 } }, duration: 90 },
        },
    })
    button.label = label
    button.onPress.connect((): void => {
        onClick()
        tooltip.hide()
    })
    button.onHover.connect((): void => {
        tooltip.show(button.x, button.y + BUTTON_SIZE / 2 + TOOLTIP_GAP, tooltipLabel)
    })
    button.onOut.connect((): void => { tooltip.hide() })
    return button
}

function createPillView(fill: number, width: number): Graphics {
    const view = new Graphics()
    view.roundRect(0, 0, width, BUTTON_SIZE, BUTTON_SIZE / 2)
    view.fill({ color: fill, alpha: 1 })
    return view
}

// Pill-shaped blue CTA button (icon + "Partager" label), reading as the primary action.
// Two dots over its top-right corner: amber when sharing is active, green once a viewer is connected.
export function setShareIndicators(activeIndicator: Graphics, viewerIndicator: Graphics, status: 'inactive' | 'waiting' | 'connected' | 'stopped'): void {
    activeIndicator.visible = status === 'waiting' || status === 'connected'
    viewerIndicator.visible = status === 'connected'
}

export function createShareButton(tooltip: CanvasTooltip, icon: Sprite, onClick: () => void, tooltipLabel: string): { button: FancyButton; content: Container; activeIndicator: Graphics; viewerIndicator: Graphics } {
    icon.scale.set(ICON_SIZE / ICON_SOURCE_SIZE)
    icon.tint = SHARE_LABEL_COLOR

    const label = new Text({
        text: 'Partager',
        style: {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            fontSize: 15,
            fontWeight: '600',
            fill: SHARE_LABEL_COLOR,
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
        defaultView: createPillView(SHARE_BUTTON_COLOR, buttonWidth),
        hoverView: createPillView(SHARE_BUTTON_HOVER_COLOR, buttonWidth),
        pressedView: createPillView(SHARE_BUTTON_PRESSED_COLOR, buttonWidth),
        disabledView: createPillView(SHARE_BUTTON_DISABLED_COLOR, buttonWidth),
        icon: content,
        anchor: 0.5,
        animations: {
            hover: { props: { scale: { x: 1.03, y: 1.03 } }, duration: 90 },
            pressed: { props: { scale: { x: 0.97, y: 0.97 } }, duration: 90 },
        },
    })
    button.label = 'toolbar-sharebutton'
    button.onPress.connect((): void => {
        onClick()
        tooltip.hide()
    })
    button.onHover.connect((): void => {
        tooltip.show(button.x, button.y + BUTTON_SIZE / 2 + TOOLTIP_GAP, tooltipLabel)
    })
    button.onOut.connect((): void => { tooltip.hide() })

    // Added to `innerView` (not the button's root container) since that's where FancyButton
    // shifts the actual visuals to; adding indicators to the root would offset them off the pill.
    const viewerIndicator = new Graphics()
    viewerIndicator.label = 'toolbar-share-viewer-indicator'
    viewerIndicator.circle(SHARE_INDICATOR_SHADOW_OFFSET, SHARE_INDICATOR_SHADOW_OFFSET, SHARE_INDICATOR_RADIUS)
    viewerIndicator.fill({ color: SHARE_INDICATOR_SHADOW_COLOR, alpha: SHARE_INDICATOR_SHADOW_ALPHA })
    viewerIndicator.circle(0, 0, SHARE_INDICATOR_RADIUS)
    viewerIndicator.fill({ color: SHARE_VIEWER_INDICATOR_COLOR })
    viewerIndicator.stroke({ width: SHARE_INDICATOR_STROKE_WIDTH, color: SHARE_INDICATOR_STROKE_COLOR })
    viewerIndicator.position.set(buttonWidth / 2 - SHARE_INDICATOR_RADIUS - 2, -BUTTON_SIZE / 2 + SHARE_INDICATOR_RADIUS + 2)
    viewerIndicator.visible = false
    button.innerView.addChild(viewerIndicator)

    const activeIndicator = new Graphics()
    activeIndicator.label = 'toolbar-share-active-indicator'
    activeIndicator.circle(SHARE_INDICATOR_SHADOW_OFFSET, SHARE_INDICATOR_SHADOW_OFFSET, SHARE_INDICATOR_RADIUS)
    activeIndicator.fill({ color: SHARE_INDICATOR_SHADOW_COLOR, alpha: SHARE_INDICATOR_SHADOW_ALPHA })
    activeIndicator.circle(0, 0, SHARE_INDICATOR_RADIUS)
    activeIndicator.fill({ color: SHARE_ACTIVE_INDICATOR_COLOR })
    activeIndicator.stroke({ width: SHARE_INDICATOR_STROKE_WIDTH, color: SHARE_INDICATOR_STROKE_COLOR })
    activeIndicator.position.set(buttonWidth / 2 - SHARE_INDICATOR_RADIUS * 3 - SHARE_INDICATOR_GAP - 2, -BUTTON_SIZE / 2 + SHARE_INDICATOR_RADIUS + 2)
    activeIndicator.visible = false
    button.innerView.addChild(activeIndicator)

    return { button, content, activeIndicator, viewerIndicator }
}
