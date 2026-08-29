import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupCanvas } from '../bootstrap'
import { InMemoryStore } from './in-memory-store'
import { CardStateService } from '../services/card-state-service'

import * as PIXI from 'pixi.js'
import type { Spritesheet } from 'pixi.js'

type MockSpritesheet = Pick<Spritesheet, 'textures' | 'parse'>

const { mockTexture, mockSpritesheet } = vi.hoisted(() => {
    const mockTexture = { width: 200, height: 300 }
    const mockSpritesheet: MockSpritesheet = {
        textures: {
            'card-1': mockTexture as PIXI.Texture,
            'card-2': mockTexture as PIXI.Texture,
        },
        parse: vi.fn().mockResolvedValue(undefined),
    }
    return { mockTexture, mockSpritesheet }
})

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
        ticker: {
            add: vi.fn(),
        },
        init: vi.fn().mockResolvedValue({}),
        canvas: document.createElement('canvas'),
    }

    return {
        Application: vi.fn(() => mockApp),
        Spritesheet: vi.fn(() => mockSpritesheet),
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
            addChildAt(child: unknown, index: number): unknown {
                this.children.splice(index, 0, child);
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
            load: vi.fn().mockResolvedValue(mockTexture),
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
        Text: class MockText {
            text: string
            width: number = 40
            height: number = 16
            label: string = ''
            visible: boolean = true
            eventMode: string = 'auto'
            x: number = 0
            y: number = 0
            children: unknown[] = []
            anchor: { set(x: number, y: number): void } = { set: vi.fn() }
            position: { set(x: number, y: number): void } = {
                set: (x: number, y: number): void => {
                    this.x = x
                    this.y = y
                },
            }
            constructor(options: { text?: string } = {}) {
                this.text = options.text ?? ''
            }
            addChild(child: unknown): unknown {
                this.children.push(child)
                return child
            }
        },
        BlurFilter: class MockBlurFilter {
            constructor() {}
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

describe('Bootstrap', () => {
    describe('setupCanvas', () => {
        it('should create a PixiJS application', async () => {
            const frameNames: string[] = ['card-1', 'card-2']
            await setupCanvas(frameNames, mockSpritesheet as Spritesheet, new CardStateService(new InMemoryStore()))

            expect(PIXI.Application).toHaveBeenCalled()
        })

        it('should throw an error if no images are provided', async () => {
            const frameNames: string[] = []
            await expect(setupCanvas(frameNames, mockSpritesheet as Spritesheet, new CardStateService(new InMemoryStore()))).rejects.toThrow('No images found')
        })
    })
})
