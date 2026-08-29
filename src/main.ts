import './style.css'
import { Assets, Spritesheet } from 'pixi.js'
import type { SpritesheetData } from 'pixi.js'
import { setupCanvas, initOnboarding, dismissOnboarding } from './bootstrap'
import { initTopToolbar } from './ui/top-toolbar/top-toolbar'
import { loadIconTextures } from './ui/icons'
import { createFooter } from './ui/footer'
import { createLoadingOverlay } from './ui/loading-overlay'
import { CardStateService } from './services/card-state-service'
import atlasData from './assets/atlas.json'
import atlasImageUrl from './assets/atlas.webp?url'

(async (): Promise<void> => {
    const overlay = createLoadingOverlay()
    document.body.appendChild(overlay)

    const cardStateService = new CardStateService()

    const baseTexture = await Assets.load(atlasImageUrl)
    const spritesheet = new Spritesheet(baseTexture, atlasData as SpritesheetData)
    await spritesheet.parse()

    const frameNames = Object.keys(spritesheet.textures)
    const { controller } = await setupCanvas(frameNames, spritesheet, cardStateService)

    if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
    }

    document.body.appendChild(createFooter())

    initOnboarding(cardStateService)

    const iconTextures = await loadIconTextures()
    initTopToolbar(controller, (): void => { dismissOnboarding(cardStateService) }, iconTextures)
})()
