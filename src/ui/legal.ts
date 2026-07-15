export function createLegalModal(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'legal-overlay'

    const modal = document.createElement('div')
    modal.className = 'legal-modal'

    modal.innerHTML = `
        <div class="legal-header">
            <h1>Mentions légales</h1>
            <button class="legal-close">&times;</button>
        </div>
        <div class="legal-body">
            <p class="legal-date">Dernière mise à jour : 15 juillet 2026</p>

            <h2>Édition du site</h2>
            <p>Le présent site est un projet personnel, à but non commercial, édité par un particulier.</p>
            <p>Conformément à l'article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la Confiance dans l'Économie Numérique (LCEN), l'éditeur, personne physique agissant à titre non professionnel, a choisi de ne pas rendre publiques ses coordonnées personnelles. Celles-ci ont été communiquées à l'hébergeur du site, conformément à la loi.</p>

            <h2>Hébergement</h2>
            <p><strong>OVH SAS</strong><br>
            Société par actions simplifiée au capital de 50 000 000 €<br>
            RCS Lille Métropole 424 761 419 00045<br>
            Siège social : 2 rue Kellermann, 59100 Roubaix, France</p>

            <h2>Contact</h2>
            <p>Pour toute question, remarque ou signalement concernant le site, vous pouvez contacter l'éditeur à l'adresse suivante :<br>
            <strong>contact@moodsort.fr</strong></p>

            <h2>Protection des données et confidentialité</h2>
            <p>MoodSort ne collecte, ne transmet et ne stocke aucune donnée sur un serveur distant. Toutes les informations que vous créez dans l'application (positions des cartes, historique des actions) restent enregistrées directement sur votre appareil, dans votre navigateur. Rien n'est envoyé à l'éditeur, à l'hébergeur ou à un tiers.</p>
            <p>Le site n'utilise aucun cookie de suivi, aucun outil d'analyse d'audience et aucun traceur publicitaire.</p>

            <h2>Limitation de responsabilité</h2>
            <p>MoodSort est un outil expérimental fourni « en l'état », sans garantie d'aucune sorte, explicite ou implicite. Ce n'est pas un dispositif médical et il ne remplace en aucun cas un avis, un diagnostic ou un suivi par un professionnel de santé qualifié.</p>
            <p>L'auteur ne saurait être tenu responsable d'une utilisation clinique ou thérapeutique de l'outil, ni d'une éventuelle perte des données enregistrées localement dans le navigateur de l'utilisateur (par exemple en cas de suppression du stockage local, de changement d'appareil ou de navigateur).</p>
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
