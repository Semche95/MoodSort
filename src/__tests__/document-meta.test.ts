import { describe, it, expect, beforeEach } from 'vitest'
import { applyDocumentMeta } from '../i18n/document-meta'
import { I18n } from '../i18n/I18n'

beforeEach(() => {
    document.head.innerHTML = `
        <title></title>
        <meta name="description" content="">
        <meta property="og:title" content="">
        <meta property="og:description" content="">
    `
})

describe('applyDocumentMeta', () => {
    it('sets the title and meta tags from the active locale', () => {
        I18n.setLocale('en')

        applyDocumentMeta()

        expect(document.documentElement.lang).toBe('en')
        expect(document.title).toBe('MoodSort - An emotional exploration tool')
        expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
            .toBe('MoodSort is an emotional exploration tool for identifying, sorting and expressing emotions through an interactive card-based interface.')
        expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content'))
            .toBe('MoodSort - An emotional exploration tool')
        expect(document.head.querySelector('meta[property="og:description"]')?.getAttribute('content'))
            .toBe('An interactive emotional card-sorting application designed to help identify and express emotions.')
    })

    it('switches the content to another locale', () => {
        I18n.setLocale('fr')

        applyDocumentMeta()

        expect(document.documentElement.lang).toBe('fr')
        expect(document.title).toBe("MoodSort - Un outil d'exploration émotionnelle")
    })
})
