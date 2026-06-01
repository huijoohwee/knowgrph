import { isCanvas2dRendererId, isFlowCanvas2dRenderer, sharesFlowEditorFrontmatterSyntax } from '@/lib/config.render'

const cleanRenderer = (value: unknown): string => String(value || '').trim()

export function canSeedCanvasStateAcross2dRenderers(args: {
  targetRenderer: string | null | undefined
  sourceRenderer: string | null | undefined
}): boolean {
  const target = isCanvas2dRendererId(args.targetRenderer) ? args.targetRenderer : cleanRenderer(args.targetRenderer)
  const source = isCanvas2dRendererId(args.sourceRenderer) ? args.sourceRenderer : cleanRenderer(args.sourceRenderer)
  if (!target || !source || target === source) return true
  if (!isCanvas2dRendererId(target) || !isCanvas2dRendererId(source)) return true
  if (!isFlowCanvas2dRenderer(target) || !isFlowCanvas2dRenderer(source)) return true
  return sharesFlowEditorFrontmatterSyntax(target) === sharesFlowEditorFrontmatterSyntax(source)
}

export function read2dRendererFromLayoutCacheSeedKey(args: {
  baseKey: string
  cacheKey: string
}): string {
  const baseKey = String(args.baseKey || '').trim()
  const cacheKey = String(args.cacheKey || '').trim()
  if (!baseKey || !cacheKey) return ''

  const suffix = cacheKey.startsWith(`${baseKey}:`)
    ? cacheKey.slice(baseKey.length + 1)
    : ''
  if (!suffix) return ''

  const parts = suffix.split(':')
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]
    if (isCanvas2dRendererId(part)) return part
  }
  return ''
}
