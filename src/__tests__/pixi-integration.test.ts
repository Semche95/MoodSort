import { describe, it, expect, vi, beforeEach } from 'vitest'
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
            width: number = 0
            height: number = 0
            eventMode: string = 'none'
            addChild(child: unknown): unknown {
                this.children.push(child)
                ;(child as Record<string, unknown>).parent = this
                return child
            }
            addChildAt(child: unknown, index: number): unknown {
                this.children.splice(index, 0, child)
                ;(child as Record<string, unknown>).parent = this
                return child
            }
            removeChild(child: unknown): unknown {
                const index: number = this.children.indexOf(child)
                if (index !== -1) {
                    this.children.splice(index, 1)
                    ;(child as Record<string, unknown>).parent = null
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
                return this.children[index]
            }
            on(): this { return this }
        },
        Graphics: class MockGraphics {
            clear(): this { return this }
            beginFill(): this { return this }
            lineStyle(): this { return this }
            drawRoundedRect(): this { return this }
            endFill(): this { return this }
            removeChildren(): this { return this }
            eventMode: string = 'none'
            cursor: string = 'default'
            on(): this { return this }
            children: unknown[] = []
            getChildAt(): unknown { return null }
            getBounds(): Record<string, number> { return { x: 0, y: 0, width: 100, height: 100 } }
            fill(): this { return this }
            roundRect(): this { return this }
            beginPath(): this { return this }
            moveTo(): this { return this }
            lineTo(): this { return this }
            arc(): this { return this }
            closePath(): this { return this }
            stroke(): this { return this }
            rect(): this { return this }
            addChild(): this { return this }
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
            load: vi.fn().mockImplementation(() => Promise.resolve({
                width: 200,
                height: 300,
            })),
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
            on(): this { return this }
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

describe('PixiJS Integration', () => {
    describe('Application Initialization', () => {
        it('should create a PixiJS application with correct settings', async () => {
            const images: string[] = ['image1.png', 'image2.png']
            await setupCanvas(images)

            // Check if Application constructor was called
            expect(PIXI.Application).toHaveBeenCalled()

            // Check if app.init was called with the correct settings
            const app: PIXI.Application = new PIXI.Application()
            expect(vi.mocked(app.init)).toHaveBeenCalledWith({
                antialias: true,
                backgroundColor: '#a9a9a9',
                resizeTo: window,
            })
        })

        it('should append the canvas to the document body', async () => {
            // eslint-disable-next-line @typescript-eslint/typedef
            const appendChildSpy = vi.spyOn(document.body, 'appendChild')
            const images: string[] = ['image1.png', 'image2.png']
            await setupCanvas(images)

            // Check if the canvas was appended to the document body
            expect(appendChildSpy).toHaveBeenCalled()
        })
    })

    describe('Event Handling', () => {
        it('should set up event handlers for the stage', async () => {
            const images: string[] = ['image1.png', 'image2.png']
            await setupCanvas(images)

            const app: PIXI.Application = new PIXI.Application()

            // Check if the stage is set to be interactive
            expect(app.stage.eventMode).toBe('static')

            // Check if event handlers are set up for the stage
            expect(vi.mocked(app.stage.on)).toHaveBeenCalledWith('pointerup', expect.any(Function))
            expect(vi.mocked(app.stage.on)).toHaveBeenCalledWith('pointerupoutside', expect.any(Function))
        })

    })

    describe('Asset Loading', () => {
        it('should load images and create cards', async () => {
            const images: string[] = ['image1.png', 'image2.png']
            await setupCanvas(images)

            // Check if Assets.load was called for each image
            expect(PIXI.Assets.load).toHaveBeenCalledTimes(images.length)

            // Check if Assets.load was called with the correct arguments
            for (const image of images) {
                expect(PIXI.Assets.load).toHaveBeenCalledWith(image)
            }
        })

        it('should throw an error if no images are provided', async () => {
            const images: string[] = []
            await expect(setupCanvas(images)).rejects.toThrow('No images found')
        })
    })

    describe('Deck Creation', () => {
        it('should create an initial deck', async () => {
            const images: string[] = ['image1.png', 'image2.png']
            await setupCanvas(images)

            const app: PIXI.Application = new PIXI.Application()

            // Check if a deck was added to the stage
            expect(vi.mocked(app.stage.addChild)).toHaveBeenCalled()
        })
    })
})
