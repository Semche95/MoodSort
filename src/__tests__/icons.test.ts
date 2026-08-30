import { describe, expect, it, vi } from 'vitest'
import type { Texture } from 'pixi.js'
import { ICON_NAMES, createHelpIcon, createIcon, loadIconTextures } from '../shared/ui/icons'

const { pixi } = vi.hoisted(() => {
    class Texture {
        source: string = ''
    }

    class Container {
        label: string = ''
        children: unknown[] = []
        addChild(child: unknown): unknown {
            this.children.push(child)
            return child
        }
    }

    class Sprite extends Container {
        anchor: { x: number; y: number; set(x: number, y?: number): void } = {
            x: 0,
            y: 0,
            set: (x: number, y: number = x): void => {
                this.anchor.x = x
                this.anchor.y = y
            },
        }
        tint: number = 0
    }

    class Text extends Container {
        text: unknown
        style: Record<string, unknown>
        constructor(options: { text?: unknown; style?: Record<string, unknown> } = {}) {
            super()
            this.text = options.text
            this.style = options.style ?? {}
        }
    }

    const Assets = {
        load: async (): Promise<unknown> => new Texture(),
    }

    return { pixi: { Assets, Container, Sprite, Text, Texture } }
})

vi.mock('pixi.js', () => ({ ...pixi }))

describe('icons', () => {
    it('loads a texture for every known icon', async () => {
        const textures = await loadIconTextures()

        for (const name of ICON_NAMES) {
            expect(textures[name]).toBeInstanceOf(pixi.Texture)
        }
        expect(Object.keys(textures)).toHaveLength(ICON_NAMES.length)
    })

    it('creates an icon sprite centered on its texture and tinted to match the toolbar palette', () => {
        const icon = createIcon(new pixi.Texture() as unknown as Texture)

        const anchor = (icon as unknown as { anchor: { x: number; y: number } }).anchor
        expect(anchor.x).toBe(0.5)
        expect(anchor.y).toBe(0.5)
        expect(icon.tint).toBe(0x111111)
    })

    it('creates the help icon as a plain question mark text', () => {
        const help = createHelpIcon()

        expect((help as unknown as { text: unknown }).text).toBe('?')
        expect((help as unknown as { style: { fill: number } }).style.fill).toBe(0x111111)
    })
})
