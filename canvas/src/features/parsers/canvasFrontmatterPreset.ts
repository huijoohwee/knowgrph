import { useGraphStore } from '@/hooks/useGraphStore'
import type { DocumentSemanticMode } from '@/hooks/store/types'
import type { GraphData } from '@/lib/graph/types'
import type { Canvas2dRendererId } from '@/lib/config'
import { LS_KEYS } from '@/lib/config'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { lsSetBool } from '@/lib/persistence'
import {
  parseCanvasWorkspaceFrontmatterPreset,
  readCanvasWorkspaceFrontmatterPresetFromMeta,
  type CanvasWorkspaceFrontmatterPreset,
} from '@/lib/markdown/frontmatter'
import { setGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function disableGeospatialForDocumentPreset(): void {
  try {
    lsSetBool(LS_KEYS.geospatialOverlayEnabled, false)
  } catch {
    void 0
  }
  try {
    void setGeospatialModeEnabled(false).catch(() => void 0)
  } catch {
    void 0
  }
}

export function resolveCanvasFrontmatterPreset(args: {
  graphData?: GraphData | null
  rawText?: string | null
}): CanvasWorkspaceFrontmatterPreset | null {
  const rawText = String(args.rawText || '')
  const fromText = rawText ? parseCanvasWorkspaceFrontmatterPreset(rawText) : null
  if (fromText) return fromText

  const metadata = isRecord(args.graphData?.metadata) ? (args.graphData?.metadata as Record<string, unknown>) : null
  const frontmatterMeta = metadata && isRecord(metadata.frontmatterMeta) ? (metadata.frontmatterMeta as Record<string, unknown>) : null
  return readCanvasWorkspaceFrontmatterPresetFromMeta(frontmatterMeta)
}

export function applyCanvasFrontmatterPreset(args: {
  graphData?: GraphData | null
  rawText?: string | null
  defaultCanvasRenderMode?: '2d' | '3d'
  defaultCanvas2dRenderer?: Canvas2dRendererId
  defaultDocumentSemanticMode?: DocumentSemanticMode
  defaultFrontmatterModeEnabled?: boolean
  defaultMultiDimTableModeEnabled?: boolean
  defaultDocumentStructureBaselineLock?: boolean
  disableMultiDimTableMode?: boolean
}): boolean {
  const preset = resolveCanvasFrontmatterPreset(args)
  const store = useGraphStore.getState()
  let changed = false
  const documentStructureBaselineLock =
    preset?.documentStructureBaselineLock ?? args.defaultDocumentStructureBaselineLock

  if (documentStructureBaselineLock === false && store.documentStructureBaselineLock !== false) {
    store.setDocumentStructureBaselineLock(false)
    changed = true
  }

  const canvasRenderMode = preset?.canvasRenderMode ?? args.defaultCanvasRenderMode
  if (canvasRenderMode) {
    disableGeospatialForDocumentPreset()
  }
  if (canvasRenderMode && store.canvasRenderMode !== canvasRenderMode) {
    store.setCanvasRenderMode(canvasRenderMode)
    changed = true
  }

  const canvas2dRenderer = preset?.canvas2dRenderer ?? args.defaultCanvas2dRenderer
  if (canvas2dRenderer && store.canvas2dRenderer !== canvas2dRenderer) {
    store.setCanvas2dRenderer(canvas2dRenderer)
    changed = true
  }

  const frontmatterOnlyPolicyActive = isFrontmatterOnlyPolicyActive({
    canvasRenderMode: canvasRenderMode ?? store.canvasRenderMode,
    canvas2dRenderer: canvas2dRenderer ?? store.canvas2dRenderer,
  })

  const documentSemanticMode = frontmatterOnlyPolicyActive
    ? 'document'
    : (preset?.documentSemanticMode ?? args.defaultDocumentSemanticMode)
  if (documentSemanticMode && store.documentSemanticMode !== documentSemanticMode) {
    store.setDocumentSemanticMode(documentSemanticMode)
    changed = true
  }

  const frontmatterModeEnabled = frontmatterOnlyPolicyActive
    ? true
    : (preset?.frontmatterModeEnabled ?? args.defaultFrontmatterModeEnabled)
  const multiDimTableModeEnabled = frontmatterOnlyPolicyActive
    ? false
    : (
        preset?.multiDimTableModeEnabled
        ?? (args.disableMultiDimTableMode === true ? false : args.defaultMultiDimTableModeEnabled)
      )

  if (typeof frontmatterModeEnabled === 'boolean' && frontmatterModeEnabled === false && store.frontmatterModeEnabled !== false) {
    store.setFrontmatterModeEnabled(false)
    changed = true
  }
  if (typeof multiDimTableModeEnabled === 'boolean' && multiDimTableModeEnabled === false && store.multiDimTableModeEnabled !== false) {
    store.setMultiDimTableModeEnabled(false)
    changed = true
  }
  if (typeof multiDimTableModeEnabled === 'boolean' && multiDimTableModeEnabled === true && store.multiDimTableModeEnabled !== true) {
    store.setMultiDimTableModeEnabled(true)
    changed = true
  }
  if (typeof frontmatterModeEnabled === 'boolean' && frontmatterModeEnabled === true && store.frontmatterModeEnabled !== true) {
    store.setFrontmatterModeEnabled(true)
    changed = true
  }

  if (
    documentStructureBaselineLock === true &&
    store.documentStructureBaselineLock !== documentStructureBaselineLock
  ) {
    store.setDocumentStructureBaselineLock(documentStructureBaselineLock)
    changed = true
  }

  return changed
}
