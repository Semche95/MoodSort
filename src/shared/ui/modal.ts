import { domIcon } from './dom-icons'

export function modalCloseButton(className: string, ariaLabel: string): string {
    return `<button class="modal-close ${className}" aria-label="${ariaLabel}">${domIcon('x')}</button>`
}

export function iconBadge(icon: Parameters<typeof domIcon>[0]): string {
    return `<span class="icon-badge">${domIcon(icon)}</span>`
}
