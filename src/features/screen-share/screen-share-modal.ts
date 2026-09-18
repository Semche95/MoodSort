import { buildRoomUrl } from './screen-share-url'
import { isScreenShareHostSupported } from './compat'
import { activateSharing, getSharingState, regenerateSharingCode, stopSharing, subscribeToSharing } from './screen-share-session'
import type { SharingState, SharingStatus } from '../../types/screen-share.types'
import { I18n } from '../../i18n/I18n'

function describeStatus(status: SharingStatus): string {
    switch (status) {
        case 'inactive':
            return ''
        case 'waiting':
            return I18n.t('screenShare.statusWaiting')
        case 'connected':
            return I18n.t('screenShare.statusConnected')
        case 'stopped':
            return I18n.t('screenShare.statusStopped')
    }
}

export function createScreenShareModal(canvas: HTMLCanvasElement): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'screen-share-overlay'

    const modal = document.createElement('div')
    modal.className = 'screen-share-modal'

    modal.innerHTML = `
        <div class="screen-share-header">
            <h1>${I18n.t('screenShare.title')}</h1>
            <button class="screen-share-close" aria-label="${I18n.t('screenShare.closeAriaLabel')}">&times;</button>
        </div>
        <div class="screen-share-body">
            <p>${I18n.t('screenShare.description')}</p>
            <button class="screen-share-activate">${I18n.t('screenShare.activateButton')}</button>
            <button class="screen-share-stop" hidden>${I18n.t('screenShare.stopButton')}</button>
            <div class="screen-share-live">
                <p>${I18n.t('screenShare.shareLinkPrompt')}</p>
                <div class="screen-share-url-row">
                    <input class="screen-share-url" type="text" readonly>
                    <button class="screen-share-copy">${I18n.t('screenShare.copyButton')}</button>
                </div>
                <p class="screen-share-copy-feedback"></p>
                <button class="screen-share-regenerate">${I18n.t('screenShare.regenerateButton')}</button>
                <p class="screen-share-status"></p>
            </div>
        </div>
    `

    const closeBtn = modal.querySelector<HTMLButtonElement>('.screen-share-close')!
    const activateBtn = modal.querySelector<HTMLButtonElement>('.screen-share-activate')!
    const liveSection = modal.querySelector<HTMLDivElement>('.screen-share-live')!
    const copyBtn = modal.querySelector<HTMLButtonElement>('.screen-share-copy')!
    const stopBtn = modal.querySelector<HTMLButtonElement>('.screen-share-stop')!
    const regenerateBtn = modal.querySelector<HTMLButtonElement>('.screen-share-regenerate')!
    const urlInput = modal.querySelector<HTMLInputElement>('.screen-share-url')!
    const copyFeedback = modal.querySelector<HTMLParagraphElement>('.screen-share-copy-feedback')!
    const statusEl = modal.querySelector<HTMLParagraphElement>('.screen-share-status')!

    const render = (state: SharingState): void => {
        const isLive = state.status === 'waiting' || state.status === 'connected'
        activateBtn.hidden = isLive
        stopBtn.hidden = !isLive
        liveSection.classList.toggle('screen-share-live--visible', isLive)
        urlInput.value = buildRoomUrl(state.roomCode)
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
            copyFeedback.textContent = I18n.t('screenShare.copySuccess')
        }).catch((): void => {
            copyFeedback.classList.add('screen-share-copy-feedback--error')
            copyFeedback.textContent = I18n.t('screenShare.copyError')
        })
    })

    if (!isScreenShareHostSupported()) {
        activateBtn.disabled = true
        statusEl.textContent = I18n.t('screenShare.unsupported')
    } else {
        unsubscribe = subscribeToSharing(canvas, render)
        render(getSharingState(canvas))

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
