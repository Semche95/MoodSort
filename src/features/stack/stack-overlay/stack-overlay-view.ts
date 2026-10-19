import { Graphics } from 'pixi.js'
import { Card } from '../../../types/card.types'
import { Box } from '../../../types/box.types'
import { Position } from '../../../types/position.types'
import { StackPillLayout } from '../../../types/stack-pill-layout.types'
import { computeBoundingBox } from '../stack-geometry'
import { computeCompactButtonBox, computeStackFrame } from '../stack-hit-testing'
import { STACK_FRAME_RADIUS, STACK_PILL_HEIGHT } from '../stack'
import { getPixiThemeColors } from '../../theme/pixi-theme-colors'
import type { PixiThemePalette } from '../../../types/pixi-theme-palette.types'

const DEFAULT_PALETTE: PixiThemePalette['stackOverlay'] = getPixiThemeColors('light').stackOverlay

const FRAME_STROKE_WIDTH = 2
const FRAME_DASH = 6
const FRAME_GAP = 5
const FRAME_ARC_SEGMENTS = 8
const FRAME_REST_ALPHA = 0.4
const FRAME_HOVER_ALPHA = 0.8
const FRAME_HOVER_FILL_ALPHA = 0.06
const MERGE_PLUS_ALPHA = 0.9
const MERGE_WASH_ALPHA = 0.12
// Near-invisible fill so the frame's whole area, not just its dashes, stays part of the scene's hit tree.
const HIT_FILL_ALPHA = 0.001
const PILL_SHADOW_OFFSET_Y = 1.5
const ICON_SIZE = 19
// Concentric enough with the pill end cap (radius 16, center 3px further out) to stay inside it.
const CONTROL_HOVER_RADIUS = 13
const ICON_ALPHA = 0.9
const ICON_REST_ALPHA = 0.35
const GRIP_DOT_RADIUS = 2
const GRIP_DOT_SPACING = 7
const GRIP_ALPHA = 0.8

function centeredIconBox(slot: Box): Box {
    return {
        x: slot.x + (slot.width - ICON_SIZE) / 2,
        y: slot.y + (slot.height - ICON_SIZE) / 2,
        width: ICON_SIZE,
        height: ICON_SIZE,
    }
}

/** Points along a rounded rectangle's outline, clockwise from the start of its top edge, closed back on that start. */
export function roundRectOutline(rect: Box, radius: number): Position[] {
    const { x, y, width, height } = rect
    const corners = [
        { cx: x + width - radius, cy: y + radius, start: -Math.PI / 2 },
        { cx: x + width - radius, cy: y + height - radius, start: 0 },
        { cx: x + radius, cy: y + height - radius, start: Math.PI / 2 },
        { cx: x + radius, cy: y + radius, start: Math.PI },
    ]
    const points: Position[] = [{ x: x + radius, y }]
    for (const { cx, cy, start } of corners) {
        for (let i = 0; i <= FRAME_ARC_SEGMENTS; i++) {
            const angle = start + (i / FRAME_ARC_SEGMENTS) * (Math.PI / 2)
            points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius })
        }
    }
    points.push({ x: x + radius, y })
    return points
}

/**
 * Traces dashes along a polyline as moveTo/lineTo pairs, for the caller to stroke. The dash
 * period is stretched so a whole number of dashes fits the path, so a closed outline never
 * ends on a stub where it meets its own start.
 */
export function traceDashedPath(g: Graphics, points: Position[], dash: number, gap: number): void {
    const lengths = points.slice(1).map((p: Position, i: number): number => Math.hypot(p.x - points[i].x, p.y - points[i].y))
    const total = lengths.reduce((sum: number, length: number): number => sum + length, 0)
    if (total === 0) {
        return
    }
    const period = total / Math.max(1, Math.round(total / (dash + gap)))
    const dashLength = period * (dash / (dash + gap))
    let phase = 0
    for (let i = 0; i < lengths.length; i++) {
        const from = points[i]
        const to = points[i + 1]
        const length = lengths[i]
        let travelled = 0
        while (travelled < length) {
            const inDash = phase < dashLength
            const step = Math.min(length - travelled, (inDash ? dashLength : period) - phase)
            if (inDash) {
                const t0 = travelled / length
                const t1 = (travelled + step) / length
                g.moveTo(from.x + (to.x - from.x) * t0, from.y + (to.y - from.y) * t0)
                g.lineTo(from.x + (to.x - from.x) * t1, from.y + (to.y - from.y) * t1)
            }
            travelled += step
            phase = (phase + step) % period
        }
    }
}

/** Dashed rounded frame around a stack's cards, tinted with the accent while the stack is hovered or a merge target. */
export function drawStackFrame(g: Graphics, frame: Box, highlighted: boolean, palette: PixiThemePalette['stackOverlay'] = DEFAULT_PALETTE): void {
    g.roundRect(frame.x, frame.y, frame.width, frame.height, STACK_FRAME_RADIUS)
    g.fill(highlighted ? { color: palette.accent, alpha: FRAME_HOVER_FILL_ALPHA } : { color: 0x000000, alpha: HIT_FILL_ALPHA })
    traceDashedPath(g, roundRectOutline(frame, STACK_FRAME_RADIUS), FRAME_DASH, FRAME_GAP)
    g.stroke({
        color: highlighted ? palette.accent : palette.frame,
        alpha: highlighted ? FRAME_HOVER_ALPHA : FRAME_REST_ALPHA,
        width: FRAME_STROKE_WIDTH,
    })
}

/** Rounded pill with the same flat drop shadow as the toolbar's round buttons. */
export function drawPillShape(g: Graphics, rect: Box, palette: PixiThemePalette['stackOverlay'] = DEFAULT_PALETTE): void {
    const radius = STACK_PILL_HEIGHT / 2
    g.roundRect(rect.x, rect.y + PILL_SHADOW_OFFSET_Y, rect.width, rect.height, radius)
    g.fill({ color: palette.pillShadow, alpha: palette.pillShadowAlpha })
    g.roundRect(rect.x, rect.y, rect.width, rect.height, radius)
    g.fill({ color: palette.pill })
}

/**
 * Top pill background and its grip, lit with a button's hover chip while a press would carry the stack;
 * the name text and rename button are drawn on top by their own owners.
 */
export function drawStackPill(g: Graphics, layout: StackPillLayout, gripLit: boolean, palette: PixiThemePalette['stackOverlay'] = DEFAULT_PALETTE): void {
    drawPillShape(g, layout.pill, palette)
    if (gripLit) {
        drawControlHover(layout.grip, g, palette)
    }
    drawGripIcon(layout.grip, g, palette, gripLit ? palette.accent : palette.controlIcon)
}

/** Six dots (2 rows of 3), the usual "drag me" affordance. */
export function drawGripIcon(slot: Box, g: Graphics, palette: PixiThemePalette['stackOverlay'] = DEFAULT_PALETTE, color: number = palette.controlIcon): void {
    const cx = slot.x + slot.width / 2
    const cy = slot.y + slot.height / 2
    for (const row of [-0.5, 0.5]) {
        for (const column of [-1, 0, 1]) {
            g.circle(cx + column * GRIP_DOT_SPACING, cy + row * GRIP_DOT_SPACING, GRIP_DOT_RADIUS)
        }
    }
    g.fill({ color, alpha: GRIP_ALPHA })
}

/** Round chip behind a pill button under the pointer, like the toolbar's pressed state. */
export function drawControlHover(slot: Box, g: Graphics, palette: PixiThemePalette['stackOverlay'] = DEFAULT_PALETTE): void {
    g.circle(slot.x + slot.width / 2, slot.y + slot.height / 2, CONTROL_HOVER_RADIUS)
    g.fill({ color: palette.controlHover })
}

/**
 * Rename button at the pill's right end: always shown so a truncated name never reflows on hover,
 * faded at rest, opaque on a hovered stack, and accent-colored on a chip under the pointer.
 */
export function drawNameButton(
    layout: StackPillLayout,
    g: Graphics,
    stackHovered: boolean,
    buttonHovered: boolean,
    palette: PixiThemePalette['stackOverlay'] = DEFAULT_PALETTE,
): void {
    const { pencil } = layout
    g.rect(pencil.x, pencil.y, pencil.width, pencil.height)
    g.fill({ color: 0x000000, alpha: HIT_FILL_ALPHA })
    if (buttonHovered) {
        drawControlHover(pencil, g, palette)
        drawNameIcon(centeredIconBox(pencil), g, palette.accent, ICON_ALPHA)
        return
    }
    drawNameIcon(centeredIconBox(pencil), g, palette.controlIcon, stackHovered ? ICON_ALPHA : ICON_REST_ALPHA)
}

export function drawCompactButton(
    stack: Card[],
    compactButton: Graphics,
    buttonHovered: boolean,
    palette: PixiThemePalette['stackOverlay'] = DEFAULT_PALETTE,
): void {
    const rect = computeCompactButtonBox(stack)
    if (!rect) {
        return
    }
    drawPillShape(compactButton, rect, palette)
    if (buttonHovered) {
        drawControlHover(rect, compactButton, palette)
    }
    drawCompactIcon(centeredIconBox(rect), compactButton, buttonHovered ? palette.accent : palette.controlIcon)
}

/**
 * "Two converging arrows" icon: one from the top-right corner, one from
 * the bottom-left corner, both pointing toward the center along the same
 * diagonal, the classic "compact/squeeze together" metaphor. Drawn on a
 * 24x24 reference grid scaled to the icon's actual size.
 */
export function drawCompactIcon(rect: Box, compactButton: Graphics, color: number = DEFAULT_PALETTE.controlIcon): void {
    const scaleX = rect.width / 24
    const scaleY = rect.height / 24
    const toWorld = (px: number, py: number): Position => ({
        x: rect.x + px * scaleX,
        y: rect.y + py * scaleY,
    })
    const thickness = 2.6 * Math.min(scaleX, scaleY)

    drawArrow(compactButton, toWorld(21, 3), toWorld(13, 11), thickness, color)
    drawArrow(compactButton, toWorld(3, 21), toWorld(11, 13), thickness, color)
}

export function drawArrow(
    icon: Graphics,
    from: Position,
    to: Position,
    thickness: number,
    color: number = DEFAULT_PALETTE.controlIcon,
): void {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const ux = dx / length
    const uy = dy / length
    const px = -uy
    const py = ux
    const halfThickness = thickness / 2
    const headLength = thickness * 2.5
    const halfHeadWidth = thickness * 1.25
    const shaftEndX = to.x - ux * headLength
    const shaftEndY = to.y - uy * headLength

    icon.moveTo(from.x + px * halfThickness, from.y + py * halfThickness)
    icon.lineTo(shaftEndX + px * halfThickness, shaftEndY + py * halfThickness)
    icon.lineTo(shaftEndX - px * halfThickness, shaftEndY - py * halfThickness)
    icon.lineTo(from.x - px * halfThickness, from.y - py * halfThickness)
    icon.closePath()
    icon.fill({ color, alpha: ICON_ALPHA })

    icon.moveTo(to.x, to.y)
    icon.lineTo(shaftEndX + px * halfHeadWidth, shaftEndY + py * halfHeadWidth)
    icon.lineTo(shaftEndX - px * halfHeadWidth, shaftEndY - py * halfHeadWidth)
    icon.closePath()
    icon.fill({ color, alpha: ICON_ALPHA })
}

/**
 * Simple pencil icon (shaft + tip), the standard "rename" metaphor. Drawn on
 * a 24x24 reference grid scaled to the icon's actual size, mirroring how
 * drawCompactIcon scales its own arrows.
 */
export function drawNameIcon(rect: Box, nameButton: Graphics, color: number, alpha: number): void {
    const scale = Math.min(rect.width / 24, rect.height / 24)
    const toWorld = (px: number, py: number): Position => ({
        x: rect.x + px * (rect.width / 24),
        y: rect.y + py * (rect.height / 24),
    })
    const halfWidth = 2 * scale

    const from = toWorld(4, 20)
    const to = toWorld(15, 9)
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const px = (-dy / length) * halfWidth
    const py = (dx / length) * halfWidth

    nameButton.moveTo(from.x + px, from.y + py)
    nameButton.lineTo(to.x + px, to.y + py)
    nameButton.lineTo(to.x - px, to.y - py)
    nameButton.lineTo(from.x - px, from.y - py)
    nameButton.closePath()
    nameButton.fill({ color, alpha })

    const tip = toWorld(20, 4)
    nameButton.moveTo(to.x + px, to.y + py)
    nameButton.lineTo(tip.x, tip.y)
    nameButton.lineTo(to.x - px, to.y - py)
    nameButton.closePath()
    nameButton.fill({ color, alpha })
}

/** Light accent wash over a stack the dragged cards would merge into; its frame itself is tinted by drawStackFrame, under its pill. */
export function drawMergeWash(stack: Card[], mergeIndicator: Graphics, palette: PixiThemePalette['stackOverlay'] = DEFAULT_PALETTE): void {
    const frame = computeStackFrame(computeBoundingBox(stack))
    mergeIndicator.roundRect(frame.x, frame.y, frame.width, frame.height, STACK_FRAME_RADIUS)
    mergeIndicator.fill({ color: palette.accent, alpha: MERGE_WASH_ALPHA })
}

export function drawMergePlus(stack: Card[], mergePlus: Graphics, palette: PixiThemePalette['stackOverlay'] = DEFAULT_PALETTE): void {
    const box = computeBoundingBox(stack)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const arm = 20
    const thickness = 5
    mergePlus.roundRect(cx - arm, cy - thickness / 2, arm * 2, thickness, thickness / 2)
    mergePlus.fill({ color: palette.accent, alpha: MERGE_PLUS_ALPHA })
    mergePlus.roundRect(cx - thickness / 2, cy - arm, thickness, arm * 2, thickness / 2)
    mergePlus.fill({ color: palette.accent, alpha: MERGE_PLUS_ALPHA })
}
