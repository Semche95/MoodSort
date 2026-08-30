import { Container } from 'pixi.js'

/**
 * Minimal surface of CanvasScene used by the toolbar, kept small so it can
 * be stubbed in tests without instantiating the whole Pixi app.
 */
export interface ToolbarHost {
    readonly stage: Container
    readonly screenWidth: number
    readonly screenHeight: number
    readonly canUndo: boolean
    readonly canRedo: boolean
    undo(): void
    redo(): void
    resetPositions(): void
    setOnHistoryChange(callback: () => void): void
    registerOnResize(callback: () => void): void
}
