import { vi } from 'vitest'
import type { Mock } from 'vitest'

export interface FullscreenApiMock {
    request: Mock<() => Promise<void> | void>
    exit: Mock<() => Promise<void> | void>
    setElement(element: Element | null): void
    restore(): void
}

/** Installs a fake Fullscreen API on the jsdom document, either standard or webkit-prefixed. */
export function mockFullscreenApi(variant: 'standard' | 'webkit'): FullscreenApiMock {
    let element: Element | null = null
    const request = vi.fn((): Promise<void> | void => (variant === 'standard' ? Promise.resolve() : undefined))
    const exit = vi.fn((): Promise<void> | void => (variant === 'standard' ? Promise.resolve() : undefined))
    const documentProperties = variant === 'standard'
        ? { fullscreenEnabled: true, exitFullscreen: exit }
        : { webkitFullscreenEnabled: true, webkitExitFullscreen: exit }
    const elementKey = variant === 'standard' ? 'fullscreenElement' : 'webkitFullscreenElement'
    const requestKey = variant === 'standard' ? 'requestFullscreen' : 'webkitRequestFullscreen'

    for (const [key, value] of Object.entries(documentProperties)) {
        Object.defineProperty(document, key, { configurable: true, value })
    }
    Object.defineProperty(document, elementKey, { configurable: true, get: (): Element | null => element })
    Object.defineProperty(document.documentElement, requestKey, { configurable: true, value: request })

    return {
        request,
        exit,
        setElement: (next: Element | null): void => {
            element = next
        },
        restore: (): void => {
            for (const key of [...Object.keys(documentProperties), elementKey]) {
                Reflect.deleteProperty(document, key)
            }
            Reflect.deleteProperty(document.documentElement, requestKey)
        },
    }
}
