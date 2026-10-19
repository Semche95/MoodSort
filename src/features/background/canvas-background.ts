import { Geometry, GlProgram, Mesh, RenderTexture, Shader, Sprite, UniformGroup } from 'pixi.js'
import type { Renderer } from 'pixi.js'
import type { CanvasBackground, CanvasBackgroundUniforms } from '../../types/canvas-background.types'
import type { ResolvedTheme } from '../../types/theme.types'
import { getPixiThemeColors } from '../theme/pixi-theme-colors'

const UNIT_QUAD = [0, 0, 1, 0, 1, 1, 0, 1]

const VERTEX_SHADER = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
}
`

// Computed per physical pixel in float and dithered right before the 8-bit write: faint dark-theme glows only span a
// dozen levels, so any earlier rounding (canvas gradients, 8-bit textures) leaves visible bands
const FRAGMENT_SHADER = `
in vec2 vUV;

uniform vec2 uSize;
uniform vec3 uBase;
uniform vec4 uHalo;
uniform vec4 uWarmGlow;
uniform vec4 uCoolGlow;
uniform vec4 uGrain;

vec3 hash32(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec3 blendGlow(vec3 color, vec4 glow, vec2 center, float radius, vec2 position) {
    float t = distance(position, center) / radius;
    return mix(color, glow.rgb, glow.a * (1.0 - smoothstep(0.0, 1.0, t)));
}

void main() {
    vec2 position = vUV * uSize;
    float longestSide = max(uSize.x, uSize.y);
    vec3 color = uBase;
    color = blendGlow(color, uHalo, uSize * vec2(0.5, 0.45), longestSide * 0.65, position);
    color = blendGlow(color, uWarmGlow, uSize * vec2(0.12, 0.88), longestSide * 0.4, position);
    color = blendGlow(color, uCoolGlow, uSize * vec2(0.9, 0.15), longestSide * 0.4, position);
    vec3 noise = hash32(gl_FragCoord.xy);
    color = mix(color, uGrain.rgb, noise.x * uGrain.a);
    color += (noise.y + noise.z - 1.0) / 255.0;
    gl_FragColor = vec4(color, 1.0);
}
`

/** Writes a 0xRRGGBB color as normalized floats into `target`, followed by `alpha` when the target has a fourth slot. */
export function writeShaderColor(target: Float32Array, color: number, alpha: number = 1): void {
    target[0] = ((color >> 16) & 0xff) / 255
    target[1] = ((color >> 8) & 0xff) / 255
    target[2] = (color & 0xff) / 255
    if (target.length > 3) target[3] = alpha
}

function writeThemeUniforms(uniforms: CanvasBackgroundUniforms, resolvedTheme: ResolvedTheme): void {
    const palette = getPixiThemeColors(resolvedTheme)
    const decor = palette.backgroundDecor
    writeShaderColor(uniforms.uBase, palette.canvasBackground)
    writeShaderColor(uniforms.uHalo, decor.halo, decor.haloAlpha)
    writeShaderColor(uniforms.uWarmGlow, decor.warmGlow, decor.warmGlowAlpha)
    writeShaderColor(uniforms.uCoolGlow, decor.coolGlow, decor.coolGlowAlpha)
    writeShaderColor(uniforms.uGrain, decor.grain, decor.grainAlpha)
}

function setMeshSize(background: Pick<CanvasBackground, 'mesh' | 'uniforms'>, width: number, height: number): void {
    background.mesh.scale.set(width, height)
    background.uniforms.uSize[0] = width
    background.uniforms.uSize[1] = height
}

/** Runs the shader once into the backdrop texture; the screen then only copies that texture each frame, like any sprite. */
export function bakeCanvasBackground(background: CanvasBackground): void {
    background.uniformGroup.update()
    background.renderer.render({ container: background.mesh, target: background.texture, clear: true })
}

/**
 * Full-screen sprite drawn behind everything else, so the backdrop is part of the canvas pixels a screen share captures.
 * Baked at the renderer resolution so the dither maps 1:1 onto physical pixels instead of being resampled.
 */
export function createCanvasBackground(renderer: Renderer, width: number, height: number, resolvedTheme: ResolvedTheme): CanvasBackground {
    const uniforms: CanvasBackgroundUniforms = {
        uSize: new Float32Array(2),
        uBase: new Float32Array(3),
        uHalo: new Float32Array(4),
        uWarmGlow: new Float32Array(4),
        uCoolGlow: new Float32Array(4),
        uGrain: new Float32Array(4),
    }
    writeThemeUniforms(uniforms, resolvedTheme)
    const uniformGroup = new UniformGroup({
        uSize: { value: uniforms.uSize, type: 'vec2<f32>' },
        uBase: { value: uniforms.uBase, type: 'vec3<f32>' },
        uHalo: { value: uniforms.uHalo, type: 'vec4<f32>' },
        uWarmGlow: { value: uniforms.uWarmGlow, type: 'vec4<f32>' },
        uCoolGlow: { value: uniforms.uCoolGlow, type: 'vec4<f32>' },
        uGrain: { value: uniforms.uGrain, type: 'vec4<f32>' },
    })
    const shader = new Shader({
        glProgram: GlProgram.from({ vertex: VERTEX_SHADER, fragment: FRAGMENT_SHADER, name: 'canvas-background', preferredFragmentPrecision: 'highp' }),
        resources: { backgroundUniforms: uniformGroup },
    })
    const geometry = new Geometry({ attributes: { aPosition: UNIT_QUAD, aUV: UNIT_QUAD }, indexBuffer: [0, 1, 2, 0, 2, 3] })
    const mesh = new Mesh({ geometry, shader })
    const texture = RenderTexture.create({ width, height, resolution: renderer.resolution })
    const sprite = new Sprite(texture)
    sprite.label = 'canvas-background'
    sprite.eventMode = 'none'
    const background: CanvasBackground = { renderer, sprite, texture, mesh, uniforms, uniformGroup }
    setMeshSize(background, width, height)
    bakeCanvasBackground(background)
    // A lost WebGL context comes back with an empty render texture, unlike file-backed textures Pixi re-uploads itself
    renderer.canvas.addEventListener('webglcontextrestored', (): void => {
        requestAnimationFrame((): void => bakeCanvasBackground(background))
    })
    return background
}

// Replaced rather than resized: a resized render texture kept its old size on screen, so the backdrop only covered part of a larger canvas
export function resizeCanvasBackground(background: CanvasBackground, width: number, height: number): void {
    const previous = background.texture
    background.texture = RenderTexture.create({ width, height, resolution: background.renderer.resolution })
    background.sprite.texture = background.texture
    previous.destroy(true)
    setMeshSize(background, width, height)
    bakeCanvasBackground(background)
}

export function applyCanvasBackgroundTheme(background: CanvasBackground, resolvedTheme: ResolvedTheme): void {
    writeThemeUniforms(background.uniforms, resolvedTheme)
    bakeCanvasBackground(background)
}
