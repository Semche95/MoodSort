import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withTimeout } from '../features/screen-share/with-timeout'

describe('withTimeout', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('resolves with the value of a promise that settles in time', async () => {
        await expect(withTimeout(Promise.resolve('done'), 1000)).resolves.toBe('done')
    })

    it('rejects with the error of a promise that fails in time', async () => {
        const error = new Error('failed')

        await expect(withTimeout(Promise.reject(error), 1000)).rejects.toBe(error)
    })

    it('rejects once the delay elapses before the promise settles', async () => {
        const result = withTimeout(new Promise((): void => {}), 1000)
        const assertion = expect(result).rejects.toThrow('Timed out after 1000 ms')

        await vi.advanceTimersByTimeAsync(1000)

        await assertion
    })

    it('clears its timer once the promise settles', async () => {
        await withTimeout(Promise.resolve(), 1000)

        expect(vi.getTimerCount()).toBe(0)
    })
})
