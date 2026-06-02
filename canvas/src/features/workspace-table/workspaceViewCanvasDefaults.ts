export const WORKSPACE_EDITOR_CANVAS_DEFAULT_SPLIT = {
  explorerPercent: 16,
  jsonPercent: 3,
  markdownPercent: 6,
  viewerPercent: 3,
  canvasPercent: 72,
} as const

export const WORKSPACE_MULTI_DIMENSIONAL_TABLE_DEFAULT_SPLIT = {
  tablePercent: 65,
  canvasPercent: 35,
} as const

const DEFAULT_VIEWPORT_WIDTH_PX = 1440
export const WORKSPACE_EDITOR_CANVAS_GUTTER_PX = 48
export const WORKSPACE_EDITOR_CANVAS_GUTTER_CSS = `${WORKSPACE_EDITOR_CANVAS_GUTTER_PX / 16}rem`
const MIN_WORKSPACE_CANVAS_VISIBLE_STRIP_DESKTOP_RATIO = 0.28
const MIN_WORKSPACE_CANVAS_VISIBLE_STRIP_COMPACT_RATIO = 0.12
const MIN_WORKSPACE_CANVAS_VISIBLE_STRIP_MIN_PX = 420
const MIN_WORKSPACE_CANVAS_VISIBLE_STRIP_MAX_PX = 640
const WORKSPACE_EDITOR_PANE_MIN_WIDTH_PX = 320
const WORKSPACE_EDITOR_PANE_COMPACT_MIN_RATIO = 0.75
const WORKSPACE_EDITOR_PANE_COMPACT_MIN_PX = 192
const WORKSPACE_EDITOR_PANE_COMPACT_BREAKPOINT_PX = 768

function resolveViewportWidthPx(): number {
  if (typeof window === 'undefined') return DEFAULT_VIEWPORT_WIDTH_PX
  const width = Number(window.innerWidth)
  if (!Number.isFinite(width) || width <= 0) return DEFAULT_VIEWPORT_WIDTH_PX
  return Math.round(width)
}

function clampPx(px: number, minPx: number, maxPx: number): number {
  return Math.max(minPx, Math.min(maxPx, Math.round(px)))
}

export function resolveWorkspaceCanvasMinVisibleStripPx(): number {
  const viewport = resolveViewportWidthPx()
  const compact = viewport <= WORKSPACE_EDITOR_PANE_COMPACT_BREAKPOINT_PX
  const ratio = compact
    ? MIN_WORKSPACE_CANVAS_VISIBLE_STRIP_COMPACT_RATIO
    : MIN_WORKSPACE_CANVAS_VISIBLE_STRIP_DESKTOP_RATIO
  const minPx =
    compact
      ? WORKSPACE_EDITOR_CANVAS_GUTTER_PX
      : MIN_WORKSPACE_CANVAS_VISIBLE_STRIP_MIN_PX
  return clampPx(
    viewport * ratio,
    minPx,
    MIN_WORKSPACE_CANVAS_VISIBLE_STRIP_MAX_PX,
  )
}

export function resolveWorkspaceEditorPaneMinWidthPx(): number {
  const viewport = resolveViewportWidthPx()
  if (viewport > WORKSPACE_EDITOR_PANE_COMPACT_BREAKPOINT_PX) {
    return WORKSPACE_EDITOR_PANE_MIN_WIDTH_PX
  }
  return clampPx(
    viewport * WORKSPACE_EDITOR_PANE_COMPACT_MIN_RATIO,
    WORKSPACE_EDITOR_PANE_COMPACT_MIN_PX,
    WORKSPACE_EDITOR_PANE_MIN_WIDTH_PX,
  )
}

export function resolveWorkspacePaneMaxWidthPx(args: { minPx: number; rightGutterPx: number }): number {
  const viewport = resolveViewportWidthPx()
  const gutter = Math.max(0, Math.floor(args.rightGutterPx))
  // Keep enough canvas visible for fit/recovery to preserve a readable centered collective.
  const minCanvasVisibleStripPx = resolveWorkspaceCanvasMinVisibleStripPx()
  const reservedCanvasStripPx = Math.max(gutter, minCanvasVisibleStripPx)
  const maxFromViewport = Math.max(args.minPx, viewport - reservedCanvasStripPx)
  return Math.max(args.minPx, maxFromViewport)
}

export function resolveWorkspaceEditorPaneDefaultWidthPx(args: { minPx: number; maxPx: number }): number {
  const viewport = resolveViewportWidthPx()
  if (viewport <= WORKSPACE_EDITOR_PANE_COMPACT_BREAKPOINT_PX) {
    return args.maxPx
  }
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
