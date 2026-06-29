import { CanvasController } from '../controllers/CanvasController'

export function createLoadingOverlay(): HTMLDivElement {
    const overlay: HTMLDivElement = document.createElement('div')
    overlay.className = 'loading-overlay'

    const content: HTMLDivElement = document.createElement('div')
    content.className = 'loading-content'

    const spinner: HTMLDivElement = document.createElement('div')
    spinner.className = 'loading-spinner'

    const text: HTMLDivElement = document.createElement('div')
    text.textContent = 'Chargement…'

    content.appendChild(spinner)
    content.appendChild(text)
    overlay.appendChild(content)

    return overlay
}

/**
 * Sets up the canvas with the provided images
 * @param images - Array of image paths to load
 * @returns Promise that resolves with small handlers bound to the controller
 * @throws Error if no images are provided
 */
export async function setupCanvas(images: string[]): Promise<{ onCanvasResize: () => void }> {
    const controller: CanvasController = new CanvasController()
    await controller.init(images)
    const onCanvasResize: () => void = (): void => {
        controller.handleResize()
    }
    return { onCanvasResize }
}
