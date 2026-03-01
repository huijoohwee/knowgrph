import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'

export async function testMarkdownWorkspaceViewerRendersMarkdownImage() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        explorerOpen: false,
        setExplorerOpen: () => void 0,
        layoutMode: 'viewer',
        setLayoutMode: () => void 0,
        markdownWordWrap: true,
        setMarkdownWordWrap: () => void 0,
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => void 0,
        statusLabel: null,
        onApply: () => void 0,
        onToggleFullscreen: () => void 0,
        presentationApiRef: { current: null },
        isEditing: false,
        isMarkdown: true,
        onFormatAction: () => void 0,
        onImportLocalFiles: () => void 0,
        onImportLocalFolder: () => void 0,
        onImportUrl: () => void 0,
        onImportWebsite: () => void 0,
        activeText: ['# Title', '', '![](https://example.com/a.jpeg)', ''].join('\n'),
        setActiveText: () => void 0,
        activeDocumentKey: '/test.md',
        highlightedLineRange: null,
        revealLineInEditor: () => void 0,
        showInViewer: () => void 0,
        showInPresentation: () => void 0,
        showInSlidesGallery: () => void 0,
        editorUri: 'file:///test.md',
        editorLanguage: 'markdown',
        editorRef: { current: null },
      }),
    )

    for (let i = 0; i < 30; i += 1) {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 0))
      const img = container.querySelector('img')
      if (img) break
    }

    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[]
    const srcs = imgs.map(i => String(i.getAttribute('src') || ''))
    const ok = srcs.some(s => {
      const raw = String(s || '')
      if (raw.includes('https://example.com/a.jpeg')) return true
      try {
        return decodeURIComponent(raw).includes('https://example.com/a.jpeg')
      } catch {
        return raw.includes('a.jpeg')
      }
    })
    if (!ok) {
      throw new Error(`expected markdown image to render in viewer, got: ${srcs.join(', ')}`)
    }
  } finally {
    try { root.unmount() } catch { void 0 }
    restore()
  }
}
