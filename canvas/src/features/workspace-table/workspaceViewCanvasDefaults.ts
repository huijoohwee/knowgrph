export const WORKSPACE_EDITOR_CANVAS_DEFAULT_SPLIT = {
  explorerPercent: 5,
  jsonPercent: 20,
  markdownPercent: 20,
  viewerPercent: 20,
  canvasPercent: 35,
} as const

export const WORKSPACE_MULTI_DIMENSIONAL_TABLE_DEFAULT_SPLIT = {
  tablePercent: 65,
  canvasPercent: 35,
} as const

const DEFAULT_VIEWPORT_WIDTH_PX = 1440

function resolveViewportWidthPx(): number {
  if (typeof window === 'undefined') return DEFAULT_VIEWPORT_WIDTH_PX
  const width = Number(window.innerWidth)
  if (!Number.isFinite(width) || width <= 0) return DEFAULT_VIEWPORT_WIDTH_PX
  return Math.round(width)
}

function clampPx(px: number, minPx: number, maxPx: number): number {
  return Math.max(minPx, Math.min(maxPx, Math.round(px)))
}

export function resolveWorkspacePaneMaxWidthPx(args: { minPx: number; rightGutterPx: number }): number {
  const viewport = resolveViewportWidthPx()
  const gutter = Math.max(0, Math.floor(args.rightGutterPx))
  const maxFromViewport = Math.max(args.minPx, viewport - gutter)
  return Math.max(args.minPx, maxFromViewport)
}

export function resolveWorkspaceEditorPaneDefaultWidthPx(args: { minPx: number; maxPx: number }): number {
  const viewport = resolveViewportWidthPx()
  const ratio = 1 - (WORKSPACE_EDITOR_CANVAS_DEFAULT_SPLIT.canvasPercent / 100)
  return clampPx(viewport * ratio, args.minPx, args.maxPx)
}

export function resolveWorkspaceCanvasPreviewDefaultWidthPx(args: { minPx: number; maxPx: number }): number {
  const viewport = resolveViewportWidthPx()
  const ratio = WORKSPACE_MULTI_DIMENSIONAL_TABLE_DEFAULT_SPLIT.canvasPercent / 100
  return clampPx(viewport * ratio, args.minPx, args.maxPx)
}

export function resolveWorkspaceExplorerDefaultWidthPx(args: { minPx: number; maxPx: number }): number {
  const viewport = resolveViewportWidthPx()
  const ratio = WORKSPACE_EDITOR_CANVAS_DEFAULT_SPLIT.explorerPercent / 100
  return clampPx(viewport * ratio, args.minPx, args.maxPx)
}
