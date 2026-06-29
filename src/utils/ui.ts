/**
 * Overlay management — creates a fixed full-screen overlay with backdrop dismiss.
 */
export function showOverlay(id: string, onBackdrop: () => void): HTMLDivElement {
    const existing: HTMLElement | null = document.getElementById(id)
    if (existing) {
        existing.remove()
    }
    const overlay: HTMLDivElement = document.createElement('div')
    overlay.id = id
    overlay.className = 'modal-overlay'
    overlay.addEventListener('click', (e: MouseEvent) => {
        if (e.target === overlay) {
            onBackdrop()
        }
    })
    document.body.appendChild(overlay)
    return overlay
}

export function removeOverlay(id: string): void {
    const overlay: HTMLElement | null = document.getElementById(id)
    if (overlay && overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
    }
}

/**
 * Modal frame — returns the standard header + body structure inside the given overlay.
 * The header contains a title and a close button.
 */
export function createModalFrame(overlay: HTMLDivElement, title: string, onClose: () => void): {
    modal: HTMLDivElement
    header: HTMLDivElement
    titleEl: HTMLDivElement
    closeBtn: HTMLButtonElement
    body: HTMLDivElement
} {
    const modal: HTMLDivElement = document.createElement('div')
    modal.className = 'modal-dialog'

    const header: HTMLDivElement = document.createElement('div')
    header.className = 'modal-header'

    const titleEl: HTMLDivElement = document.createElement('div')
    titleEl.className = 'modal-title'
    titleEl.textContent = title

    const closeBtn: HTMLButtonElement = createCloseButton(onClose)

    header.appendChild(titleEl)
    header.appendChild(closeBtn)

    const body: HTMLDivElement = document.createElement('div')
    body.className = 'modal-body'

    modal.appendChild(header)
    modal.appendChild(body)
    overlay.appendChild(modal)

    return { modal, header, titleEl, closeBtn, body }
}

/**
 * Standard close button (gray ×).
 */
export function createCloseButton(onClick: () => void): HTMLButtonElement {
    const btn: HTMLButtonElement = document.createElement('button')
    btn.className = 'modal-close-btn'
    btn.textContent = '×'
    btn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation()
        onClick()
    })
    return btn
}

/**
 * Standard primary action button (blue).
 */
export function createPrimaryButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn: HTMLButtonElement = document.createElement('button')
    btn.className = 'btn-primary'
    btn.textContent = label
    btn.addEventListener('click', onClick)
    return btn
}
