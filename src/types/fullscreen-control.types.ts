import type { Sprite, Texture } from 'pixi.js'
import type { FancyButton } from '@pixi/ui'

export interface FullscreenControl {
    button: FancyButton
    icon: Sprite
    enterTexture: Texture
    exitTexture: Texture
}
