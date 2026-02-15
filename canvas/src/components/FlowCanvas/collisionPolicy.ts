export function computeCollisionDuringDrag(args: { collisionDuringDrag: boolean; canvas2dRenderer: string }): boolean {
  return args.collisionDuringDrag || args.canvas2dRenderer === 'flowEditor'
}

