import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/features/markdown-workspace/main/MarkdownWorkspaceMain'
import type { MarkdownPresentationApi } from '@/features/markdown-workspace/markdownWorkspaceTypes'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { readWebpageArtifactFixture } from './helpers/webpageArtifactFixtures'

export async function testMarkdownWorkspaceViewerRendersRemotionArtifactRichMedia() {
  const { markdownText, activeDocumentPath, editorUri } = readWebpageArtifactFixture('remotion')

  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        explorerOpen: true,
        setExplorerOpen: () => {},
        layoutMode: 'viewer',
        setLayoutMode: () => {},
        markdownWordWrap: true,
        setMarkdownWordWrap: () => {},
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => {},
        onToggleFullscreen: () => {},
        presentationApiRef,
        isMarkdown: true,
        activeText: markdownText,
        setActiveText: () => {},
        activeDocumentKey: activeDocumentPath,
        highlightedLineRange: null,
        revealLineInEditor: () => {},
        showInViewer: () => {},
        showInPresentation: () => {},
        showInSlidesGallery: () => {},
        editorUri,
        editorLanguage: 'markdown',
        editorRef: editorRef as unknown as React.MutableRefObject<MonacoTextEditorHandle | null>,
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

    for (let i = 0; i < 10; i += 1) await tick()

    const h1 = container.querySelector('h1')
    if (!h1 || !String(h1.textContent || '').toLowerCase().includes('make videos')) {
      throw new Error('expected Remotion page heading to render in workspace viewer')
    }

    const videos = container.querySelectorAll('video')
    const webmLink = (Array.from(container.querySelectorAll('a')) as unknown as HTMLElement[]).some(a =>
      /\.webm(\b|$)/i.test(String((a as HTMLElement).getAttribute('href') || '')),
    )
    if (videos.length < 1 && !webmLink) throw new Error('expected at least one video (or a .webm link) to render in workspace viewer')

    root.unmount()
  } finally {
    restore()
  }
}
