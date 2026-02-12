import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'

export async function testMarkdownWorkspaceWebpageHtmlViewRendersIframe() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as HTMLTextAreaElement | null }
    const presentationApiRef = { current: null }

    const text = ['---', 'kgWebpageUrl: "https://www.anygen.io"', 'kgWebpageView: "html"', '---', '', '# Title', ''].join('\n')

    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        layoutMode: 'viewer',
        setLayoutMode: () => {},
        markdownWordWrap: true,
        setMarkdownWordWrap: () => {},
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => {},
        statusLabel: null,
        onApply: () => {},
        onToggleFullscreen: () => {},
        presentationApiRef: presentationApiRef as unknown as React.MutableRefObject<any>,
        isEditing: false,
        isMarkdown: true,
        onFormatAction: () => {},
        onImportLocalFiles: () => {},
        onImportLocalFolder: () => {},
        onImportUrl: () => {},
        activeText: text,
        setActiveText: () => {},
        activeDocumentKey: '/webpage.md',
        highlightedLineRange: null,
        revealLineInEditor: () => {},
        showInViewer: () => {},
        showInPresentation: () => {},
        showInSlidesGallery: () => {},
        editorUri: 'inmemory://webpage.md',
        editorLanguage: 'markdown',
        editorRef: editorRef as unknown as React.MutableRefObject<HTMLTextAreaElement | null>,
      }),
    )

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })
    for (let i = 0; i < 5; i += 1) await tick()

    const iframe = doc.querySelector('iframe')
    if (!iframe) throw new Error('expected iframe')
    const src = String(iframe.getAttribute('src') || '')
    if (!src.startsWith('/__webpage_proxy?url=')) throw new Error('expected proxy iframe src')

    root.unmount()
  } finally {
    restore()
  }
}

