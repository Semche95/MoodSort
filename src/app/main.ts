import '../style.css'
import { createScreenSizeBlockOverlay, initScreenSizeGuard } from '../features/screen-size/screen-size-guard'
import { applyDocumentMeta } from '../i18n/document-meta'
import { resolveLocale } from '../i18n/locale-resolution'
import { startApp } from './bootstrap'

;(async (): Promise<void> => {
    const locale = resolveLocale()
    applyDocumentMeta()

    const screenSizeOverlay = createScreenSizeBlockOverlay()
    document.body.appendChild(screenSizeOverlay)
    initScreenSizeGuard(screenSizeOverlay, (): void => { startApp(locale) })
})()
