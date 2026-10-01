import type { WebkitFullscreenDocument, WebkitFullscreenElement } from '../../types/webkit-fullscreen.types'

function webkitDocument(): WebkitFullscreenDocument {
    return document as WebkitFullscreenDocument
}

function usesStandardApi(): boolean {
    return document.fullscreenEnabled === true
}

export function isFullscreenSupported(): boolean {
    return usesStandardApi() || webkitDocument().webkitFullscreenEnabled === true
}

export function isFullscreenActive(): boolean {
    const element = usesStandardApi() ? document.fullscreenElement : webkitDocument().webkitFullscreenElement
    return element !== null && element !== undefined
}

async function requestFullscreen(): Promise<void> {
    const root = document.documentElement
    if (usesStandardApi()) {
        await root.requestFullscreen()
        return
    }
    (root as WebkitFullscreenElement).webkitRequestFullscreen?.()
}

async function exitFullscreen(): Promise<void> {
    if (usesStandardApi()) {
        await document.exitFullscreen()
        return
    }
    webkitDocument().webkitExitFullscreen?.()
}

// Targets documentElement rather than the canvas so DOM modals stay visible while in fullscreen.
export async function toggleFullscreen(): Promise<void> {
    try {
        await (isFullscreenActive() ? exitFullscreen() : requestFullscreen())
    } catch {
        // Browser refused (no user gesture, permissions policy...): the button state stays driven by fullscreenchange
    }
}

export function onFullscreenChange(callback: () => void): void {
    document.addEventListener(usesStandardApi() ? 'fullscreenchange' : 'webkitfullscreenchange', callback)
}
