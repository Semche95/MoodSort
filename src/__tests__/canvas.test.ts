import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupCanvas } from '../utils/canvas'

import * as PIXI from 'pixi.js'

vi.mock('pixi.js', () => {
    const mockApp: Record<string, unknown> = {
        stage: {
            addChild: vi.fn(),
            removeChild: vi.fn(),
            children: [],
            on: vi.fn(),
            eventMode: 'none',
            hitArea: null,
        },
        renderer: {
            view: {
                style: {},
            },
            resize: vi.fn(),
        },
        screen: {
            width: 800,
            height: 600,
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
            background: unknown = null
            on(): this { return this }
            off(): this { return this }

            addChild(child: unknown): unknown {
                this.children.push(child);
                (child as Record<string, unknown>).parent = this
                if (this.children.length === 1) {
                    this.background = child
                }
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

            removeChildAt(index: number): unknown {
                const child: unknown = this.children.splice(index, 1)[0]
                if (child) {
                    (child as Record<string, unknown>).parent = null
                }
                return child
            }

            getChildAt(index: number): unknown {
                return this.children[index] || this.background
            }
        },
        Graphics: class MockGraphics {
            clear(): this {
                return this
            }
            beginFill(): this {
                return this
            }
            lineStyle(): this {
                return this
            }
            drawRoundedRect(): this {
                return this
            }
            endFill(): this {
                return this
            }
            removeChildren(): this {
                return this
            }
            eventMode: string = 'none'
            cursor: string = 'default'
            on(): this {
                return this
            }
            children: unknown[] = []
            getChildAt(): unknown {
                return null
            }
            getBounds(): Record<string, number> {
                return { x: 0, y: 0, width: 100, height: 100 }
            }
            fill(): this {
                return this
            }
            roundRect(): this {
                return this
            }
            beginPath(): this {
                return this
            }
            moveTo(): this {
                return this
            }
            lineTo(): this {
                return this
            }
            arc(): this {
                return this
            }
            closePath(): this {
                return this
            }
            stroke(): this {
                return this
            }
            rect(): this {
                return this
            }
            addChild(): this {
                return this
            }
        },
        Text: class MockText {
            constructor(text: string, style: Record<string, unknown>) {
                this.text = text
                this.style = style
            }

            text: string = ''
            style: Record<string, unknown> = {}
            x: number = 0
            y: number = 0
        },
        Assets: {
            load: vi.fn().mockImplementation(() =>
                Promise.resolve({
                    width: 200,
                    height: 300,
                }),
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
            on(): this {
                return this
            }
        },
        FederatedPointerEvent: class MockFederatedPointerEvent {
            constructor(type: string, options: Record<string, unknown>) {
                this.type = type
                this.global = (options?.global as Record<string, number>) || {
                    x: 0,
                    y: 0,
                }
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
            await setupCanvas(images)

            expect(PIXI.Application).toHaveBeenCalled()
        })

        it('should load images and create cards', async () => {
            const images: string[] = ['image1.png', 'image2.png']
            await setupCanvas(images)

            expect(PIXI.Assets.load).toHaveBeenCalledTimes(images.length)
        })
    })
})
