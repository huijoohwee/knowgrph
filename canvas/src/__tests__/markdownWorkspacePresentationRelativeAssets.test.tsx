import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'

export async function testMarkdownWorkspacePresentationResolvesRelativeAssetsAndRendersTables() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '# Doc',
      '',
      '![](images/a.png)',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
    ].join('\n')

    const presentationApiRef = { current: null } as React.MutableRefObject<{ prev: () => void; next: () => void } | null>

    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        layoutMode: 'presentation',
        setLayoutMode: () => void 0,
        markdownWordWrap: true,
        setMarkdownWordWrap: () => void 0,
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => void 0,
        statusLabel: { kind: 'info', label: '' },
        onApply: () => void 0,
        onToggleFullscreen: () => void 0,
        presentationApiRef,
        isEditing: false,
        isMarkdown: true,
        onFormatAction: () => void 0,
        onImportLocalFiles: () => void 0,
        onImportLocalFolder: () => void 0,
        onImportUrl: () => void 0,
        onImportWebsite: () => void 0,
        activeText: markdownText,
        setActiveText: () => void 0,
        viewerTextOverride: null,
        disableViewerMutations: true,
        activeDocumentKey: 'docs/doc.md',
        highlightedLineRange: null,
        revealLineInEditor: () => void 0,
        showInViewer: () => void 0,
        showInPresentation: () => void 0,
        showInSlidesGallery: () => void 0,
        editorUri: 'docs/doc.md',
        editorLanguage: 'markdown',
        editorRef: { current: null },
      } as never),
    )

    await new Promise<void>(resolve => setTimeout(() => resolve(), 0))

    const img = container.querySelector('img')
    if (!img) throw new Error('expected an <img> in presentation mode')
    const srcAttr = img.getAttribute('src') || ''
    if (srcAttr !== '/@fs/docs/images/a.png') {
      throw new Error(`expected relative image to resolve to /@fs URL, got ${srcAttr}`)
    }

    const table = container.querySelector('table')
    if (!table) throw new Error('expected a <table> in presentation mode')

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
