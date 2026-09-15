import { buildRoomUrl } from './screen-share-url'
import { isScreenShareHostSupported } from './compat'
import { activateSharing, getSharingState, regenerateSharingCode, stopSharing, subscribeToSharing } from './screen-share-session'
import type { SharingState, SharingStatus } from '../../types/screen-share.types'

function describeStatus(status: SharingStatus): string {
    switch (status) {
        case 'inactive':
            return ''
        case 'waiting':
            return "En attente d'un spectateur..."
        case 'connected':
            return 'Spectateur connecté.'
        case 'stopped':
            return 'Partage arrêté : personne ne s\'est connecté à temps. Cliquez sur "Activer le partage" pour réessayer.'
    }
}

export function createScreenShareModal(canvas: HTMLCanvasElement): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'screen-share-overlay'

    const modal = document.createElement('div')
    modal.className = 'screen-share-modal'

    modal.innerHTML = `
        <div class="screen-share-header">
            <h1>Partager l'écran</h1>
            <button class="screen-share-close">&times;</button>
        </div>
        <div class="screen-share-body">
            <p>Activez le partage pour laisser une autre personne suivre l'espace de travail en direct, en lecture seule.</p>
            <button class="screen-share-activate">Activer le partage</button>
            <button class="screen-share-stop" hidden>Arrêter le partage</button>
            <div class="screen-share-live">
                <p>Partagez ce lien avec la personne à inviter :</p>
                <div class="screen-share-url-row">
                    <input class="screen-share-url" type="text" readonly>
                    <button class="screen-share-copy">Copier le lien</button>
                </div>
                <p class="screen-share-copy-feedback"></p>
                <button class="screen-share-regenerate">Générer un nouveau code</button>
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
            copyFeedback.textContent = "La copie automatique n'est pas disponible dans ce navigateur. Copiez le lien manuellement."
            return
        }
        navigator.clipboard.writeText(urlInput.value).then((): void => {
            copyFeedback.classList.remove('screen-share-copy-feedback--error')
            copyFeedback.textContent = 'Lien copié dans le presse-papier.'
        }).catch((): void => {
            copyFeedback.classList.add('screen-share-copy-feedback--error')
            copyFeedback.textContent = 'Échec de la copie du lien.'
        })
    })

    if (!isScreenShareHostSupported()) {
        activateBtn.disabled = true
        statusEl.textContent = "Votre navigateur ne supporte pas le partage d'écran."
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
