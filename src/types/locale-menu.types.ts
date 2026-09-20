import type { FancyButton } from '@pixi/ui'

export interface LocaleMenu {
    button: FancyButton
    select: HTMLSelectElement
    /** Recalculates the invisible native select's screen position to match the Pixi button's, given the current canvas placement. */
    updatePosition(canvasElement: HTMLCanvasElement): void
}
