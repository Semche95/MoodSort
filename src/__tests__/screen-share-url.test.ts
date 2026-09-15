import { describe, expect, it } from 'vitest'
import { buildRoomUrl, getRoomCodeFromHash } from '../features/screen-share/screen-share-url'

describe('buildRoomUrl', () => {
    it('appends the room fragment to the current page URL', () => {
        const url = buildRoomUrl('AB12CD', 'https://moodsort.fr/')

        expect(url).toBe('https://moodsort.fr/#room=AB12CD')
    })

    it('replaces any existing fragment', () => {
        const url = buildRoomUrl('AB12CD', 'https://moodsort.fr/#room=ZZZZZZ')

        expect(url).toBe('https://moodsort.fr/#room=AB12CD')
    })
})

describe('getRoomCodeFromHash', () => {
    it('extracts the room code from a valid fragment', () => {
        expect(getRoomCodeFromHash('#room=AB12CD')).toBe('AB12CD')
    })

    it('returns null when there is no fragment', () => {
        expect(getRoomCodeFromHash('')).toBeNull()
    })

    it('returns null for a malformed fragment', () => {
        expect(getRoomCodeFromHash('#room=short')).toBeNull()
        expect(getRoomCodeFromHash('#foo=AB12CD')).toBeNull()
    })
})
