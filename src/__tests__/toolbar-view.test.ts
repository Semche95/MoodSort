import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasTooltip } from '../shared/ui/canvas-tooltip'
import { createButton, createCircleView, createLogo, setButtonEnabled } from '../features/toolbar/toolbar-view'

const { pixi, ui, buttons } = vi.hoisted(() => {
    class Container {
        label: string = ''
        x: number = 0
        y: number = 0
        children: unknown[] = []
        position: { set(x: number, y: number): void } = {
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
        fill(options: { alpha?: number } = {}): this {
            this.fillAlpha = options.alpha ?? 1
            return this
        }
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

    const buttons: FancyButton[] = []

    class FancyButton {
        enabled: boolean = true
        label: string = ''
        x: number = 10
        y: number = 20
        iconView: unknown = null
        options: Record<string, unknown>
        private onPressCallback: (() => void) | null = null
        private onHoverCallback: (() => void) | null = null
        private onOutCallback: (() => void) | null = null
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
            this.onPressCallback?.()
        }
        hover(): void {
            this.onHoverCallback?.()
        }
        out(): void {
            this.onOutCallback?.()
        }
    }

    return {
        pixi: { Container, Graphics, Text },
        ui: { FancyButton },
        buttons,
    }
})

vi.mock('pixi.js', () => ({ ...pixi }))
vi.mock('@pixi/ui', () => ({ FancyButton: ui.FancyButton }))

function createFakeTooltip(): CanvasTooltip {
    return { show: vi.fn(), hide: vi.fn() } as unknown as CanvasTooltip
}

describe('toolbar-view', () => {
    beforeEach(() => {
        buttons.length = 0
    })

    it('draws a filled circle at the button size', () => {
        const view = createCircleView(0xffffff, 0.85) as unknown as { fillAlpha: number }

        expect(view.fillAlpha).toBe(0.85)
    })

    it('builds a logo with the emoji and MoodSort title aligned on the same baseline', () => {
        const logo = createLogo() as unknown as { children: Array<{ text: unknown; anchor: { x: number; y: number }; y: number }> }
        const [emoji, title] = logo.children

        expect(emoji.text).toBe('🎭')
        expect(title.text).toBe('MoodSort')
        expect(emoji.anchor.x).toBe(0)
        expect(emoji.anchor.y).toBe(0.5)
        expect(title.anchor.y).toBe(0.5)
        expect(emoji.y).toBe(title.y)
    })

    it('enables a button and restores full icon opacity', () => {
        const tooltip = createFakeTooltip()
        const button = new ui.FancyButton() as unknown as { enabled: boolean }
        const icon = { alpha: 0.35 }

        setButtonEnabled(button as never, icon as never, true, tooltip)

        expect(button.enabled).toBe(true)
        expect(icon.alpha).toBe(1)
        expect(tooltip.hide).not.toHaveBeenCalled()
    })

    it('disables a button, dims its icon, and hides any visible tooltip', () => {
        const tooltip = createFakeTooltip()
        const button = new ui.FancyButton() as unknown as { enabled: boolean }
        const icon = { alpha: 1 }

        setButtonEnabled(button as never, icon as never, false, tooltip)

        expect(button.enabled).toBe(false)
        expect(icon.alpha).toBe(0.35)
        expect(tooltip.hide).toHaveBeenCalledOnce()
    })

    it('creates a button that fires onClick and hides the tooltip on press', () => {
        const tooltip = createFakeTooltip()
        const onClick = vi.fn()

        const button = createButton(tooltip, new pixi.Container() as never, onClick, 'my-button', 'My label')

        expect(button.label).toBe('my-button')
        ;(button as unknown as { press(): void }).press()
        expect(onClick).toHaveBeenCalledOnce()
        expect(tooltip.hide).toHaveBeenCalledOnce()
    })

    it('shows the tooltip below the button on hover, and hides it on pointer out', () => {
        const tooltip = createFakeTooltip()

        const button = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'my-button', 'My label')
        const fake = button as unknown as { hover(): void; out(): void; x: number; y: number }

        fake.hover()
        expect(tooltip.show).toHaveBeenCalledWith(fake.x, fake.y + 48 / 2 + 8, 'My label')

        fake.out()
        expect(tooltip.hide).toHaveBeenCalled()
    })

    it('defaults the icon scale to roughly a third of the button size, unless overridden', () => {
        const tooltip = createFakeTooltip()

        const defaultScale = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'a', 'A') as unknown as { options: Record<string, unknown> }
        const overriddenScale = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'b', 'B', 1) as unknown as { options: Record<string, unknown> }

        expect(defaultScale.options.defaultIconScale).toBeCloseTo(22 / 64)
        expect(overriddenScale.options.defaultIconScale).toBe(1)
    })
})
