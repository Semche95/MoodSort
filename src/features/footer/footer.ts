import { createLegalModal } from './legal'

export function createFooter(): HTMLElement {
    const footer = document.createElement('footer')
    footer.className = 'app-footer'

    const link = document.createElement('a')
    link.className = 'app-footer-link'
    link.textContent = 'Mentions légales'
    link.addEventListener('click', (e: MouseEvent): void => {
        e.preventDefault()
        const existing = document.querySelector('.legal-overlay')
        if (!existing) {
            document.body.appendChild(createLegalModal())
        }
    })

    footer.appendChild(link)
    return footer
}
