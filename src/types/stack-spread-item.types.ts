import type { Container, Graphics, Sprite } from 'pixi.js'
import type { Card } from './card.types'

/** A pooled spread cell: a copy of a board card's look, drawn at the spread's card size. */
export interface StackSpreadItem {
    view: Container
    shadow: Graphics
    sprite: Sprite
    highlight: Graphics
    /** The board card this cell shows on the current frame, null while pooled */
    card: Card | null
}
