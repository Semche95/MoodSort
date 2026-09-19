import '../style.css'
import { getRoomCodeFromHash } from '../features/screen-share/screen-share-url'
import { initScreenShareViewer } from '../features/screen-share/screen-share-viewer'
import { applyDocumentMeta } from '../i18n/document-meta'
import { resolveLocale } from '../i18n/locale-resolution'
import { bootApp } from './bootstrap'

(async (): Promise<void> => {
    const locale = resolveLocale()
    applyDocumentMeta()

    const initialRoomCode = getRoomCodeFromHash(window.location.hash)

    window.addEventListener('hashchange', (): void => {
        const roomCode = getRoomCodeFromHash(window.location.hash)
        if (roomCode && roomCode !== initialRoomCode) {
            window.location.reload()
        }
    })

    if (initialRoomCode) {
        initScreenShareViewer(initialRoomCode, (): void => {
            window.location.hash = ''
            void bootApp(locale)
        })
        return
    }

    await bootApp(locale)
})()
