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
import atlasData from '../assets/atlas.json'
import atlasImageUrl from '../assets/atlas.webp?url'

(async (): Promise<void> => {
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
})()
