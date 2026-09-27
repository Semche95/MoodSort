import { CanvasScene } from './canvas-scene'
import { Store } from '../shared/utils/store'
import { initOnboarding, dismissOnboarding } from '../features/onboarding/onboarding'
import { initTopToolbar } from '../features/toolbar/top-toolbar'
import { loadIconTextures } from '../shared/ui/icons'
import { createFooter } from '../features/footer/footer'
import { createLoadingOverlay } from '../shared/ui/loading-overlay'
import { CardStateService } from '../features/card/card-state-service'
import { loadCardAtlasSpritesheet } from '../i18n/card-atlas'
import type { Locale } from '../i18n/i18n.types'
import { ThemeService } from '../features/theme/theme-service'
import { getRoomCodeFromHash } from '../features/screen-share/screen-share-url'
import { initScreenShareViewer } from '../features/screen-share/screen-share-viewer'

export function startApp(locale: Locale): void {
    const initialRoomCode = getRoomCodeFromHash(window.location.hash)

    window.addEventListener('hashchange', (): void => {
        const roomCode = getRoomCodeFromHash(window.location.hash)
        if (roomCode && roomCode !== initialRoomCode) {
            window.location.reload()
        }
    })

    if (initialRoomCode) {
        initScreenShareViewer(initialRoomCode, (): void => {
            window.location.hash = ''
            void bootApp(locale)
        })
        return
    }

    void bootApp(locale)
}

export async function bootApp(locale: Locale): Promise<void> {
    const overlay = createLoadingOverlay()
    document.body.appendChild(overlay)

    const cardStateService = new CardStateService()
    const themeService = new ThemeService()

    const spritesheet = await loadCardAtlasSpritesheet(locale, themeService.getResolvedTheme())

    const frameNames = Object.keys(spritesheet.textures)
    const scene = new CanvasScene(cardStateService, new Store(), themeService, locale)
    await scene.init(frameNames, spritesheet)

    if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
    }

    document.body.appendChild(createFooter())

    initOnboarding(cardStateService)

    const iconTextures = await loadIconTextures()
    initTopToolbar(scene, (): void => { dismissOnboarding(cardStateService) }, iconTextures, themeService)
}
