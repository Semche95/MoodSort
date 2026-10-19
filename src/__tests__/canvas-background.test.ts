import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Renderer } from 'pixi.js'
import {
    applyCanvasBackgroundTheme,
    bakeCanvasBackground,
    createCanvasBackground,
    resizeCanvasBackground,
    writeShaderColor,
} from '../features/background/canvas-background'
import { getPixiThemeColors } from '../features/theme/pixi-theme-colors'

const { pixi } = vi.hoisted(() => {
    class GlProgram {
        static from: ReturnType<typeof vi.fn> = vi.fn((options: Record<string, unknown>): { options: Record<string, unknown> } => ({ options }))
    }

    class UniformGroup {
        uniforms: Record<string, { value: Float32Array; type: string }>
        update: ReturnType<typeof vi.fn> = vi.fn()
        constructor(uniforms: UniformGroup['uniforms']) {
            this.uniforms = uniforms
        }
    }

    class Shader {
        options: { resources: { backgroundUniforms: UniformGroup } }
        constructor(options: Shader['options']) {
            this.options = options
        }
    }

    class Geometry {
        options: { attributes: Record<string, number[]>; indexBuffer: number[] }
        constructor(options: Geometry['options']) {
            this.options = options
        }
    }

    class Mesh {
        scale: { x: number; y: number; set: (x: number, y: number) => void } = {
            x: 1,
            y: 1,
            set(x: number, y: number): void {
                this.x = x
                this.y = y
            },
        }
        geometry: Geometry
        shader: Shader
        constructor(options: { geometry: Geometry; shader: Shader }) {
            this.geometry = options.geometry
            this.shader = options.shader
        }
    }

    class RenderTexture {
        options: { width: number; height: number; resolution: number }
        destroy: ReturnType<typeof vi.fn> = vi.fn()
        constructor(options: RenderTexture['options']) {
            this.options = options
        }
        static create(options: RenderTexture['options']): RenderTexture {
            return new RenderTexture(options)
        }
    }

    class Sprite {
        label: string = ''
        eventMode: string = 'auto'
        texture: RenderTexture
        constructor(texture: RenderTexture) {
            this.texture = texture
        }
    }

    return { pixi: { GlProgram, UniformGroup, Shader, Geometry, Mesh, RenderTexture, Sprite } }
})

vi.mock('pixi.js', () => ({ ...pixi }))

type FakeMesh = InstanceType<typeof pixi.Mesh>
type FakeRenderTexture = InstanceType<typeof pixi.RenderTexture>
type FakeUniformGroup = InstanceType<typeof pixi.UniformGroup>

function createFakeRenderer(): Renderer & { render: ReturnType<typeof vi.fn> } {
    return { resolution: 2, render: vi.fn(), canvas: document.createElement('canvas') } as unknown as Renderer & { render: ReturnType<typeof vi.fn> }
}

function expectColor(target: Float32Array, color: number, alpha?: number): void {
    const expected = [((color >> 16) & 0xff) / 255, ((color >> 8) & 0xff) / 255, (color & 0xff) / 255]
    if (alpha !== undefined) expected.push(alpha)
    expect(Array.from(target)).toEqual(expected.map((value: number): number => Math.fround(value)))
}

describe('writeShaderColor', () => {
    it('writes a color as normalized RGB floats into a vec3', () => {
        const target = new Float32Array(3)

        writeShaderColor(target, 0xff8000)

        expect(Array.from(target)).toEqual([1, Math.fround(0x80 / 255), 0])
    })

    it('appends the alpha into a vec4', () => {
        const target = new Float32Array(4)

        writeShaderColor(target, 0x0000ff, 0.25)

        expect(Array.from(target)).toEqual([0, 0, 1, 0.25])
    })
})

describe('createCanvasBackground', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('shows a non-interactive labeled sprite backed by a render texture at the screen size and renderer resolution', () => {
        const { sprite, texture } = createCanvasBackground(createFakeRenderer(), 800, 600, 'light')

        expect(sprite.label).toBe('canvas-background')
        expect(sprite.eventMode).toBe('none')
        expect(sprite.texture).toBe(texture)
        expect((texture as unknown as FakeRenderTexture).options).toEqual({ width: 800, height: 600, resolution: 2 })
    })

    it('bakes the shader into the texture once at creation', () => {
        const renderer = createFakeRenderer()

        const { mesh, texture } = createCanvasBackground(renderer, 800, 600, 'light')

        expect(renderer.render).toHaveBeenCalledOnce()
        expect(renderer.render).toHaveBeenCalledWith({ container: mesh, target: texture, clear: true })
    })

    it('draws a unit quad stretched to the screen, whose UVs span the whole mesh', () => {
        const { mesh } = createCanvasBackground(createFakeRenderer(), 800, 600, 'light')
        const fake = mesh as unknown as FakeMesh
        const { attributes, indexBuffer } = fake.geometry.options

        expect([fake.scale.x, fake.scale.y]).toEqual([800, 600])
        expect(attributes.aPosition).toEqual([0, 0, 1, 0, 1, 1, 0, 1])
        expect(attributes.aUV).toEqual(attributes.aPosition)
        expect(indexBuffer).toEqual([0, 1, 2, 0, 2, 3])
    })

    it('compiles the shader with high fragment precision so faint gradients are not quantized early', () => {
        createCanvasBackground(createFakeRenderer(), 800, 600, 'light')

        expect(pixi.GlProgram.from).toHaveBeenLastCalledWith(expect.objectContaining({ preferredFragmentPrecision: 'highp' }))
    })

    it('fills the uniforms with the screen size and the theme backdrop colors', () => {
        const { uniforms } = createCanvasBackground(createFakeRenderer(), 800, 600, 'dark')
        const palette = getPixiThemeColors('dark')
        const decor = palette.backgroundDecor

        expect(Array.from(uniforms.uSize)).toEqual([800, 600])
        expectColor(uniforms.uBase, palette.canvasBackground)
        expectColor(uniforms.uHalo, decor.halo, decor.haloAlpha)
        expectColor(uniforms.uWarmGlow, decor.warmGlow, decor.warmGlowAlpha)
        expectColor(uniforms.uCoolGlow, decor.coolGlow, decor.coolGlowAlpha)
        expectColor(uniforms.uGrain, decor.grain, decor.grainAlpha)
    })

    it('binds the shader to a uniform group holding the same arrays, so in-place writes reach the GPU', () => {
        const { mesh, uniforms, uniformGroup } = createCanvasBackground(createFakeRenderer(), 800, 600, 'light')
        const group = uniformGroup as unknown as FakeUniformGroup

        expect((mesh as unknown as FakeMesh).shader.options.resources.backgroundUniforms).toBe(group)
        for (const [name, value] of Object.entries(uniforms)) {
            expect(group.uniforms[name].value).toBe(value)
        }
    })

    it('re-bakes on the next frame after a lost WebGL context is restored', () => {
        const frames: FrameRequestCallback[] = []
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => frames.push(callback))
        const renderer = createFakeRenderer()
        createCanvasBackground(renderer, 800, 600, 'light')

        renderer.canvas.dispatchEvent(new Event('webglcontextrestored'))

        expect(renderer.render).toHaveBeenCalledOnce()
        frames[0](0)
        expect(renderer.render).toHaveBeenCalledTimes(2)
    })
})

describe('bakeCanvasBackground', () => {
    it('flags the uniforms for upload before rendering the mesh into the texture', () => {
        const renderer = createFakeRenderer()
        const background = createCanvasBackground(renderer, 800, 600, 'light')
        const update = (background.uniformGroup as unknown as FakeUniformGroup).update
        update.mockClear()
        renderer.render.mockClear()

        bakeCanvasBackground(background)

        expect(update).toHaveBeenCalledOnce()
        expect(renderer.render).toHaveBeenCalledWith({ container: background.mesh, target: background.texture, clear: true })
        expect(update.mock.invocationCallOrder[0]).toBeLessThan(renderer.render.mock.invocationCallOrder[0])
    })
})

describe('resizeCanvasBackground', () => {
    it('replaces the texture with one at the new size and renderer resolution, shown by the sprite, and frees the old one', () => {
        const renderer = createFakeRenderer()
        const background = createCanvasBackground(renderer, 800, 600, 'light')
        const previous = background.texture as unknown as FakeRenderTexture

        resizeCanvasBackground(background, 1400, 900)

        const texture = background.texture as unknown as FakeRenderTexture
        expect(texture).not.toBe(previous)
        expect(texture.options).toEqual({ width: 1400, height: 900, resolution: 2 })
        expect(background.sprite.texture).toBe(background.texture)
        expect(previous.destroy).toHaveBeenCalledWith(true)
    })

    it('stretches the mesh, updates the size uniform and re-bakes into the new texture', () => {
        const renderer = createFakeRenderer()
        const background = createCanvasBackground(renderer, 800, 600, 'light')
        renderer.render.mockClear()

        resizeCanvasBackground(background, 1400, 900)

        const mesh = background.mesh as unknown as FakeMesh
        expect([mesh.scale.x, mesh.scale.y]).toEqual([1400, 900])
        expect(Array.from(background.uniforms.uSize)).toEqual([1400, 900])
        expect(renderer.render).toHaveBeenCalledExactlyOnceWith({ container: background.mesh, target: background.texture, clear: true })
    })
})

describe('applyCanvasBackgroundTheme', () => {
    it('rewrites the color uniforms in place for the new theme and re-bakes', () => {
        const renderer = createFakeRenderer()
        const background = createCanvasBackground(renderer, 800, 600, 'light')
        const base = background.uniforms.uBase
        const decor = getPixiThemeColors('dark').backgroundDecor
        renderer.render.mockClear()

        applyCanvasBackgroundTheme(background, 'dark')

        expect(background.uniforms.uBase).toBe(base)
        expectColor(base, getPixiThemeColors('dark').canvasBackground)
        expectColor(background.uniforms.uCoolGlow, decor.coolGlow, decor.coolGlowAlpha)
        expect(renderer.render).toHaveBeenCalledOnce()
    })
})
