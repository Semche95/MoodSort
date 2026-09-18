import { I18n } from '../../i18n/I18n'

/**
 * OVH's registered address is a legal identifier, not app content, so it
 * stays in French in every locale rather than being translated like the
 * surrounding legal notice text.
 */
const OVH_HOSTING_NOTICE =
    '<strong>OVH SAS</strong><br>Société par actions simplifiée au capital de 50 000 000 €<br>RCS Lille Métropole 424 761 419 00045<br>Siège social : 2 rue Kellermann, 59100 Roubaix, France'

export function createLegalModal(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'legal-overlay'

    const modal = document.createElement('div')
    modal.className = 'legal-modal'

    modal.innerHTML = `
        <div class="legal-header">
            <h1>${I18n.t('legal.title')}</h1>
            <button class="legal-close" aria-label="${I18n.t('legal.closeAriaLabel')}">&times;</button>
        </div>
        <div class="legal-body">
            <p class="legal-date">${I18n.t('legal.lastUpdated')}</p>

            <h2>${I18n.t('legal.editionTitle')}</h2>
            <p>${I18n.t('legal.editionText1')}</p>
            <p>${I18n.t('legal.editionText2')}</p>

            <h2>${I18n.t('legal.hostingTitle')}</h2>
            <p>${OVH_HOSTING_NOTICE}</p>

            <h2>${I18n.t('legal.contactTitle')}</h2>
            <p>${I18n.t('legal.contactText')}</p>

            <h2>${I18n.t('legal.privacyTitle')}</h2>
            <p>${I18n.t('legal.privacyText1')}</p>
            <p>${I18n.t('legal.privacyText2')}</p>

            <h2>${I18n.t('legal.liabilityTitle')}</h2>
            <p>${I18n.t('legal.liabilityText1')}</p>
            <p>${I18n.t('legal.liabilityText2')}</p>
        </div>
    `

    const closeBtn = modal.querySelector<HTMLButtonElement>('.legal-close')!
    closeBtn.addEventListener('click', (): void => {
        overlay.remove()
    })

    overlay.addEventListener('click', (e: MouseEvent): void => {
        if (e.target === overlay) {
            overlay.remove()
        }
    })

    overlay.appendChild(modal)
    return overlay
}
