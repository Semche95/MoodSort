/** Prefixed Fullscreen API members still exposed by older WebKit browsers (Safari < 16.4). */
export interface WebkitFullscreenDocument {
    webkitFullscreenEnabled?: boolean
    webkitFullscreenElement?: Element | null
    webkitExitFullscreen?: () => void
}

export interface WebkitFullscreenElement {
    webkitRequestFullscreen?: () => void
}
