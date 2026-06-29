import { showOverlay, removeOverlay, createModalFrame, createPrimaryButton } from '../utils/ui'

const SHARE_OVERLAY_ID: string = 'share-overlay'

export class ShareController {
    private btn: HTMLButtonElement | null = null

    createShareButton(): void {
        if (this.btn) {
            return
        }
        const btn: HTMLButtonElement = document.createElement('button')
        btn.textContent = 'Partager'
        btn.className = 'btn-primary share-button'
        btn.addEventListener('click', () => this.openShareModal())
        document.body.appendChild(btn)
        this.btn = btn
    }

    private openShareModal(): void {
        const existing: HTMLElement | null = document.getElementById(SHARE_OVERLAY_ID)
        if (existing) {
            return
        }

        const link: string = this.generateShareLink()

        const overlay: HTMLDivElement = showOverlay(SHARE_OVERLAY_ID, () => this.closeShareModal())
        overlay.className = 'modal-overlay modal-overlay--dimmed'

        const { body }: { body: HTMLDivElement } = createModalFrame(overlay, 'Partager', () => this.closeShareModal())
        body.className = 'modal-body share-modal-body'

        const inputGroup: HTMLDivElement = document.createElement('div')
        inputGroup.className = 'share-input-group'

        const input: HTMLInputElement = document.createElement('input')
        input.type = 'text'
        input.value = link
        input.readOnly = true
        input.className = 'share-link-input'

        const copyBtn: HTMLButtonElement = createPrimaryButton('Copier', () => {
            input.select()
            navigator.clipboard.writeText(link).then(() => {
                copyBtn.textContent = 'Copié !'
                setTimeout(() => {
                    copyBtn.textContent = 'Copier'
                }, 2000)
            }).catch(() => {
                input.select()
                document.execCommand('copy')
                copyBtn.textContent = 'Copié !'
                setTimeout(() => {
                    copyBtn.textContent = 'Copier'
                }, 2000)
            })
        })
        copyBtn.className = 'btn-primary share-copy-btn'

        inputGroup.appendChild(input)
        inputGroup.appendChild(copyBtn)

        const hint: HTMLDivElement = document.createElement('div')
        hint.className = 'share-hint'
        hint.textContent = 'Ce lien contient l\'état complet de votre tableau. Partagez-le pour restaurer cette organisation.'

        body.appendChild(inputGroup)
        body.appendChild(hint)
    }

    private closeShareModal(): void {
        removeOverlay(SHARE_OVERLAY_ID)
    }

    private generateShareLink(): string {
        const chars: string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let result: string = ''
        for (let i: number = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return `${window.location.origin}${window.location.pathname}#${result}`
    }
}
