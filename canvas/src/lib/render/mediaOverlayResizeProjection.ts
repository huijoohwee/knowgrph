export function projectMediaOverlayResizeWorldSizeToLayout(args: {
  height: number
  projectWithWorldTransformScale: boolean
  scale: number
  width: number
}): { h: number; w: number } {
  const width = Math.max(1, Number(args.width) || 1)
  const height = Math.max(1, Number(args.height) || 1)
  if (args.projectWithWorldTransformScale) return { w: width, h: height }
  const scale = Math.max(0.001, Number(args.scale) || 1)
  return { w: width * scale, h: height * scale }
}
