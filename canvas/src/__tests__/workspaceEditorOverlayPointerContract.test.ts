import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveWorkspacePreviewWidthFromPointerDrag } from '@/features/canvas/useCanvasWorkspacePaneRuntime'

function readMarkdownDesignOverlaySourceText(): string {
  const base = resolve(process.cwd(), 'src')
  const candidatePaths = [
    resolve(base, 'features', 'markdown-edgeless', 'MarkdownDesignOverlay.tsx'),
    resolve(base, 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx'),
  ]
  let latest = ''
  for (let i = 0; i < candidatePaths.length; i += 1) {
    const text = readFileSync(candidatePaths[i], 'utf8')
    latest = text
    if (text.includes('pointer-events-none') || text.includes("pointerEvents: 'none'")) {
      return text
    }
  }
  return latest
}

export function testWorkspaceEditorOverlayDoesNotInstallBlockingScrim() {
  const text = readMarkdownDesignOverlaySourceText()
  if (!text.includes('pointer-events-none')) {
    throw new Error('expected MarkdownDesignOverlay root to be pointer-events-none by default')
  }
  if (!text.includes("pointerEvents: 'none'")) {
    throw new Error('expected MarkdownDesignOverlay drag mask to be pointerEvents none')
  }
}

export function testGraphDataTableOverlayDoesNotUseFullscreenScrim() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-data-table', 'ui', 'GraphDataTablePanelOverlay.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('inset: 0') || text.includes('inset-0') || text.includes('fixed inset-0')) {
    throw new Error('expected GraphDataTablePanelOverlay not to render a fullscreen scrim')
  }
}

export function testWorkspaceEditorOverlayDoesNotMutateDesignCanvasLayout() {
  const p = resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  const cleanupPath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useGlobalInteractionCleanup.ts')
  const cleanupText = readFileSync(cleanupPath, 'utf8')
  if (!text.includes("const workspaceEditorOverlayMode = snapshot.workspaceViewMode === 'editor'")) {
    throw new Error('expected DesignCanvas to derive explicit workspace editor overlay mode state')
  }
  if (!text.includes('const interactionActive = active && !workspaceEditorOverlayMode')) {
    throw new Error('expected DesignCanvas interactions to be gated by workspace editor overlay mode')
  }
  if (!text.includes('const workspaceEditorOverlayEnabled = workspaceEditorOverlayMode && active && !!String(snapshot.markdownDocumentText || \'\').trim()')) {
    throw new Error('expected DesignCanvas markdown workspace overlay to enable only in workspace editor mode')
  }
  if (!text.includes('event.stopPropagation()')) {
    throw new Error('expected DesignCanvas workspace overlay events to stop propagation before reaching the canvas underneath')
  }
  if (!text.includes('<DesignCanvasArrangeActionBar active={interactionActive}')) {
    throw new Error('expected arrange actions to disable while workspace editor overlay is active')
  }
  if (!text.includes('if (!interactionActive) return')) {
    throw new Error('expected DesignCanvas layout writes to short-circuit while workspace editor overlay is enabled')
  }
  if (!text.includes('if (!interactionActive) return\n                        if (isSpacePanHeld()) return')) {
    throw new Error('expected group selection pointerdown to stop reacting while workspace editor overlay is enabled')
  }
  if (!text.includes('useGlobalInteractionCleanup({\n    interactionActive,')) {
    throw new Error('expected DesignCanvas to forward interactionActive into shared global interaction cleanup')
  }
  if (!cleanupText.includes('if (interactionActive) return')) {
    throw new Error('expected global interaction cleanup to react when canvas interactivity is disabled')
  }
  if (!cleanupText.includes('cancelAll()')) {
    throw new Error('expected global interaction cleanup to cancel active interactions when editor overlay mode turns on')
  }
}

export function testWorkspaceEditorOverlayDoesNotShrinkCanvasViewport() {
  const p = resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')
  const text = readFileSync(p, 'utf8')
  const separatorPath = resolve(process.cwd(), 'src', 'components', 'ui', 'VerticalResizeSeparatorHr.tsx')
  const separatorText = readFileSync(separatorPath, 'utf8')
  const workspaceSelectPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'EditorWorkspaceSelect.tsx')
  const workspaceSelectText = readFileSync(workspaceSelectPath, 'utf8')
  const workspaceSsotPath = resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceTableSsot.ts')
  const workspaceSsotText = readFileSync(workspaceSsotPath, 'utf8')
  const workspaceToolbarPath = resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'MarkdownWorkspaceToolbar.tsx')
  const workspaceToolbarText = readFileSync(workspaceToolbarPath, 'utf8')
  if (!text.includes('const workspaceEditorOverlayOpen = effectiveWorkspaceViewMode === \'editor\' && workspaceCanvasPaneOpen')) {
    throw new Error('expected Canvas page to derive a dedicated workspace editor overlay-open state')
  }
  if (!text.includes('{workspaceEditorOverlayOpen ? (')) {
    throw new Error('expected Canvas page to mount the workspace editor overlay only while the pane is open')
  }
  if (!text.includes('aria-label="Workspace editor overlay shell"')) {
    throw new Error('expected Canvas page to render workspace editor in an absolute overlay shell')
  }
  if (!text.includes('layout="full"')) {
    throw new Error('expected Canvas viewport to remain in full layout while workspace editor overlay is active')
  }
  if (text.includes("layout={effectiveWorkspaceViewMode === 'editor' ? 'pane' : 'full'}")) {
    throw new Error('expected Canvas page to avoid pane-layout shrinkage when workspace editor is enabled')
  }
  if (text.includes("style={effectiveWorkspaceViewMode === 'editor' ? (workspaceCanvasPaneOpen ? { width: `${workspacePreviewWidthPx}px` } : undefined) : undefined}")) {
    throw new Error('expected Canvas pane width not to be reduced by workspace editor mode')
  }
  if (!text.includes('visualStyle="centerGrip"')) {
    throw new Error('expected Workspace Editor overlay to use centered resize grip styling instead of a full-height line')
  }
  if (!separatorText.includes("visualStyle?: 'line' | 'centerGrip'")) {
    throw new Error('expected VerticalResizeSeparatorHr to expose a dedicated centered grip variant')
  }
  if (!separatorText.includes("backgroundSize: '1px 3.5rem'")) {
    throw new Error('expected centered grip variant to render a short centered separator instead of a full-height stroke')
  }
  if (text.includes("${workspaceEditorOverlayOpen ? '' : 'hidden'}")) {
    throw new Error('expected Canvas page not to keep a hidden workspace editor separator mounted while the pane is off')
  }
  if (!workspaceSsotText.includes('export function openWorkspaceEditorPane')) {
    throw new Error('expected workspace editor open flow to stay centralized in a shared helper')
  }
  if (!workspaceSsotText.includes("if (args.workspaceCanvasPaneOpen !== true) args.setWorkspaceCanvasPaneOpen(true)")) {
    throw new Error('expected shared workspace open helper to reopen the canvas pane and clear stale OFF residue')
  }
  if (!workspaceSsotText.includes('export function closeWorkspaceView')) {
    throw new Error('expected workspace editor close flow to stay centralized in a shared helper')
  }
  if (!workspaceSelectText.includes('openWorkspaceEditorPane({')) {
    throw new Error('expected toolbar Workspace View editor selection to reuse the shared workspace open helper')
  }
  if (!workspaceSelectText.includes('workspaceCanvasPaneOpen')) {
    throw new Error('expected toolbar Workspace View selection to route stale pane-open state through the shared helper')
  }
  if (!workspaceSelectText.includes('closeWorkspaceView({')) {
    throw new Error('expected toolbar Workspace View ON/OFF to reuse the shared close helper for residue cleanup')
  }
  if (!workspaceToolbarText.includes('closeWorkspaceView({')) {
    throw new Error('expected workspace close action to reuse the shared close helper for residue cleanup')
  }
}

export function testWorkspaceEditorOverlayResizeHandleDragDirection() {
  const widened = resolveWorkspacePreviewWidthFromPointerDrag({
    startWidthPx: 400,
    startClientX: 100,
    currentClientX: 160,
  })
  if (widened !== 460) {
    throw new Error(`expected rightward drag to widen overlay from 400 to 460, got ${widened}`)
  }

  const narrowed = resolveWorkspacePreviewWidthFromPointerDrag({
    startWidthPx: 400,
    startClientX: 100,
    currentClientX: 40,
  })
  if (narrowed !== 340) {
    throw new Error(`expected leftward drag to narrow overlay from 400 to 340, got ${narrowed}`)
  }

  const minClamped = resolveWorkspacePreviewWidthFromPointerDrag({
    startWidthPx: 330,
    startClientX: 100,
    currentClientX: -200,
  })
  if (minClamped !== 320) {
    throw new Error(`expected overlay width to clamp at 320, got ${minClamped}`)
  }
}
