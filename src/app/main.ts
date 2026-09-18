import '../style.css'
import { Assets, Spritesheet } from 'pixi.js'
import type { SpritesheetData } from 'pixi.js'
import { CanvasScene } from './canvas-scene'
import { Store } from '../shared/utils/store'
import { initOnboarding, dismissOnboarding } from '../features/onboarding/onboarding'
import { initTopToolbar } from '../features/toolbar/top-toolbar'
import { loadIconTextures } from '../shared/ui/icons'
import { createFooter } from '../features/footer/footer'
import { createLoadingOverlay } from '../shared/ui/loading-overlay'
import { CardStateService } from '../features/card/card-state-service'
import { getRoomCodeFromHash } from '../features/screen-share/screen-share-url'
import { initScreenShareViewer } from '../features/screen-share/screen-share-viewer'
import atlasData from '../assets/atlas.fr.json'
import atlasImageUrl from '../assets/atlas.fr.webp?url'

async function bootApp(): Promise<void> {
    const overlay = createLoadingOverlay()
    document.body.appendChild(overlay)

    const cardStateService = new CardStateService()

    const baseTexture = await Assets.load(atlasImageUrl)
    const spritesheet = new Spritesheet(baseTexture, atlasData as SpritesheetData)
    await spritesheet.parse()

    const frameNames = Object.keys(spritesheet.textures)
    const scene = new CanvasScene(cardStateService, new Store())
    await scene.init(frameNames, spritesheet)

    if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
    }

    document.body.appendChild(createFooter())

    initOnboarding(cardStateService)

    const iconTextures = await loadIconTextures()
    initTopToolbar(scene, (): void => { dismissOnboarding(cardStateService) }, iconTextures)
}

(async (): Promise<void> => {
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
            void bootApp()
        })
        return
    }

    await bootApp()
})()
