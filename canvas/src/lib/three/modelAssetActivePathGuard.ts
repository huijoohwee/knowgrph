import { workspaceDocumentKey } from '@/features/workspace-fs/path'

function normalizeDocToken(value: unknown): string {
  return String(value || '').trim().replace(/^\/+/, '')
}

function isModelAssetDocumentName(value: unknown): boolean {
  return /\.(glb|gltf)(?:$|[?#])/i.test(normalizeDocToken(value))
}

export function shouldRenderCanvasAppliedModelAsset(args: {
  explorerActivePath?: string | null
  canvasDocumentName?: string | null
  hasModelAsset: boolean
}): boolean {
  if (!args.hasModelAsset) return false
  const activePath = normalizeDocToken(args.explorerActivePath)
  if (!isModelAssetDocumentName(activePath)) return true
  const activeKey = normalizeDocToken(workspaceDocumentKey(activePath) || activePath.split('/').filter(Boolean).pop() || activePath)
  const docName = normalizeDocToken(args.canvasDocumentName)
  return !!activeKey && (docName === activeKey || docName.endsWith(`/${activeKey}`))
}
