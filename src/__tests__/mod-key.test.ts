import { describe, it, expect } from 'vitest'
import { isModKeyPressed } from '../shared/utils/mod-key'

describe('isModKeyPressed', () => {
    it('accepts Ctrl or Cmd', () => {
        expect(isModKeyPressed({ ctrlKey: true, metaKey: false })).toBe(true)
        expect(isModKeyPressed({ ctrlKey: false, metaKey: true })).toBe(true)
    })

    it('rejects an event with neither held', () => {
        expect(isModKeyPressed({ ctrlKey: false, metaKey: false })).toBe(false)
    })
})
