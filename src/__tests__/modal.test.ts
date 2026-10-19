import { describe, expect, it } from 'vitest'
import { iconBadge, modalCloseButton } from '../shared/ui/modal'

describe('modalCloseButton', () => {
    it('renders a cross button carrying the shared and the given class, labelled for assistive technologies', () => {
        const host = document.createElement('div')
        host.innerHTML = modalCloseButton('legal-close', 'Close')

        const button = host.querySelector('button')!
        expect(button.className).toBe('modal-close legal-close')
        expect(button.getAttribute('aria-label')).toBe('Close')
        expect(button.querySelector('svg.lucide-x')).not.toBeNull()
    })
})

describe('iconBadge', () => {
    it('wraps the given icon in a badge', () => {
        const host = document.createElement('div')
        host.innerHTML = iconBadge('mail')

        const badge = host.querySelector('.icon-badge')!
        expect(badge.querySelector('svg.lucide-mail')).not.toBeNull()
    })
})
