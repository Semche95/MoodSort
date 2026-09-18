import { Assets, Spritesheet } from 'pixi.js'
import { CanvasScene } from './canvas-scene'
import { Store } from '../shared/utils/store'
import { initOnboarding, dismissOnboarding } from '../features/onboarding/onboarding'
import { initTopToolbar } from '../features/toolbar/top-toolbar'
import { loadIconTextures } from '../shared/ui/icons'
import { createFooter } from '../features/footer/footer'
import { createLoadingOverlay } from '../shared/ui/loading-overlay'
import { CardStateService } from '../features/card/card-state-service'
import { loadCardAtlas } from '../i18n/card-atlas'
import type { Locale } from '../i18n/i18n.types'

export async function bootApp(locale: Locale): Promise<void> {
    const overlay = createLoadingOverlay()
    document.body.appendChild(overlay)

    const cardStateService = new CardStateService()

    const { atlasData, atlasImageUrl } = await loadCardAtlas(locale)
    const baseTexture = await Assets.load(atlasImageUrl)
    const spritesheet = new Spritesheet(baseTexture, atlasData)
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
