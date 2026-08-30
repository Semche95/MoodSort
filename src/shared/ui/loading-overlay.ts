export function createLoadingOverlay(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'loading-overlay'

    const content = document.createElement('div')
    content.className = 'loading-content'

    const spinner = document.createElement('div')
    spinner.className = 'loading-spinner'

    const text = document.createElement('div')
    text.textContent = 'Chargement…'

    content.appendChild(spinner)
    content.appendChild(text)
    overlay.appendChild(content)

    return overlay
}
