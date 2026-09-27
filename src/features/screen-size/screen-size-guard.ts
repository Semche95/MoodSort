import { I18n } from '../../i18n/I18n'

export const MIN_SCREEN_WIDTH_PX = 1024

export function isScreenTooSmall(): boolean {
    return window.innerWidth < MIN_SCREEN_WIDTH_PX
}

export function createScreenSizeBlockOverlay(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'screen-size-overlay'

    const content = document.createElement('div')
    content.className = 'screen-size-content'
    content.textContent = I18n.t('screenSize.message')

    overlay.appendChild(content)

    return overlay
}

export function initScreenSizeGuard(overlay: HTMLDivElement, onScreenReady: () => void): void {
    let hasBecomeReady = false

    const applyScreenState = (): void => {
        const tooSmall = isScreenTooSmall()
        overlay.style.display = tooSmall ? 'flex' : 'none'
        if (!tooSmall && !hasBecomeReady) {
            hasBecomeReady = true
            onScreenReady()
        }
    }

    applyScreenState()
    window.addEventListener('resize', applyScreenState)
}
