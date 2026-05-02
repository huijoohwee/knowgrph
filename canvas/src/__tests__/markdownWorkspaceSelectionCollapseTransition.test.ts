import { resolveMarkdownWorkspaceSelectionCollapseTransition } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionCollapseTransition'

export function testMarkdownWorkspaceSelectionCollapseTransitionCentralizesCollapseAndRestoreBranching() {
  const path = '/docs/demo.md' as never

  const captureTransition = resolveMarkdownWorkspaceSelectionCollapseTransition({
    path,
    prevCollapsed: false,
    collapsed: true,
    activeText: '# Draft',
    collapsedSnapshot: null,
    lastLoaded: null,
  })
  if (captureTransition.kind !== 'capture-transition' || captureTransition.snapshot.text !== '# Draft') {
    throw new Error(`expected collapse transition to capture the active text snapshot, got ${JSON.stringify(captureTransition)}`)
  }

  const restoreTransition = resolveMarkdownWorkspaceSelectionCollapseTransition({
    path,
    prevCollapsed: true,
    collapsed: false,
    activeText: '',
    collapsedSnapshot: { path, text: '# Snapshot' },
    lastLoaded: { path, text: '# Last loaded' },
  })
  if (restoreTransition.kind !== 'restore-transition' || restoreTransition.text !== '# Snapshot') {
    throw new Error(`expected expand transition to restore the preferred snapshot text, got ${JSON.stringify(restoreTransition)}`)
  }

  const skipWhenEditorHasText = resolveMarkdownWorkspaceSelectionCollapseTransition({
    path,
    prevCollapsed: true,
    collapsed: false,
    activeText: '# Already editing',
    collapsedSnapshot: { path, text: '# Snapshot' },
    lastLoaded: { path, text: '# Last loaded' },
  })
  if (skipWhenEditorHasText.kind !== 'noop') {
    throw new Error(`expected expand transition to skip restore when editor text is already present, got ${JSON.stringify(skipWhenEditorHasText)}`)
  }

  const captureWhileCollapsed = resolveMarkdownWorkspaceSelectionCollapseTransition({
    path,
    prevCollapsed: true,
    collapsed: true,
    activeText: '# Draft',
    collapsedSnapshot: null,
    lastLoaded: null,
  })
  if (captureWhileCollapsed.kind !== 'capture-collapsed' || captureWhileCollapsed.snapshot.text !== '# Draft') {
    throw new Error(`expected collapsed mode to keep refreshing the snapshot from active text, got ${JSON.stringify(captureWhileCollapsed)}`)
  }

  const restoreWhileCollapsed = resolveMarkdownWorkspaceSelectionCollapseTransition({
    path,
    prevCollapsed: true,
    collapsed: true,
    activeText: '',
    collapsedSnapshot: { path, text: '# Snapshot' },
    lastLoaded: null,
  })
  if (restoreWhileCollapsed.kind !== 'restore-collapsed' || restoreWhileCollapsed.text !== '# Snapshot') {
    throw new Error(`expected collapsed mode to recover snapshot text when editor text is blank, got ${JSON.stringify(restoreWhileCollapsed)}`)
  }
}
