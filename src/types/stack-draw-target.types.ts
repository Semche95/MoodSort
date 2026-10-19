import type { Graphics } from 'pixi.js'
import type { StackLabelPool } from '../features/stack/stack-overlay/stack-label-pool'

/** The layer set a stack is drawn into: resting stacks and the stack being carried each have their own, for z-order. */
export interface StackDrawTarget {
    frame: Graphics
    pill: Graphics
    pencil: Graphics
    labels: StackLabelPool
}
