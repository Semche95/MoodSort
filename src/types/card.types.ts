import { Container, Graphics, Sprite } from 'pixi.js'
import { CardLift } from './card-lift.types'

export interface Card extends Container {
    /** Atlas frame name used as card identity and persistence key */
    imageUrl: string
    /** Holds the shadow and sprite; scaled and shifted by the lift without moving the card itself */
    body: Container
    /** The inner sprite holding the card image */
    innerSprite: Sprite
    /** Accent outline drawn over the card while the pointer is on it */
    highlight: Graphics
    /** The card's own shadow: a soft halo at rest, a deeper drop shadow once lifted */
    shadow: Graphics
    lift: CardLift
}
