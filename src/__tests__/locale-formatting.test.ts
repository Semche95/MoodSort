import { describe, it, expect } from 'vitest'

const rawLocaleFiles = import.meta.glob<string>('../i18n/locales/*.json', { eager: true, query: '?raw', import: 'default' })

describe('locale JSON formatting', () => {
    it.each(Object.entries(rawLocaleFiles))('%s is indented with 2 spaces and ends with a newline', (_path: string, raw: string): void => {
        expect(raw).toBe(`${JSON.stringify(JSON.parse(raw), null, 2)}\n`)
    })
})
