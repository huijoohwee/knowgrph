export type SsotSurface =
  | 'table'
  | 'canvas'
  | 'map'
  | 'markdown.viewer'
  | 'markdown.editor'
  | 'markdown.presentation'
  | 'markdown.gallery'

export type SsotEntityKind = 'graph' | 'node' | 'edge' | 'markdownDocument' | 'sourceFile' | 'geoDataset' | 'geoFeature'

export type SsotEntityRef = {
  kind: SsotEntityKind
  id: string
}

export type SsotFocus = {
  surface: SsotSurface
  entity: SsotEntityRef | null
  lineRange?: { start: number; end: number } | null
}

export type SsotChangeReason = 'import' | 'edit' | 'derive' | 'delete' | 'reorder' | 'settings'

export type SsotChange = {
  revision: number
  surface: SsotSurface | 'system'
  reason: SsotChangeReason
  entity: SsotEntityRef
  changedFieldKeys?: string[]
}

export function isSsotSurface(v: unknown): v is SsotSurface {
  return (
    v === 'table' ||
    v === 'canvas' ||
    v === 'map' ||
    v === 'markdown.viewer' ||
    v === 'markdown.editor' ||
    v === 'markdown.presentation' ||
    v === 'markdown.gallery'
  )
}
