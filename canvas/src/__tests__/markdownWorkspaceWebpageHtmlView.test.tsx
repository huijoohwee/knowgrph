import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'
import type { MarkdownPresentationApi } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceTypes'

export async function testMarkdownWorkspaceWebpageHtmlViewRendersIframe() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as HTMLTextAreaElement | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

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

    const cases = [
      { view: 'html', expectsIframe: true },
      { view: 'json', expectsIframe: true },
      { view: 'wireframe', expectsIframe: true },
    ] as const

    for (const { view, expectsIframe } of cases) {
      const text = ['---', 'kgWebpageUrl: "https://localhost/"', `kgWebpageView: "${view}"`, '---', '', '# Title', ''].join('\n')
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
          presentationApiRef,
          isEditing: false,
          isMarkdown: true,
          onFormatAction: () => {},
          onImportLocalFiles: () => {},
          onImportLocalFolder: () => {},
          onImportUrl: () => {},
          onImportWebsite: () => {},
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

      for (let i = 0; i < 5; i += 1) await tick()

      const iframe = doc.querySelector('iframe')
      if (expectsIframe) {
        if (!iframe) throw new Error(`expected iframe for view=${view}`)
        const src = String(iframe.getAttribute('src') || '')
        if (!src.startsWith('/__webpage_proxy?url=')) throw new Error(`expected proxy iframe src for view=${view}`)
        const sandbox = String(iframe.getAttribute('sandbox') || '')
        if (sandbox.includes('allow-top-navigation')) throw new Error('expected iframe sandbox to forbid top navigation')
      } else {
        if (iframe) throw new Error(`expected no iframe for view=${view}`)
      }
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownWorkspaceEditorTextOverrideWorks() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as HTMLTextAreaElement | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    const markdown = ['---', 'kgWebpageUrl: "https://localhost/"', 'kgWebpageView: "json"', '---', '', '# Title', ''].join('\n')
    const jsonText = JSON.stringify({ ok: true, mode: 'json' }, null, 2)

    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        layoutMode: 'editor',
        setLayoutMode: () => {},
        markdownWordWrap: true,
        setMarkdownWordWrap: () => {},
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => {},
        statusLabel: null,
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
        activeText: markdown,
        setActiveText: () => {
          throw new Error('expected editor mutations disabled')
        },
        editorTextOverride: jsonText,
        disableEditorMutations: true,
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

    const textarea = doc.querySelector('textarea[aria-label="Markdown Editor Text"]') as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected editor textarea')
    if (textarea.value !== jsonText) throw new Error('expected editorTextOverride rendered')
    if (!textarea.readOnly) throw new Error('expected editor readonly')

    root.unmount()
  } finally {
    restore()
  }
}
