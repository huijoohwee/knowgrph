import { shouldAutosaveWorkspaceFile } from '@/components/BottomPanel/markdownWorkspace/workspaceAutosave'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export const testWorkspaceAutosaveGuardsAgainstPathSwitchOverwrite = () => {
  const path = '/a.md'
  const otherPath = '/b.md'

  if (shouldAutosaveWorkspaceFile({ path, lastLoaded: null, activeText: 'x', debouncedText: 'x' })) {
    throw new Error('expected false when no lastLoaded')
  }

  if (
    shouldAutosaveWorkspaceFile({
      path,
      lastLoaded: { path: otherPath, text: 'prev' },
      activeText: 'x',
      debouncedText: 'x',
    })
  ) {
    throw new Error('expected false when lastLoaded.path differs')
  }

  if (
    shouldAutosaveWorkspaceFile({
      path,
      lastLoaded: { path, text: 'same' },
      activeText: 'same',
      debouncedText: 'same',
    })
  ) {
    throw new Error('expected false when no edits')
  }

  if (
    shouldAutosaveWorkspaceFile({
      path,
      lastLoaded: { path, text: 'loaded' },
      activeText: 'editing',
      debouncedText: 'still-typing',
    })
  ) {
    throw new Error('expected false while still typing')
  }

  if (
    !shouldAutosaveWorkspaceFile({
      path,
      lastLoaded: { path, text: 'loaded' },
      activeText: 'final',
      debouncedText: 'final',
    })
  ) {
    throw new Error('expected true when debounced matches edited text')
  }
}

export async function testMarkdownWorkspaceSplitPreviewFlushesOnDocKeyChange() {
  const { restore: restoreWindow } = initWindowHarness({ storage: null })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)

    const presentationApiRef = { current: null } as React.MutableRefObject<unknown>
    const editorRef = { current: null } as React.MutableRefObject<unknown>

    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        layoutMode: 'split',
        setLayoutMode: () => {},
        markdownWordWrap: true,
        setMarkdownWordWrap: () => {},
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => {},
        statusLabel: '',
        onApply: () => {},
        onToggleFullscreen: () => {},
        presentationApiRef,
        isEditing: true,
        isMarkdown: true,
        onFormatAction: () => {},
        onImportLocalFiles: () => {},
        onImportLocalFolder: () => {},
        onImportUrl: () => {},
        onImportWebsite: () => {},
        activeText: '# Hello',
        setActiveText: () => {},
        outlineText: '',
        activeDocumentKey: 'docs/hello.md',
        highlightedLineRange: null,
        revealLineInEditor: () => {},
        showInViewer: () => {},
        showInPresentation: () => {},
        showInSlidesGallery: () => {},
        editorUri: 'inmemory://workspace/docs%2Fhello.md',
        editorLanguage: 'markdown',
        editorRef,
        setHighlightLine: () => {},
      } as never),
    )

    await new Promise<void>(resolve => setTimeout(() => resolve(), 0))

    const rootEl =
      (doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null) ||
      (doc.querySelector('[data-testid="markdown-preview"]') as HTMLDivElement | null) ||
      (doc.body as unknown as HTMLDivElement)
    const text = String(rootEl.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text.includes('Hello')) {
      throw new Error('expected split preview to render active text immediately after doc switch')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
