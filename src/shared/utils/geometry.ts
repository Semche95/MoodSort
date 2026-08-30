import { Position } from '../../types/position.types'

export function constrainPosition(
    x: number,
    y: number,
    width: number,
    height: number,
    appWidth: number,
    appHeight: number,
): Position {
    const minX = 0
    const minY = 0
    const maxX = appWidth - width
    const maxY = appHeight - height

    return {
        x: Math.max(minX, Math.min(x, maxX)),
        y: Math.max(minY, Math.min(y, maxY)),
    }
}
