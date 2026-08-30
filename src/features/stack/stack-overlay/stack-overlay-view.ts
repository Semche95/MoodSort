import { Graphics } from 'pixi.js'
import { Card } from '../../../types/card.types'
import { computeBoundingBox, computeCompactButtonBox, STACK_HIGHLIGHT_PADDING, STACK_HANDLE_HEIGHT } from '../stack'

function paddedBox(
    box: { x: number; y: number; width: number; height: number },
    pad: number = STACK_HIGHLIGHT_PADDING,
): { x: number; y: number; width: number; height: number } {
    return {
        x: box.x - pad,
        y: box.y - pad,
        width: box.width + pad * 2,
        height: box.height + pad * 2,
    }
}

function drawOutlineRect(g: Graphics, rect: { x: number; y: number; width: number; height: number }): void {
    g.rect(rect.x, rect.y, rect.width, rect.height)
    g.fill({ color: 0x000000, alpha: 0.001 })
    g.rect(rect.x, rect.y, rect.width, rect.height)
    g.stroke({ color: 0x333333, width: 2, alpha: 0.6 })
}

export function drawSingleBox(
    box: { x: number; y: number; width: number; height: number },
    border: Graphics,
    handle: Graphics,
): void {
    const rect = paddedBox(box)
    const { x: bx, y: by, width: bw } = rect

    drawOutlineRect(border, rect)

    const handleWidth = Math.min(bw, 80)
    const hx = bx + (bw - handleWidth) / 2
    const hy = by - STACK_HANDLE_HEIGHT / 2

    handle.roundRect(hx, hy, handleWidth, STACK_HANDLE_HEIGHT, 6)
    handle.fill({ color: 0x444444, alpha: 0.75 })
    drawGripIcon(hx, hy, handleWidth, handle)
}

export function drawSingleStack(stack: Card[], border: Graphics, handle: Graphics): void {
    drawSingleBox(computeBoundingBox(stack), border, handle)
}

export function drawGripIcon(hx: number, hy: number, handleWidth: number, handle: Graphics): void {
    const cx = hx + handleWidth / 2
    const cy = hy + STACK_HANDLE_HEIGHT / 2
    const lineHalfWidth = 10
    const spacing = 4
    for (let i = -1; i <= 1; i++) {
        handle.rect(cx - lineHalfWidth, cy + i * spacing - 1, lineHalfWidth * 2, 2)
        handle.fill({ color: 0xaaaaaa, alpha: 0.9 })
    }
}

export function drawCompactButton(stack: Card[], compactButton: Graphics): void {
    const rect = computeCompactButtonBox(stack)
    if (!rect) {
        return
    }
    compactButton.roundRect(rect.x, rect.y, rect.width, rect.height, 6)
    compactButton.fill({ color: 0x444444, alpha: 0.75 })
    drawCompactIcon(rect, compactButton)
}

/**
 * "Two converging arrows" icon: one from the top-right corner, one from
 * the bottom-left corner, both pointing toward the center along the same
 * diagonal, the classic "compact/squeeze together" metaphor. Drawn on a
 * 24x24 reference grid scaled to the button's actual size.
 */
export function drawCompactIcon(
    rect: { x: number; y: number; width: number; height: number },
    compactButton: Graphics,
): void {
    const scaleX = rect.width / 24
    const scaleY = rect.height / 24
    const toWorld = (px: number, py: number): { x: number; y: number } => ({
        x: rect.x + px * scaleX,
        y: rect.y + py * scaleY,
    })
    const thickness = 2 * Math.min(scaleX, scaleY)

    drawArrow(compactButton, toWorld(18, 6), toWorld(13, 11), thickness)
    drawArrow(compactButton, toWorld(6, 18), toWorld(11, 13), thickness)
}

export function drawArrow(
    icon: Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    thickness: number,
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
    icon.fill({ color: 0xaaaaaa, alpha: 0.9 })

    icon.moveTo(to.x, to.y)
    icon.lineTo(shaftEndX + px * halfHeadWidth, shaftEndY + py * halfHeadWidth)
    icon.lineTo(shaftEndX - px * halfHeadWidth, shaftEndY - py * halfHeadWidth)
    icon.closePath()
    icon.fill({ color: 0xaaaaaa, alpha: 0.9 })
}

export function drawMergeTargetBorder(stack: Card[], mergeIndicator: Graphics): void {
    drawOutlineRect(mergeIndicator, paddedBox(computeBoundingBox(stack)))
}

export function drawMergeDim(stack: Card[], mergeIndicator: Graphics): void {
    const rect = paddedBox(computeBoundingBox(stack))
    mergeIndicator.rect(rect.x, rect.y, rect.width, rect.height)
    mergeIndicator.fill({ color: 0x000000, alpha: 0.15 })
}

export function drawMergePlus(stack: Card[], mergePlus: Graphics): void {
    const box = computeBoundingBox(stack)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const arm = 20
    const thickness = 5
    mergePlus.rect(cx - arm, cy - thickness / 2, arm * 2, thickness)
    mergePlus.fill({ color: 0x333333, alpha: 0.7 })
    mergePlus.rect(cx - thickness / 2, cy - arm, thickness, arm * 2)
    mergePlus.fill({ color: 0x333333, alpha: 0.7 })
}
