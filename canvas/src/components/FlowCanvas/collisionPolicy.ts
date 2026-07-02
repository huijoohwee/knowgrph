export function computeCollisionDuringDrag(args: { collisionDuringDrag: boolean; canvas2dRenderer: string }): boolean {
  if (String(args.canvas2dRenderer || '') === 'storyboard') return false
  return args.collisionDuringDrag === true
}
