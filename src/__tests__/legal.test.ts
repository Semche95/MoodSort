import { describe, expect, it } from 'vitest'
import { createLegalModal } from '../features/footer/legal'

describe('createLegalModal', () => {
    it('links the contact address as a mailto link', () => {
        const link = createLegalModal().querySelector<HTMLAnchorElement>('.legal-mail')!

        expect(link.getAttribute('href')).toBe('mailto:contact@moodsort.fr')
        expect(link.textContent).toBe('contact@moodsort.fr')
    })
})
