import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { FancyButton } from '@pixi/ui'
import type { CardStateService } from '../services/CardStateService'
import { dismissOnboarding, initHistoryShortcuts } from '../utils/canvas'
import { createOnboarding } from './onboarding'
import { createSettingsModal } from './settings'
import undoIconUrl from '../assets/icons/undo-2.webp?url'
import redoIconUrl from '../assets/icons/redo-2.webp?url'
import settingsIconUrl from '../assets/icons/sliders-horizontal.webp?url'

export const TOOLBAR_ICONS = ['undo-2', 'redo-2', 'sliders-horizontal'] as const

export type ToolbarIcon = (typeof TOOLBAR_ICONS)[number]

const ICON_COLOR = 0x111111
const TITLE_COLOR = 0x3a3a3a
const BUTTON_SIZE = 48
const ICON_SIZE = 22
const ICON_SOURCE_SIZE = 64
const GAP = 8
const TOP_MARGIN = 16
const SIDE_MARGIN = 16
const LOGO_EMOJI_SIZE = 28
const DISABLED_ICON_ALPHA = 0.35

/**
 * Minimal surface of CanvasController used by the toolbar, kept small so it can
 * be stubbed in tests without instantiating the whole Pixi app.
 */
export interface ToolbarHost {
    readonly stage: Container
    readonly screenWidth: number
    readonly screenHeight: number
    readonly canUndo: boolean
    readonly canRedo: boolean
    undo(): void
    redo(): void
    resetPositions(): void
    setOnHistoryChange(callback: () => void): void
    registerOnResize(callback: () => void): void
}

export async function loadToolbarIconTextures(): Promise<Record<string, Texture>> {
    const urls: Record<ToolbarIcon, string> = {
        'undo-2': undoIconUrl,
        'redo-2': redoIconUrl,
        'sliders-horizontal': settingsIconUrl,
    }
    const textures: Record<string, Texture> = {}
    for (const name of TOOLBAR_ICONS) {
        textures[name] = await Assets.load<Texture>(urls[name])
    }
    return textures
}

function createCircleView(fill: number, alpha: number): Graphics {
    const view = new Graphics()
    view.circle(BUTTON_SIZE / 2, BUTTON_SIZE / 2, BUTTON_SIZE / 2)
    view.fill({ color: fill, alpha })
    return view
}

/**
 * Pixi-rendered toolbar: emoji/wordmark logo on the left, icon buttons on the right.
 * Replaces the previous HTML toolbar (undo/redo/help/settings).
 */
export class TopToolbar {
    private readonly host: ToolbarHost
    private readonly store: CardStateService
    private readonly container: Container
    private readonly logo: Container
    private readonly undoButton: FancyButton
    private readonly redoButton: FancyButton
    private readonly helpButton: FancyButton
    private readonly settingsButton: FancyButton
    private readonly undoIcon: Sprite
    private readonly redoIcon: Sprite

    constructor(host: ToolbarHost, store: CardStateService, iconTextures: Record<string, Texture>) {
        this.host = host
        this.store = store
        this.container = new Container()
        this.container.label = 'top-toolbar'
        this.logo = this.createLogo()
        this.undoIcon = this.createIcon(iconTextures['undo-2'])
        this.redoIcon = this.createIcon(iconTextures['redo-2'])
        this.undoButton = this.createButton(this.undoIcon, (): void => { this.doUndo() }, 'toolbar-undobutton')
        this.redoButton = this.createButton(this.redoIcon, (): void => { this.doRedo() }, 'toolbar-redobutton')
        this.helpButton = this.createButton(this.createHelpIcon(), (): void => { this.showOnboarding() }, 'toolbar-helpbutton', 1)
        this.settingsButton = this.createButton(this.createIcon(iconTextures['sliders-horizontal']), (): void => { this.openSettings() }, 'toolbar-settingsbutton')

        this.container.addChild(this.logo)
        this.container.addChild(this.undoButton)
        this.container.addChild(this.redoButton)
        this.container.addChild(this.helpButton)
        this.container.addChild(this.settingsButton)
        this.host.stage.addChild(this.container)

        initHistoryShortcuts((): void => { this.doUndo() }, (): void => { this.doRedo() })
        this.host.setOnHistoryChange((): void => { this.updateHistoryButtons() })
        this.host.registerOnResize((): void => { this.resize() })
        this.resize()
        this.updateHistoryButtons()
    }

    private createLogo(): Container {
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

    private createIcon(texture: Texture): Sprite {
        const icon = new Sprite(texture)
        icon.anchor.set(0.5)
        icon.tint = ICON_COLOR
        return icon
    }

    private createHelpIcon(): Text {
        return new Text({
            text: '?',
            style: {
                fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                fontSize: ICON_SIZE,
                fontWeight: '500',
                fill: ICON_COLOR,
            },
        })
    }

    private createButton(icon: Container, onClick: () => void, label: string, iconScale: number = ICON_SIZE / ICON_SOURCE_SIZE): FancyButton {
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
        button.onPress.connect((): void => { onClick() })
        return button
    }

    private showOnboarding(): void {
        if (document.querySelector('.onboarding-overlay') !== null) {
            return
        }
        document.body.appendChild(createOnboarding((): void => { dismissOnboarding(this.store) }))
    }

    private openSettings(): void {
        if (document.querySelector('.settings-overlay') !== null) {
            return
        }
        document.body.appendChild(createSettingsModal({
            onResetPositions: (): void => {
                this.host.resetPositions()
                this.updateHistoryButtons()
            },
        }))
    }

    private doUndo(): void {
        this.host.undo()
        this.updateHistoryButtons()
    }

    private doRedo(): void {
        this.host.redo()
        this.updateHistoryButtons()
    }

    private updateHistoryButtons(): void {
        this.setButtonEnabled(this.undoButton, this.undoIcon, this.host.canUndo)
        this.setButtonEnabled(this.redoButton, this.redoIcon, this.host.canRedo)
    }

    private setButtonEnabled(button: FancyButton, icon: Sprite, enabled: boolean): void {
        button.enabled = enabled
        icon.alpha = enabled ? 1 : DISABLED_ICON_ALPHA
    }

    /**
     * Keeps the toolbar anchored on resize: buttons pinned to the right edge,
     * logo pinned to the left edge.
     */
    resize(): void {
        const buttons = [
            this.settingsButton,
            this.helpButton,
            this.redoButton,
            this.undoButton,
        ]
        let x = this.host.screenWidth - SIDE_MARGIN - BUTTON_SIZE / 2
        for (const button of buttons) {
            button.position.set(x, TOP_MARGIN + BUTTON_SIZE / 2)
            x -= BUTTON_SIZE + GAP
        }
        this.logo.position.set(SIDE_MARGIN, TOP_MARGIN + LOGO_EMOJI_SIZE / 2)
    }
}