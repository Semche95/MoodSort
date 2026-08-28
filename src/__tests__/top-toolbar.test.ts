import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Container, Texture } from 'pixi.js'
import { CardStateService } from '../services/CardStateService'
import { InMemoryStore } from './InMemoryStore'
import { TopToolbar, loadToolbarIconTextures, TOOLBAR_ICONS } from '../ui/top-toolbar'
import type { ToolbarHost } from '../ui/top-toolbar'

const { pixi, ui, buttons } = vi.hoisted(() => {
    class Texture {
        source: string = ''
    }

    class Container {
        label: string = ''
        x: number = 0
        y: number = 0
        width: number = 0
        height: number = 0
        parent: unknown = null
        children: unknown[] = []
        position: { x: number; y: number; set(x: number, y: number): void } = {
            x: 0,
            y: 0,
            set: (x: number, y: number): void => {
                this.x = x
                this.y = y
            },
        }
        addChild(child: unknown): unknown {
            this.children.push(child)
            return child
        }
    }

    class Graphics extends Container {
        fillAlpha: number = 0
        circle(): this {
            return this
        }
        roundRect(): this {
            return this
        }
        clear(): this {
            return this
        }
        stroke(): this {
            return this
        }
        fill(options: { alpha?: number } = {}): this {
            this.fillAlpha = options.alpha ?? 1
            return this
        }
    }

    class Sprite extends Container {
        anchor: { set(x: number, y: number): void } = {
            set: (): void => {},
        }
        tint: number = 0
        alpha: number = 1
    }

    class Text extends Container {
        anchor: { x: number; y: number; set(x: number, y: number): void } = {
            x: 0,
            y: 0,
            set: (x: number, y: number): void => {
                this.anchor.x = x
                this.anchor.y = y
            },
        }
        text: unknown
        constructor(options: { text?: unknown } = {}) {
            super()
            this.text = options.text
        }
    }

    class Rectangle {
        x: number
        y: number
        width: number
        height: number
        constructor(x: number, y: number, width: number, height: number) {
            this.x = x
            this.y = y
            this.width = width
            this.height = height
        }
    }

    class Application {
        renderer: unknown = null
    }

    class FederatedPointerEvent {}

    const Assets = {
        load: async (): Promise<unknown> => new Texture(),
    }

    const buttons: FancyButton[] = []

    class FancyButton {
        enabled: boolean = true
        label: string = ''
        x: number = 0
        y: number = 0
        iconView: unknown = null
        options: Record<string, unknown>
        private onPressCallback: (() => void) | null = null
        private onHoverCallback: (() => void) | null = null
        private onOutCallback: (() => void) | null = null
        position: { set(x: number, y: number): void } = {
            set: (x: number, y: number): void => {
                this.x = x
                this.y = y
            },
        }
        onPress: { connect(fn: () => void): void } = {
            connect: (fn: () => void): void => {
                this.onPressCallback = fn
            },
        }
        onHover: { connect(fn: () => void): void } = {
            connect: (fn: () => void): void => {
                this.onHoverCallback = fn
            },
        }
        onOut: { connect(fn: () => void): void } = {
            connect: (fn: () => void): void => {
                this.onOutCallback = fn
            },
        }
        constructor(options: Record<string, unknown> = {}) {
            this.options = options
            this.iconView = options.icon
            buttons.push(this)
        }
        press(): void {
            if (this.onPressCallback !== null) {
                this.onPressCallback()
            }
        }
        hover(): void {
            if (this.onHoverCallback !== null) {
                this.onHoverCallback()
            }
        }
        out(): void {
            if (this.onOutCallback !== null) {
                this.onOutCallback()
            }
        }
    }

    return {
        pixi: {
            Application,
            Assets,
            Container,
            FederatedPointerEvent,
            Graphics,
            Rectangle,
            Sprite,
            Text,
            Texture,
        },
        ui: { FancyButton },
        buttons,
    }
})

vi.mock('pixi.js', () => ({ ...pixi }))
vi.mock('@pixi/ui', () => ({ FancyButton: ui.FancyButton }))

interface TestHost extends ToolbarHost {
    historyChange: () => void
    resize: () => void
    setUndoAvailable(value: boolean): void
    setRedoAvailable(value: boolean): void
    setWidth(value: number): void
}

function createHost(initial: { width?: number } = {}): TestHost {
    let onHistoryChange = (): void => {}
    let onResize = (): void => {}
    const state = {
        canUndo: false,
        canRedo: false,
        width: initial.width ?? 800,
    }

    return {
        stage: new pixi.Container() as unknown as Container,
        get screenWidth(): number {
            return state.width
        },
        screenHeight: 600,
        get canUndo(): boolean {
            return state.canUndo
        },
        get canRedo(): boolean {
            return state.canRedo
        },
        undo: vi.fn((): void => {
            state.canUndo = false
            state.canRedo = true
        }),
        redo: vi.fn((): void => {
            state.canRedo = false
            state.canUndo = true
        }),
        resetPositions: vi.fn(),
        setOnHistoryChange: (callback: () => void): void => {
            onHistoryChange = callback
        },
        registerOnResize: (callback: () => void): void => {
            onResize = callback
        },
        historyChange: (): void => {
            onHistoryChange()
        },
        resize: (): void => {
            onResize()
        },
        setUndoAvailable: (value: boolean): void => {
            state.canUndo = value
        },
        setRedoAvailable: (value: boolean): void => {
            state.canRedo = value
        },
        setWidth: (value: number): void => {
            state.width = value
        },
    }
}

function createStore(): CardStateService {
    return new CardStateService(new InMemoryStore())
}

function createTextures(): Record<string, Texture> {
    return {
        'undo-2': new pixi.Texture() as unknown as Texture,
        'redo-2': new pixi.Texture() as unknown as Texture,
        'sliders-horizontal': new pixi.Texture() as unknown as Texture,
    }
}

describe('TopToolbar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        buttons.length = 0
    })

    it('should add the toolbar container to the host stage with logo and four buttons', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        expect(host.stage.children).toHaveLength(1)
        expect(buttons).toHaveLength(4)
        expect(buttons.map((button: { label: string }): string => button.label)).toEqual([
            'toolbar-undobutton',
            'toolbar-redobutton',
            'toolbar-helpbutton',
            'toolbar-settingsbutton',
        ])
    })

    it('should pin the buttons to the right edge on construction', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        const [undo, redo, help, settings] = buttons
        expect(undo.x).toBe(800 - 16 - 24 - 3 * 56)
        expect(redo.x).toBe(800 - 16 - 24 - 2 * 56)
        expect(help.x).toBe(800 - 16 - 24 - 56)
        expect(settings.x).toBe(800 - 16 - 24)
        expect(undo.y).toBe(40)
        expect(settings.y).toBe(40)
    })

    it('should render the mask emoji logo aligned with the MoodSort title', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        const toolbar = host.stage.children[0] as { children: unknown[] }
        const logo = toolbar.children[0] as { children: unknown[] }
        const [emoji, title] = logo.children as Array<{
            text: unknown
            anchor: { x: number; y: number }
            y: number
        }>

        expect(emoji.text).toBe('🎭')
        expect(title.text).toBe('MoodSort')
        expect(emoji.anchor.x).toBe(0)
        expect(emoji.anchor.y).toBe(0.5)
        expect(title.anchor.y).toBe(0.5)
        expect(emoji.y).toBe(title.y)
    })

    it('should scale button icons to about half the button size', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        const [undo, redo, help, settings] = buttons
        for (const button of [undo, redo, settings]) {
            expect((button as unknown as { options: Record<string, unknown> }).options.defaultIconScale)
                .toBeCloseTo(22 / 64)
        }
        expect((help as unknown as { options: Record<string, unknown> }).options.defaultIconScale).toBe(1)
    })

    it('should render the help button icon as a plain question mark text', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        expect((buttons[2].iconView as { text: unknown }).text).toBe('?')
    })

    it('should render the help button with a background circle like the other buttons', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        const [, , help, settings] = buttons
        const helpOptions = help as unknown as { options: Record<string, unknown> }
        const helpView = helpOptions.options.defaultView as { fillAlpha: number }
        const settingsOptions = settings as unknown as { options: Record<string, unknown> }
        const settingsView = settingsOptions.options.defaultView as { fillAlpha: number }

        expect(helpView.fillAlpha).toBe(0.85)
        expect(settingsView.fillAlpha).toBe(0.85)
    })

    it('should disable undo/redo buttons when the history is empty', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        const [undo, redo, help, settings] = buttons
        expect(undo.enabled).toBe(false)
        expect(redo.enabled).toBe(false)
        expect(help.enabled).toBe(true)
        expect(settings.enabled).toBe(true)
        expect((undo.iconView as { alpha: number }).alpha).toBe(0.35)
        expect((redo.iconView as { alpha: number }).alpha).toBe(0.35)
    })

    it('should trigger the host undo action when the undo button is pressed', () => {
        const host = createHost()
        host.setUndoAvailable(true)
        new TopToolbar(host, createStore(), createTextures())

        buttons[0].press()

        expect(host.undo).toHaveBeenCalledOnce()
        expect(buttons[0].enabled).toBe(false)
    })

    it('should update enabled states when history availability changes', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        host.setUndoAvailable(true)
        host.setRedoAvailable(true)
        host.historyChange()

        expect(buttons[0].enabled).toBe(true)
        expect(buttons[1].enabled).toBe(true)
        expect((buttons[0].iconView as { alpha: number }).alpha).toBe(1)

        host.setUndoAvailable(false)
        host.historyChange()

        expect(buttons[0].enabled).toBe(false)
    })

    it('should re-anchor the buttons to the right edge on resize', () => {
        const host = createHost({ width: 800 })
        new TopToolbar(host, createStore(), createTextures())

        host.setWidth(1200)
        host.resize()

        const [undo, , , settings] = buttons
        expect(undo.x).toBe(1200 - 16 - 24 - 3 * 56)
        expect(settings.x).toBe(1200 - 16 - 24)

        const toolbar = host.stage.children[0] as { children: unknown[] }
        const logo = toolbar.children[0] as { x: number; y: number }
        expect(logo.x).toBe(16)
        expect(logo.y).toBe(16 + 28 / 2)
    })

    it('should show a tooltip with the button label on hover, anchored below the button', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        const [undo] = buttons
        undo.hover()

        const toolbar = host.stage.children[0] as { children: unknown[] }
        const tooltip = toolbar.children[toolbar.children.length - 1] as {
            visible: boolean
            x: number
            y: number
            children: Array<{ text?: unknown }>
        }
        expect(tooltip.visible).toBe(true)
        expect(tooltip.x).toBe(undo.x)
        expect(tooltip.children[1].text).toBe('Annuler')
    })

    it('should hide the tooltip on pointer out, on press, and on resize', () => {
        const host = createHost()
        new TopToolbar(host, createStore(), createTextures())

        const [undo] = buttons
        const toolbar = host.stage.children[0] as { children: unknown[] }
        const tooltip = toolbar.children[toolbar.children.length - 1] as { visible: boolean }

        undo.hover()
        expect(tooltip.visible).toBe(true)
        undo.out()
        expect(tooltip.visible).toBe(false)

        undo.hover()
        expect(tooltip.visible).toBe(true)
        undo.press()
        expect(tooltip.visible).toBe(false)

        undo.hover()
        expect(tooltip.visible).toBe(true)
        host.resize()
        expect(tooltip.visible).toBe(false)
    })

    it('should load a texture for every toolbar icon', async () => {
        const textures = await loadToolbarIconTextures()

        for (const name of TOOLBAR_ICONS) {
            expect(textures[name]).toBeInstanceOf(pixi.Texture)
        }
        expect(Object.keys(textures)).toHaveLength(TOOLBAR_ICONS.length)
    })
})