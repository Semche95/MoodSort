import { describe, expect, it } from 'vitest'
import { domIcon } from '../shared/ui/dom-icons'

describe('domIcon', () => {
    it('returns the Lucide SVG hidden from assistive technologies', () => {
        const host = document.createElement('span')
        host.innerHTML = domIcon('x')

        const svg = host.querySelector('svg')!
        expect(svg.classList.contains('lucide-x')).toBe(true)
        expect(svg.getAttribute('aria-hidden')).toBe('true')
    })

    it('adds no comment and no text to the element it is inserted in', () => {
        const host = document.createElement('span')
        host.innerHTML = `${domIcon('check')}Copied`

        expect(host.textContent).toBe('Copied')
        expect(host.childNodes).toHaveLength(2)
    })
})
