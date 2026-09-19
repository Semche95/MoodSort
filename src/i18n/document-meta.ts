import { I18n } from './I18n'

function setMetaContent(selector: string, content: string): void {
    document.head.querySelector(selector)?.setAttribute('content', content)
}

/** Sets the `lang` attribute, `document.title` and the description/OpenGraph meta tags from the active locale's `meta` dictionary. Must run after `I18n`'s locale has been set (see `resolveLocale`). */
export function applyDocumentMeta(): void {
    document.documentElement.lang = I18n.getLocale()
    document.title = I18n.t('meta.title')
    setMetaContent('meta[name="description"]', I18n.t('meta.description'))
    setMetaContent('meta[property="og:title"]', I18n.t('meta.ogTitle'))
    setMetaContent('meta[property="og:description"]', I18n.t('meta.ogDescription'))
}
