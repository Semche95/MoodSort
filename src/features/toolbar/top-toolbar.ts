import { Container, Texture } from 'pixi.js'
import type { FancyButton } from '@pixi/ui'
import type { ToolbarHost } from '../../types/toolbar.types'
import type { ToolbarState } from '../../types/toolbar-state.types'
import type { FullscreenControl } from '../../types/fullscreen-control.types'
import { initHistoryShortcuts } from '../history/history'
import { CanvasTooltip } from '../../shared/ui/canvas-tooltip'
import { createOnboarding } from '../onboarding/onboarding'
import { createSettingsModal } from '../settings/settings'
import { createScreenShareModal } from '../screen-share/screen-share-modal'
import { isScreenShareHostSupported } from '../screen-share/compat'
import { isFullscreenActive, isFullscreenSupported, onFullscreenChange, toggleFullscreen } from '../fullscreen/fullscreen'
import { resumeSharingIfWasActive, subscribeToSharing } from '../screen-share/screen-share-session'
import type { SharingState } from '../../types/screen-share.types'
import { createHelpIcon, createIcon } from '../../shared/ui/icons'
import { I18n, switchLocale } from '../../i18n/I18n'
import type { Locale } from '../../i18n/i18n.types'
import { createLocaleMenu } from './locale-menu'
import { BUTTON_SIZE, LOGO_EMOJI_SIZE, applyButtonTheme, applyLogoTheme, applyShareButtonTheme, createButton, createLogo, createShareButton, setButtonEnabled, setShareIndicators } from './toolbar-view'
import type { ThemeService } from '../theme/theme-service'
import type { ResolvedTheme } from '../../types/theme.types'

const GAP = 8
const TOP_MARGIN = 16
const SIDE_MARGIN = 16

function createToolbarState(host: ToolbarHost, onDismissOnboarding: () => void, iconTextures: Record<string, Texture>, themeService: ThemeService): ToolbarState {
    const resolvedTheme = themeService.getResolvedTheme()
    const tooltip = new CanvasTooltip()
    const logo = createLogo(resolvedTheme)
    const undoIcon = createIcon(iconTextures['undo-2'], resolvedTheme)
    const redoIcon = createIcon(iconTextures['redo-2'], resolvedTheme)
    const shareSupported = isScreenShareHostSupported()

    const state = { host, tooltip, logo, undoIcon, redoIcon, onDismissOnboarding, themeService } as ToolbarState

    state.undoButton = createButton(tooltip, undoIcon, (): void => doUndo(state), 'toolbar-undobutton', I18n.t('toolbar.undo'), undefined, resolvedTheme)
    state.redoButton = createButton(tooltip, redoIcon, (): void => doRedo(state), 'toolbar-redobutton', I18n.t('toolbar.redo'), undefined, resolvedTheme)
    state.helpButton = createButton(tooltip, createHelpIcon(resolvedTheme), (): void => showOnboarding(state), 'toolbar-helpbutton', I18n.t('toolbar.help'), 1, resolvedTheme)
    state.settingsButton = createButton(tooltip, createIcon(iconTextures['sliders-horizontal'], resolvedTheme), (): void => openSettings(state), 'toolbar-settingsbutton', I18n.t('toolbar.settings'), undefined, resolvedTheme)

    const share = createShareButton(
        tooltip,
        createIcon(iconTextures['screen-share'], resolvedTheme),
        (): void => openScreenShare(state),
        shareSupported ? I18n.t('toolbar.shareTooltip') : I18n.t('toolbar.shareTooltipUnsupported'),
        I18n.t('toolbar.share'),
        resolvedTheme,
    )
    state.shareButton = share.button
    state.shareIcon = share.content
    state.shareActiveIndicator = share.activeIndicator
    state.shareViewerIndicator = share.viewerIndicator
    setButtonEnabled(state.shareButton, state.shareIcon, shareSupported, tooltip)

    state.fullscreen = isFullscreenSupported() ? createFullscreenControl(tooltip, iconTextures, resolvedTheme) : null

    state.localeMenu = createLocaleMenu(tooltip, iconTextures.globe, I18n.getLocale(), (locale: Locale): void => switchLocale(locale), resolvedTheme)

    if (shareSupported) {
        subscribeToSharing(host.canvasElement, (sharing: SharingState): void => {
            setShareIndicators(state.shareActiveIndicator, state.shareViewerIndicator, sharing.status)
        })
        setShareIndicators(state.shareActiveIndicator, state.shareViewerIndicator, 'inactive')
        resumeSharingIfWasActive(host.canvasElement)
    }

    return state
}

function createFullscreenControl(tooltip: CanvasTooltip, iconTextures: Record<string, Texture>, resolvedTheme: ResolvedTheme): FullscreenControl {
    const icon = createIcon(iconTextures.maximize, resolvedTheme)
    const button = createButton(tooltip, icon, (): void => { void toggleFullscreen() }, 'toolbar-fullscreenbutton', I18n.t('toolbar.fullscreenEnter'), undefined, resolvedTheme)
    const control = { button, icon, enterTexture: iconTextures.maximize, exitTexture: iconTextures.minimize }
    syncFullscreenControl(control)
    return control
}

// Driven only by the actual fullscreen state, so exits via Escape or browser UI are reflected too.
function syncFullscreenControl(control: FullscreenControl): void {
    const active = isFullscreenActive()
    control.icon.texture = active ? control.exitTexture : control.enterTexture
    control.button.accessibleTitle = I18n.t(active ? 'toolbar.fullscreenExit' : 'toolbar.fullscreenEnter')
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
        themeService: state.themeService,
    }))
}

function applyToolbarTheme(state: ToolbarState, resolved: ResolvedTheme): void {
    applyLogoTheme(state.logo, resolved)
    applyButtonTheme(state.undoButton, resolved)
    applyButtonTheme(state.redoButton, resolved)
    applyButtonTheme(state.helpButton, resolved)
    applyButtonTheme(state.settingsButton, resolved)
    if (state.fullscreen !== null) {
        applyButtonTheme(state.fullscreen.button, resolved)
    }
    applyButtonTheme(state.localeMenu.button, resolved)
    applyShareButtonTheme(state.shareButton, state.shareIcon, state.shareActiveIndicator, state.shareViewerIndicator, resolved)
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

    const buttons = [state.settingsButton, state.fullscreen?.button, state.localeMenu.button, state.helpButton, state.redoButton, state.undoButton]
        .filter((button: FancyButton | undefined): button is FancyButton => button !== undefined)
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
export function initTopToolbar(host: ToolbarHost, onDismissOnboarding: () => void, iconTextures: Record<string, Texture>, themeService: ThemeService): void {
    const container = new Container()
    container.label = 'top-toolbar'

    const state = createToolbarState(host, onDismissOnboarding, iconTextures, themeService)

    container.addChild(state.logo)
    container.addChild(state.undoButton)
    container.addChild(state.redoButton)
    container.addChild(state.helpButton)
    container.addChild(state.settingsButton)
    if (state.fullscreen !== null) {
        container.addChild(state.fullscreen.button)
    }
    container.addChild(state.shareButton)
    container.addChild(state.localeMenu.button)
    container.addChild(state.tooltip.view)
    host.stage.addChild(container)

    initHistoryShortcuts((): void => doUndo(state), (): void => doRedo(state))
    host.setOnHistoryChange((): void => updateHistoryButtons(state))
    host.registerOnResize((): void => resizeToolbar(state))
    window.addEventListener('scroll', (): void => state.localeMenu.updatePosition(state.host.canvasElement), true)
    const fullscreen = state.fullscreen
    if (fullscreen !== null) {
        onFullscreenChange((): void => {
            state.tooltip.hide()
            syncFullscreenControl(fullscreen)
        })
    }
    themeService.onChange((resolved: ResolvedTheme): void => applyToolbarTheme(state, resolved))
    resizeToolbar(state)
    updateHistoryButtons(state)
}
