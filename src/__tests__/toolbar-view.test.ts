import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Texture } from 'pixi.js'
import type { CanvasTooltip } from '../shared/ui/canvas-tooltip'
import type { BrandingTextures } from '../types/branding-textures.types'
import { applyButtonTheme, applyLogoTheme, createButton, createCircleView, createLogo, createShareButton, setButtonEnabled } from '../features/toolbar/toolbar-view'

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
        fillColor: number | undefined
        fills: Array<{ alpha: number; color: number | undefined }> = []
        circles: Array<{ x: number; y: number; radius: number }> = []
        strokeColor: number | undefined
        visible: boolean = true
        circle(x: number, y: number, radius: number): this {
            this.circles.push({ x, y, radius })
            return this
        }
        roundRect(): this {
            return this
        }
        clear(): this {
            return this
        }
        fill(options: { alpha?: number; color?: number } = {}): this {
            this.fillAlpha = options.alpha ?? 1
            this.fillColor = options.color
            this.fills.push({ alpha: this.fillAlpha, color: options.color })
            return this
        }
        stroke(options: { color?: number } = {}): this {
            this.strokeColor = options.color
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
        style: Record<string, unknown>
        width: number
        constructor(options: { text?: unknown; style?: Record<string, unknown> } = {}) {
            super()
            this.text = options.text
            this.width = String(options.text ?? '').length * 10
            this.style = options.style ?? {}
        }
    }

    const buttons: FancyButton[] = []

    class FancyButton {
        enabled: boolean = true
        label: string = ''
        x: number = 10
        y: number = 20
        iconView: unknown = null
        innerView: { addChild(child: unknown): unknown } = { addChild: (child: unknown): unknown => child }
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

    class Sprite extends Container {
        texture: unknown
        scale: { x: number; set(v: number): void } = {
            x: 1,
            set: (v: number): void => {
                this.scale.x = v
            },
        }
        anchor: { x: number; y: number; set(x: number, y: number): void } = {
            x: 0,
            y: 0,
            set: (x: number, y: number): void => {
                this.anchor.x = x
                this.anchor.y = y
            },
        }
        tint: number = 0
        alpha: number = 1
        filters: unknown[] = []
        width: number = 20
        height: number = 20
        constructor(texture?: unknown) {
            super()
            this.texture = texture
        }
    }

    return {
        pixi: { BlurFilter: class MockBlurFilter {}, Container, Graphics, Text, Sprite },
        ui: { FancyButton },
        buttons,
    }
})

vi.mock('pixi.js', () => ({ ...pixi }))
vi.mock('@pixi/ui', () => ({ FancyButton: ui.FancyButton }))

function logoTextures(): BrandingTextures {
    return { logo: {} as Texture, titleAccent: { height: 60 } as Texture, titleRest: { height: 60 } as Texture }
}

function createFakeTooltip(): CanvasTooltip {
    return { show: vi.fn(), hide: vi.fn() } as unknown as CanvasTooltip
}

describe('toolbar-view', () => {
    beforeEach(() => {
        buttons.length = 0
    })

    it('draws a filled circle at the button size', () => {
        const view = createCircleView(0xffffff, 0.85) as unknown as { fillAlpha: number; circles: Array<{ radius: number }> }

        expect(view.fillAlpha).toBe(0.85)
        expect(view.circles).toEqual([{ x: 24, y: 24, radius: 24 }])
    })

    it('draws a slightly lowered shadow circle under the button when a shadow is given', () => {
        const view = createCircleView(0xffffff, 0.85, { color: 0x112233, alpha: 0.2 }) as unknown as {
            fills: Array<{ alpha: number; color: number }>
            circles: Array<{ x: number; y: number; radius: number }>
        }

        expect(view.fills).toEqual([{ alpha: 0.2, color: 0x112233 }, { alpha: 0.85, color: 0xffffff }])
        expect(view.circles[0].y).toBeGreaterThan(view.circles[1].y)
        expect(view.circles[0].x).toBe(view.circles[1].x)
    })

    it('builds a logo with the image and the two MoodSort title images stacked on the same center line', () => {
        const textures = logoTextures()
        const logo = createLogo(textures) as unknown as { children: Array<{ texture: unknown; anchor: { x: number; y: number }; x: number; y: number }> }
        const [, image, titleAccent, titleRest] = logo.children

        expect(image).toBeInstanceOf(pixi.Sprite)
        expect(image.texture).toBe(textures.logo)
        expect(titleAccent).toBeInstanceOf(pixi.Sprite)
        expect(titleRest).toBeInstanceOf(pixi.Sprite)
        expect(titleAccent.texture).toBe(textures.titleAccent)
        expect(titleRest.texture).toBe(textures.titleRest)
        expect(image.anchor.x).toBe(0)
        expect(image.anchor.y).toBe(0.5)
        expect(titleAccent.anchor.y).toBe(0.5)
        expect(titleRest.anchor.y).toBe(0.5)
        expect(image.y).toBe(titleAccent.y)
        expect(image.y).toBe(titleRest.y)
    })

    it('sizes the logo image as a square and starts both title images right after it', () => {
        const logo = createLogo(logoTextures()) as unknown as { children: Array<{ x: number; width: number; height: number }> }
        const [, image, titleAccent, titleRest] = logo.children

        expect(image.width).toBe(32)
        expect(image.height).toBe(32)
        expect(titleAccent.x).toBe(32 + 10)
        expect(titleRest.x).toBe(titleAccent.x)
    })

    it('scales the title images down to the title height whatever their source resolution', () => {
        const logo = createLogo(logoTextures()) as unknown as { children: Array<{ scale: { x: number } }> }
        const [, , titleAccent, titleRest] = logo.children

        expect(titleAccent.scale.x).toBe(18 / 60)
        expect(titleRest.scale.x).toBe(18 / 60)
    })

    it('tints "Mood" with the accent color and "Sort" with the title color', () => {
        const logo = createLogo(logoTextures(), 'light') as unknown as { children: Array<{ tint: number }> }
        const [, , titleAccent, titleRest] = logo.children

        expect(titleAccent.tint).toBe(0xb4462c)
        expect(titleRest.tint).toBe(0x4f342a)
    })

    it('draws a blurred, slightly lowered copy of the logo image behind it, tinted with the theme shadow color', () => {
        const textures = logoTextures()
        const logo = createLogo(textures, 'light') as unknown as { children: Array<{ texture: unknown; tint: number; alpha: number; filters: unknown[]; y: number; width: number; height: number }> }
        const [shadow, image] = logo.children

        expect(shadow).toBeInstanceOf(pixi.Sprite)
        expect(shadow.texture).toBe(textures.logo)
        expect(shadow.width).toBe(image.width)
        expect(shadow.height).toBe(image.height)
        expect(shadow.y).toBeGreaterThan(image.y)
        expect(shadow.filters).toHaveLength(1)
        expect(shadow.tint).toBe(0x4f342a)
        expect(shadow.alpha).toBe(0.7)
    })

    it('re-themes the logo shadow in place', () => {
        const logo = createLogo(logoTextures(), 'light')
        const [shadow] = (logo as unknown as { children: Array<{ tint: number; alpha: number }> }).children

        applyLogoTheme(logo, 'dark')

        expect(shadow.tint).toBe(0x000000)
        expect(shadow.alpha).toBe(0.4)
    })

    it('re-tints both title images of the logo in place', () => {
        const logo = createLogo(logoTextures(), 'light')
        const [, , titleAccent, titleRest] = (logo as unknown as { children: Array<{ tint: number }> }).children

        applyLogoTheme(logo, 'dark')

        expect(titleAccent.tint).toBe(0xe9775a)
        expect(titleRest.tint).toBe(0xf3dccb)
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

    it('shows the current accessible title on hover when it was changed after creation', () => {
        const tooltip = createFakeTooltip()

        const button = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'my-button', 'My label')
        const fake = button as unknown as { hover(): void; accessibleTitle: string; x: number; y: number }
        fake.accessibleTitle = 'Updated label'

        fake.hover()
        expect(tooltip.show).toHaveBeenCalledWith(fake.x, fake.y + 48 / 2 + 8, 'Updated label')
    })

    it('defaults the icon scale to roughly a third of the button size, unless overridden', () => {
        const tooltip = createFakeTooltip()

        const defaultScale = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'a', 'A') as unknown as { options: Record<string, unknown> }
        const overriddenScale = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'b', 'B', 1) as unknown as { options: Record<string, unknown> }

        expect(defaultScale.options.defaultIconScale).toBeCloseTo(22 / 64)
        expect(overriddenScale.options.defaultIconScale).toBe(1)
    })

    it('tints the logo title with the dark theme palette when built for the dark theme', () => {
        const logo = createLogo(logoTextures(), 'dark') as unknown as { children: Array<{ tint: number }> }
        const [, , titleAccent, titleRest] = logo.children

        expect(titleAccent.tint).toBe(0xe9775a)
        expect(titleRest.tint).toBe(0xf3dccb)
    })

    it('draws button state views with the dark theme palette when built for the dark theme', () => {
        const tooltip = createFakeTooltip()

        const button = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'my-button', 'My label', undefined, 'dark') as unknown as {
            options: { defaultView: { fillColor: number }; hoverView: { fillColor: number }; pressedView: { fillColor: number }; disabledView: { fillColor: number } }
        }

        expect(button.options.defaultView.fillColor).toBe(0x4a4350)
        expect(button.options.hoverView.fillColor).toBe(0x564e5d)
        expect(button.options.pressedView.fillColor).toBe(0x352f3a)
        expect(button.options.disabledView.fillColor).toBe(0x4a4350)
    })

    it('casts a shadow under the resting and hovered views only, so a pressed or disabled button looks flat', () => {
        const tooltip = createFakeTooltip()

        const button = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'my-button', 'My label') as unknown as {
            options: Record<'defaultView' | 'hoverView' | 'pressedView' | 'disabledView', { fills: unknown[] }>
        }

        expect(button.options.defaultView.fills).toHaveLength(2)
        expect(button.options.hoverView.fills).toHaveLength(2)
        expect(button.options.pressedView.fills).toHaveLength(1)
        expect(button.options.disabledView.fills).toHaveLength(1)
    })

    it('swaps a button\'s state views to the new theme palette in place', () => {
        const tooltip = createFakeTooltip()
        const button = createButton(tooltip, new pixi.Container() as never, vi.fn(), 'my-button', 'My label', undefined, 'light')

        applyButtonTheme(button, 'dark')

        expect((button as unknown as { defaultView: { fillColor: number } }).defaultView.fillColor).toBe(0x4a4350)
    })

    it('tints the share button icon and its status dots with the dark theme palette', () => {
        const tooltip = createFakeTooltip()
        const icon = new pixi.Sprite() as unknown as { tint: number }

        const { activeIndicator, viewerIndicator } = createShareButton(tooltip, icon as never, vi.fn(), 'Share', 'Share', 'dark')

        expect(icon.tint).toBe(0xffffff)
        expect((activeIndicator as unknown as { strokeColor: number }).strokeColor).toBe(0x1a1a1a)
        expect((viewerIndicator as unknown as { strokeColor: number }).strokeColor).toBe(0x1a1a1a)
    })
})
