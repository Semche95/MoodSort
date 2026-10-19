import { buildRoomUrl } from './screen-share-url'
import { isScreenShareHostSupported, isWebRtcBlocked } from './compat'
import { getIceServers, isRoomConfigValid } from './room-config'
import { activateSharing, getSharingState, regenerateSharingCode, stopSharing, subscribeToSharing } from './screen-share-session'
import type { SharingState, SharingStatus } from '../../types/screen-share.types'
import { I18n } from '../../i18n/I18n'
import { domIcon } from '../../shared/ui/dom-icons'
import { iconBadge, modalCloseButton } from '../../shared/ui/modal'

function describeStatus(status: SharingStatus): string {
    switch (status) {
        case 'inactive':
        case 'stopped':
            return ''
        case 'waiting':
            return I18n.t('screenShare.statusWaiting')
        case 'connected':
            return I18n.t('screenShare.statusConnected')
    }
}

function showError(errorEl: HTMLElement, message: string): void {
    errorEl.textContent = message
    errorEl.parentElement!.hidden = false
}

export function createScreenShareModal(canvas: HTMLCanvasElement): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay screen-share-overlay'

    const modal = document.createElement('div')
    modal.className = 'modal screen-share-modal'

    modal.innerHTML = `
        <div class="modal-header">
            <h1>${I18n.t('screenShare.title')}</h1>
            ${modalCloseButton('screen-share-close', I18n.t('screenShare.closeAriaLabel'))}
        </div>
        <div class="modal-body">
            <div class="screen-share-intro">
                ${iconBadge('screen-share')}
                <p>${I18n.t('screenShare.description')}</p>
            </div>
            <p class="callout callout-danger" hidden>${domIcon('triangle-alert')}<span class="screen-share-error"></span></p>
            <p class="callout callout-info screen-share-stopped" hidden>${domIcon('timer-off')}<span>${I18n.t('screenShare.statusStopped')}</span></p>
            <button class="button button-primary button-block screen-share-activate">${domIcon('screen-share')}${I18n.t('screenShare.activateButton')}</button>
            <div class="screen-share-live">
                <p class="screen-share-status"></p>
                <p class="screen-share-link-prompt">${I18n.t('screenShare.shareLinkPrompt')}</p>
                <div class="screen-share-url-row">
                    ${domIcon('link')}
                    <input class="screen-share-url" type="text" readonly>
                    <button class="button button-primary screen-share-copy">${domIcon('copy')}${I18n.t('screenShare.copyButton')}</button>
                </div>
                <p class="screen-share-copy-feedback"></p>
                <div class="screen-share-actions">
                    <button class="button button-ghost screen-share-regenerate">${domIcon('refresh-cw')}${I18n.t('screenShare.regenerateButton')}</button>
                    <button class="button button-danger-outline screen-share-stop">${domIcon('square')}${I18n.t('screenShare.stopButton')}</button>
                </div>
            </div>
        </div>
    `

    const closeBtn = modal.querySelector<HTMLButtonElement>('.screen-share-close')!
    const activateBtn = modal.querySelector<HTMLButtonElement>('.screen-share-activate')!
    const intro = modal.querySelector<HTMLDivElement>('.screen-share-intro')!
    const liveSection = modal.querySelector<HTMLDivElement>('.screen-share-live')!
    const copyBtn = modal.querySelector<HTMLButtonElement>('.screen-share-copy')!
    const stopBtn = modal.querySelector<HTMLButtonElement>('.screen-share-stop')!
    const regenerateBtn = modal.querySelector<HTMLButtonElement>('.screen-share-regenerate')!
    const urlInput = modal.querySelector<HTMLInputElement>('.screen-share-url')!
    const copyFeedback = modal.querySelector<HTMLParagraphElement>('.screen-share-copy-feedback')!
    const statusEl = modal.querySelector<HTMLParagraphElement>('.screen-share-status')!
    const errorEl = modal.querySelector<HTMLParagraphElement>('.screen-share-error')!
    const stoppedNotice = modal.querySelector<HTMLParagraphElement>('.screen-share-stopped')!

    const render = (state: SharingState): void => {
        const isLive = state.status === 'waiting' || state.status === 'connected'
        intro.hidden = isLive
        activateBtn.hidden = isLive
        stoppedNotice.hidden = state.status !== 'stopped'
        liveSection.classList.toggle('screen-share-live--visible', isLive)
        urlInput.value = buildRoomUrl(state.roomCode)
        statusEl.dataset.status = state.status
        statusEl.textContent = describeStatus(state.status)
    }

    let unsubscribe = (): void => {}

    // Closing the dialog only hides it: sharing keeps running regardless of the modal.
    const close = (): void => {
        unsubscribe()
        overlay.remove()
    }

    closeBtn.addEventListener('click', close)

    overlay.addEventListener('click', (e: MouseEvent): void => {
        if (e.target === overlay) {
            close()
        }
    })

    copyBtn.addEventListener('click', (): void => {
        if (!navigator.clipboard) {
            copyFeedback.classList.add('screen-share-copy-feedback--error')
            copyFeedback.textContent = I18n.t('screenShare.copyUnsupported')
            return
        }
        navigator.clipboard.writeText(urlInput.value).then((): void => {
            copyFeedback.classList.remove('screen-share-copy-feedback--error')
            copyFeedback.innerHTML = `${domIcon('check')}${I18n.t('screenShare.copySuccess')}`
        }).catch((): void => {
            copyFeedback.classList.add('screen-share-copy-feedback--error')
            copyFeedback.textContent = I18n.t('screenShare.copyError')
        })
    })

    if (!isScreenShareHostSupported()) {
        activateBtn.disabled = true
        showError(errorEl, I18n.t('screenShare.unsupported'))
    } else if (!isRoomConfigValid()) {
        activateBtn.disabled = true
    } else {
        unsubscribe = subscribeToSharing(canvas, render)
        render(getSharingState(canvas))

        void isWebRtcBlocked(getIceServers()).then((blocked: boolean): void => {
            if (blocked) {
                activateBtn.disabled = true
                showError(errorEl, I18n.t('screenShare.webRtcBlocked'))
            }
        })

        activateBtn.addEventListener('click', (): void => {
            activateSharing(canvas)
        })

        stopBtn.addEventListener('click', (): void => {
            stopSharing(canvas)
        })

        regenerateBtn.addEventListener('click', (): void => {
            copyFeedback.textContent = ''
            regenerateSharingCode(canvas)
        })
    }

    overlay.appendChild(modal)
    return overlay
}
