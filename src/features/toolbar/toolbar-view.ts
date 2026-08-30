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

export function setButtonEnabled(button: FancyButton, icon: Sprite, enabled: boolean, tooltip: CanvasTooltip): void {
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
