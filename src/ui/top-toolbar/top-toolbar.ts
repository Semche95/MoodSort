import { Container, Texture } from 'pixi.js'
import type { ToolbarHost } from '../../types/toolbar.types'
import { initHistoryShortcuts } from '../../bootstrap'
import { CanvasTooltip } from '../canvas-tooltip'
import { createOnboarding } from '../onboarding'
import { createSettingsModal } from '../settings'
import { createHelpIcon, createIcon } from '../icons'
import { BUTTON_SIZE, LOGO_EMOJI_SIZE, createButton, createLogo, setButtonEnabled } from './toolbar-view'

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
    undoButton: ReturnType<typeof createButton>
    redoButton: ReturnType<typeof createButton>
    helpButton: ReturnType<typeof createButton>
    settingsButton: ReturnType<typeof createButton>
    onDismissOnboarding: () => void
}

function createToolbarState(host: ToolbarHost, onDismissOnboarding: () => void, iconTextures: Record<string, Texture>): ToolbarState {
    const tooltip = new CanvasTooltip()
    const logo = createLogo()
    const undoIcon = createIcon(iconTextures['undo-2'])
    const redoIcon = createIcon(iconTextures['redo-2'])

    const state = { host, tooltip, logo, undoIcon, redoIcon, onDismissOnboarding } as ToolbarState

    state.undoButton = createButton(tooltip, undoIcon, (): void => doUndo(state), 'toolbar-undobutton', 'Annuler')
    state.redoButton = createButton(tooltip, redoIcon, (): void => doRedo(state), 'toolbar-redobutton', 'Rétablir')
    state.helpButton = createButton(tooltip, createHelpIcon(), (): void => showOnboarding(state), 'toolbar-helpbutton', 'Aide', 1)
    state.settingsButton = createButton(tooltip, createIcon(iconTextures['sliders-horizontal']), (): void => openSettings(state), 'toolbar-settingsbutton', 'Réglages')

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

function resizeToolbar(state: ToolbarState): void {
    state.tooltip.hide()
    const buttons = [state.settingsButton, state.helpButton, state.redoButton, state.undoButton]
    let x = state.host.screenWidth - SIDE_MARGIN - BUTTON_SIZE / 2
    for (const button of buttons) {
        button.position.set(x, TOP_MARGIN + BUTTON_SIZE / 2)
        x -= BUTTON_SIZE + GAP
    }
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
    container.addChild(state.tooltip.view)
    host.stage.addChild(container)

    initHistoryShortcuts((): void => doUndo(state), (): void => doRedo(state))
    host.setOnHistoryChange((): void => updateHistoryButtons(state))
    host.registerOnResize((): void => resizeToolbar(state))
    resizeToolbar(state)
    updateHistoryButtons(state)
}
