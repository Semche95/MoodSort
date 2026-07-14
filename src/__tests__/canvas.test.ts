import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupCanvas } from '../utils/canvas'
import { InMemoryStore } from '../services/Store'
import { CardStateService } from '../services/CardStateService'

import * as PIXI from 'pixi.js'

vi.mock('pixi.js', () => {
    const mockApp: Record<string, unknown> = {
        stage: {
            addChild: vi.fn(),
            addChildAt: vi.fn(),
            removeChild: vi.fn(),
            children: [],
            on: vi.fn(),
            off: vi.fn(),
            eventMode: 'none',
            hitArea: null,
        },
        screen: {
            width: 800,
            height: 600,
        },
        renderer: {
            resize: vi.fn(),
        },
        init: vi.fn().mockResolvedValue({}),
        canvas: document.createElement('canvas'),
    }

    return {
        Application: vi.fn(() => mockApp),
        Container: class MockContainer {
            children: unknown[] = []
            x: number = 0
            y: number = 0
            width: number = 200
            height: number = 300
            scale: { set(v: number): void } = { set: vi.fn() }
            on(): this { return this }
            off(): this { return this }
            addChild(child: unknown): unknown {
                this.children.push(child);
                (child as Record<string, unknown>).parent = this
                return child
            }
            removeChild(child: unknown): unknown {
                const index: number = this.children.indexOf(child)
                if (index !== -1) {
                    this.children.splice(index, 1);
                    (child as Record<string, unknown>).parent = null
                }
                return child
            }
        },
        Assets: {
            load: vi.fn().mockImplementation(() =>
                Promise.resolve({ width: 200, height: 300 }),
            ),
        },
        Sprite: class MockSprite {
            constructor(texture: Record<string, unknown>) {
                this.texture = texture
            }
            texture: unknown = null
            x: number = 0
            y: number = 0
            width: number = 200
            height: number = 300
            alpha: number = 1
            parent: unknown = null
            eventMode: string = 'none'
            cursor: string = 'default'
            scale: { set(v: number): void } = { set: vi.fn() }
            on(): this { return this }
            tint: number = 0xFFFFFF
            imageUrl: string = ''
            innerSprite: unknown = null
            getGlobalPosition: () => { x: number, y: number } = vi.fn().mockReturnValue({ x: 0, y: 0 })
            position: { set(x: number, y: number): void } = { set: vi.fn() }
        },
        Graphics: class MockGraphics {
            parent: unknown = null
            eventMode: string = 'none'
            cursor: string = 'default'
            roundRect(): this { return this }
            rect(): this { return this }
            fill(): this { return this }
            stroke(): this { return this }
            clear(): this { return this }
            on(): this { return this }
            off(): this { return this }
            filters: unknown[] = []
            x: number = 0
            y: number = 0
        },
        BlurFilter: class MockBlurFilter {
            constructor(_options?: Record<string, unknown>) {}
        },
        FederatedPointerEvent: class MockFederatedPointerEvent {
            constructor(type: string, options: Record<string, unknown>) {
                this.type = type
                this.global = (options?.global as Record<string, number>) || { x: 0, y: 0 }
            }
            type: string = ''
            global: Record<string, number> = { x: 0, y: 0 }
            stopPropagation(): void {}
        },
    }
})

beforeEach(() => {
    vi.clearAllMocks()
})

describe('Canvas Utilities', () => {
    describe('setupCanvas', () => {
        it('should create a PixiJS application', async () => {
            const images: string[] = ['image1.png', 'image2.png']
            await setupCanvas(images, new CardStateService(new InMemoryStore()))

            expect(PIXI.Application).toHaveBeenCalled()
        })

        it('should load images and create cards', async () => {
            const images: string[] = ['image1.png', 'image2.png']
            await setupCanvas(images, new CardStateService(new InMemoryStore()))

            expect(PIXI.Assets.load).toHaveBeenCalledTimes(images.length)
        })

        it('should throw an error if no images are provided', async () => {
            const images: string[] = []
            await expect(setupCanvas(images, new CardStateService(new InMemoryStore()))).rejects.toThrow('No images found')
        })
    })
})
