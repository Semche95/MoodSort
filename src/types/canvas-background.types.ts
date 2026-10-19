import type { Geometry, Mesh, RenderTexture, Renderer, Shader, Sprite, UniformGroup } from 'pixi.js'

/** Shader inputs of the canvas backdrop, mutated in place on resize and theme change. */
export interface CanvasBackgroundUniforms {
    uSize: Float32Array
    uBase: Float32Array
    uHalo: Float32Array
    uWarmGlow: Float32Array
    uCoolGlow: Float32Array
    uGrain: Float32Array
}

/** The baked backdrop: `sprite` is what the stage shows, the rest re-bakes it on resize, theme change or context restore. */
export interface CanvasBackground {
    renderer: Renderer
    sprite: Sprite
    texture: RenderTexture
    mesh: Mesh<Geometry, Shader>
    uniforms: CanvasBackgroundUniforms
    uniformGroup: UniformGroup
}
