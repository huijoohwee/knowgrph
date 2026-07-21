export function readWebglSupport(
  documentValue: Document | null = typeof document === 'undefined' ? null : document,
): boolean {
  if (!documentValue) return false
  try {
    const canvas = documentValue.createElement('canvas')
    const context = (
      canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl' as never)
    ) as WebGLRenderingContext | WebGL2RenderingContext | null
    if (!context) return false
    // Release the probe promptly so the real renderer owns the browser's context budget.
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
