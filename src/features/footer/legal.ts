import { I18n } from '../../i18n/I18n'
import { domIcon } from '../../shared/ui/dom-icons'
import { iconBadge, modalCloseButton } from '../../shared/ui/modal'

/**
 * OVH's registered address is a legal identifier, not app content, so it
 * stays in French in every locale rather than being translated like the
 * surrounding legal notice text.
 */
const OVH_HOSTING_NOTICE =
    '<strong>OVH SAS</strong>Société par actions simplifiée au capital de 50 000 000 €<br>RCS Lille Métropole 424 761 419 00045<br>Siège social : 2 rue Kellermann, 59100 Roubaix, France'

const CONTACT_EMAIL = 'contact@moodsort.fr'

export function createLegalModal(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay legal-overlay'

    const modal = document.createElement('div')
    modal.className = 'modal legal-modal'

    modal.innerHTML = `
        <div class="modal-header legal-header">
            <div>
                <h1>${I18n.t('legal.title')}</h1>
                <p class="modal-subtitle legal-date">${domIcon('calendar')}${I18n.t('legal.lastUpdated')}</p>
            </div>
            ${modalCloseButton('legal-close', I18n.t('legal.closeAriaLabel'))}
        </div>
        <div class="legal-body">
            <section class="legal-section">
                ${iconBadge('user')}
                <div>
                    <h2>${I18n.t('legal.editionTitle')}</h2>
                    <p>${I18n.t('legal.editionText1')}</p>
                    <p>${I18n.t('legal.editionText2')}</p>
                </div>
            </section>
            <section class="legal-section">
                ${iconBadge('server')}
                <div>
                    <h2>${I18n.t('legal.hostingTitle')}</h2>
                    <p class="legal-card">${OVH_HOSTING_NOTICE}</p>
                </div>
            </section>
            <section class="legal-section">
                ${iconBadge('mail')}
                <div>
                    <h2>${I18n.t('legal.contactTitle')}</h2>
                    <p>${I18n.t('legal.contactText')}</p>
                    <a class="legal-mail" href="mailto:${CONTACT_EMAIL}">${domIcon('mail')}${CONTACT_EMAIL}</a>
                </div>
            </section>
            <section class="legal-section">
                ${iconBadge('shield-check')}
                <div>
                    <h2>${I18n.t('legal.privacyTitle')}</h2>
                    <p>${I18n.t('legal.privacyText1')}</p>
                    <p>${I18n.t('legal.privacyText2')}</p>
                </div>
            </section>
            <section class="legal-section">
                ${iconBadge('scale')}
                <div>
                    <h2>${I18n.t('legal.liabilityTitle')}</h2>
                    <p>${I18n.t('legal.liabilityText1')}</p>
                    <p>${I18n.t('legal.liabilityText2')}</p>
                </div>
            </section>
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
