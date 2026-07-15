import './style.css'
import { Assets, SpritesheetData, Spritesheet } from 'pixi.js'
import { createLoadingOverlay, createHeader, setupCanvas, initOnboarding, initToolbar } from './utils/canvas'
import { CardStateService } from './services/CardStateService'
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

    createHeader()

    initOnboarding(cardStateService)
    initToolbar(controller, cardStateService)
})()
