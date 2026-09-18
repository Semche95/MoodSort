import { Container, Texture } from 'pixi.js'
import type { ToolbarHost } from '../../types/toolbar.types'
import { initHistoryShortcuts } from '../history/history'
import { CanvasTooltip } from '../../shared/ui/canvas-tooltip'
import { createOnboarding } from '../onboarding/onboarding'
import { createSettingsModal } from '../settings/settings'
import { createScreenShareModal } from '../screen-share/screen-share-modal'
import { isScreenShareHostSupported } from '../screen-share/compat'
import { resumeSharingIfWasActive, subscribeToSharing } from '../screen-share/screen-share-session'
import type { SharingState } from '../../types/screen-share.types'
import { createHelpIcon, createIcon } from '../../shared/ui/icons'
import { I18n, switchLocale } from '../../i18n/I18n'
import type { Locale } from '../../i18n/i18n.types'
import { createLocaleMenu } from './locale-menu'
import type { LocaleMenu } from './locale-menu'
import { BUTTON_SIZE, LOGO_EMOJI_SIZE, createButton, createLogo, createShareButton, setButtonEnabled, setShareIndicators } from './toolbar-view'

const GAP = 8
const TOP_MARGIN = 16
const SIDE_MARGIN = 16

/**
 * Plain data bag standing in for what would otherwise be a toolbar instance's
 * fields. Built in two steps by `createToolbarState` (buttons are created after
 * the state variable exists, then assigned onto it) so their click handlers can
 * close over the same object and see the final button references.
 */
type ToolbarState = {
    host: ToolbarHost
    tooltip: CanvasTooltip
    logo: Container
    undoIcon: ReturnType<typeof createIcon>
    redoIcon: ReturnType<typeof createIcon>
    shareIcon: Container
    shareActiveIndicator: ReturnType<typeof createShareButton>['activeIndicator']
    shareViewerIndicator: ReturnType<typeof createShareButton>['viewerIndicator']
    undoButton: ReturnType<typeof createButton>
    redoButton: ReturnType<typeof createButton>
    helpButton: ReturnType<typeof createButton>
    settingsButton: ReturnType<typeof createButton>
    localeMenu: LocaleMenu
    shareButton: ReturnType<typeof createShareButton>['button']
    onDismissOnboarding: () => void
}

function createToolbarState(host: ToolbarHost, onDismissOnboarding: () => void, iconTextures: Record<string, Texture>): ToolbarState {
    const tooltip = new CanvasTooltip()
    const logo = createLogo()
    const undoIcon = createIcon(iconTextures['undo-2'])
    const redoIcon = createIcon(iconTextures['redo-2'])
    const shareSupported = isScreenShareHostSupported()

    const state = { host, tooltip, logo, undoIcon, redoIcon, onDismissOnboarding } as ToolbarState

    state.undoButton = createButton(tooltip, undoIcon, (): void => doUndo(state), 'toolbar-undobutton', I18n.t('toolbar.undo'))
    state.redoButton = createButton(tooltip, redoIcon, (): void => doRedo(state), 'toolbar-redobutton', I18n.t('toolbar.redo'))
    state.helpButton = createButton(tooltip, createHelpIcon(), (): void => showOnboarding(state), 'toolbar-helpbutton', I18n.t('toolbar.help'), 1)
    state.settingsButton = createButton(tooltip, createIcon(iconTextures['sliders-horizontal']), (): void => openSettings(state), 'toolbar-settingsbutton', I18n.t('toolbar.settings'))

    const share = createShareButton(
        tooltip,
        createIcon(iconTextures['screen-share']),
        (): void => openScreenShare(state),
        shareSupported ? I18n.t('toolbar.shareTooltip') : I18n.t('toolbar.shareTooltipUnsupported'),
        I18n.t('toolbar.share'),
    )
    state.shareButton = share.button
    state.shareIcon = share.content
    state.shareActiveIndicator = share.activeIndicator
    state.shareViewerIndicator = share.viewerIndicator
    setButtonEnabled(state.shareButton, state.shareIcon, shareSupported, tooltip)

    state.localeMenu = createLocaleMenu(tooltip, iconTextures.globe, I18n.getLocale(), (locale: Locale): void => switchLocale(locale))

    if (shareSupported) {
        subscribeToSharing(host.canvasElement, (sharing: SharingState): void => {
            setShareIndicators(state.shareActiveIndicator, state.shareViewerIndicator, sharing.status)
        })
        setShareIndicators(state.shareActiveIndicator, state.shareViewerIndicator, 'inactive')
        resumeSharingIfWasActive(host.canvasElement)
    }

    return state
}

function updateHistoryButtons(state: ToolbarState): void {
    setButtonEnabled(state.undoButton, state.undoIcon, state.host.canUndo, state.tooltip)
    setButtonEnabled(state.redoButton, state.redoIcon, state.host.canRedo, state.tooltip)
}

function doUndo(state: ToolbarState): void {
    state.host.undo()
    updateHistoryButtons(state)
}

function doRedo(state: ToolbarState): void {
    state.host.redo()
    updateHistoryButtons(state)
}

function showOnboarding(state: ToolbarState): void {
    if (document.querySelector('.onboarding-overlay') !== null) {
        return
    }
    document.body.appendChild(createOnboarding(state.onDismissOnboarding))
}

function openSettings(state: ToolbarState): void {
    if (document.querySelector('.settings-overlay') !== null) {
        return
    }
    document.body.appendChild(createSettingsModal({
        onResetPositions: (): void => {
            state.host.resetPositions()
            updateHistoryButtons(state)
        },
    }))
}

function openScreenShare(state: ToolbarState): void {
    if (document.querySelector('.screen-share-overlay') !== null) {
        return
    }
    document.body.appendChild(createScreenShareModal(state.host.canvasElement))
}

/**
 * Right-to-left layout: every round button, including the locale one,
 * anchors by center with the same uniform width. Once the locale button's
 * Pixi position is set, the invisible native `<select>` stacked on top of
 * it is repositioned to match.
 */
function resizeToolbar(state: ToolbarState): void {
    state.tooltip.hide()
    let x = state.host.screenWidth - SIDE_MARGIN

    const buttons = [state.settingsButton, state.localeMenu.button, state.helpButton, state.redoButton, state.undoButton]
    for (const button of buttons) {
        button.position.set(x - BUTTON_SIZE / 2, TOP_MARGIN + BUTTON_SIZE / 2)
        x -= BUTTON_SIZE + GAP
    }
    state.localeMenu.updatePosition(state.host.canvasElement)

    state.shareButton.position.set(state.host.screenWidth / 2, TOP_MARGIN + BUTTON_SIZE / 2)
    state.logo.position.set(SIDE_MARGIN, TOP_MARGIN + LOGO_EMOJI_SIZE / 2)
}

/**
 * Pixi-rendered toolbar: emoji/wordmark logo on the left, icon buttons on the right.
 * Replaces the previous HTML toolbar (undo/redo/help/settings). Its instance
 * is never needed after setup (everything is wired via `host` callbacks), so
 * it's exposed as an init function rather than a class kept around unused.
 */
export function initTopToolbar(host: ToolbarHost, onDismissOnboarding: () => void, iconTextures: Record<string, Texture>): void {
    const container = new Container()
    container.label = 'top-toolbar'

    const state = createToolbarState(host, onDismissOnboarding, iconTextures)

    container.addChild(state.logo)
    container.addChild(state.undoButton)
    container.addChild(state.redoButton)
    container.addChild(state.helpButton)
    container.addChild(state.settingsButton)
    container.addChild(state.shareButton)
    container.addChild(state.localeMenu.button)
    container.addChild(state.tooltip.view)
    host.stage.addChild(container)

    initHistoryShortcuts((): void => doUndo(state), (): void => doRedo(state))
    host.setOnHistoryChange((): void => updateHistoryButtons(state))
    host.registerOnResize((): void => resizeToolbar(state))
    window.addEventListener('scroll', (): void => state.localeMenu.updatePosition(state.host.canvasElement), true)
    resizeToolbar(state)
    updateHistoryButtons(state)
}
