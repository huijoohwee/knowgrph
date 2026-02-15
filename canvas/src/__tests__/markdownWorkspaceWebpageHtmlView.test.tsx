import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'
import type { MarkdownPresentationApi } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceTypes'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

export async function testMarkdownWorkspaceWebpageHtmlViewRendersIframe() {
  const { dom, restore } = initJsdomHarness()
  const prevFetch = (globalThis as unknown as { fetch?: unknown }).fetch
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    ;(globalThis as unknown as { fetch?: unknown }).fetch = (async () => {
      return {
        ok: true,
        status: 200,
        text: async () => '<!doctype html><html><head><base href="https://localhost/"></head><body><h1>OK</h1></body></html>',
      }
    }) as unknown

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
      { view: 'markdown', expectsIframe: false },
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
          editorRef: editorRef as unknown as React.MutableRefObject<MonacoTextEditorHandle | null>,
        }),
      )

      for (let i = 0; i < 5; i += 1) await tick()

      const iframe = doc.querySelector('iframe')
      if (expectsIframe) {
        if (!iframe) throw new Error(`expected iframe for view=${view}`)
        const src = String(iframe.getAttribute('src') || '')
        const srcdoc = String(iframe.getAttribute('srcdoc') || '')

        if (src) throw new Error(`expected no iframe src for srcdoc mode view=${view}`)
        if (!srcdoc.includes('<base')) throw new Error(`expected srcdoc to include base tag for view=${view}`)

        const sandbox = String(iframe.getAttribute('sandbox') || '')
        if (sandbox.includes('allow-top-navigation')) throw new Error('expected iframe sandbox to forbid top navigation')
      } else {
        if (iframe) throw new Error(`expected no iframe for view=${view}`)
      }
    }

    root.unmount()
  } finally {
    ;(globalThis as unknown as { fetch?: unknown }).fetch = prevFetch
    restore()
  }
}

export async function testMarkdownWorkspaceWebpageHtmlViewUsesWebsiteImportArtifactForHtml() {
  const { dom, restore } = initJsdomHarness()
  const prevFetch = (globalThis as unknown as { fetch?: unknown }).fetch
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    const seen: string[] = []
    ;(globalThis as unknown as { fetch?: unknown }).fetch = (async (input: unknown) => {
      const url = (() => {
        if (typeof input === 'string') return input
        if (input instanceof URL) return input.toString()
        if (input && typeof input === 'object' && 'url' in input) {
          const u = (input as { url?: unknown }).url
          return typeof u === 'string' ? u : String(u || '')
        }
        return ''
      })()
      seen.push(url)
      if (url.startsWith('/__website_import/artifact')) {
        return {
          ok: true,
          status: 200,
          text: async () => '<!doctype html><html><head></head><body><h1>OK</h1></body></html>',
        }
      }
      return {
        ok: false,
        status: 404,
        text: async () => 'not found',
      }
    }) as unknown

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
      { view: 'html', nodeId: 'node-html' },
      { view: 'json', nodeId: 'node-json' },
    ] as const

    for (const { view, nodeId } of cases) {
      seen.length = 0
      const text = [
        '---',
        'kgWebpageUrl: "https://localhost/"',
        `kgWebpageView: "${view}"`,
        'kgWebsiteImportId: "import"',
        `kgWebsiteNodeId: "${nodeId}"`,
        '---',
        '',
        '# Title',
        '',
      ].join('\n')
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
          editorRef: editorRef as unknown as React.MutableRefObject<MonacoTextEditorHandle | null>,
        }),
      )

      for (let i = 0; i < 5; i += 1) await tick()

      const iframe = doc.querySelector('iframe')
      if (!iframe) throw new Error(`expected iframe for view=${view}`)
      const src = String(iframe.getAttribute('src') || '')
      if (src) throw new Error(`expected no iframe src for srcdoc mode view=${view}`)
      const srcdoc = String(iframe.getAttribute('srcdoc') || '')
      if (!srcdoc.includes('<base')) throw new Error(`expected base tag injected for website import view=${view}`)
      if (!seen.some(u => u.startsWith('/__website_import/artifact'))) throw new Error(`expected website import artifact fetch view=${view}`)
      if (seen.some(u => u.startsWith('/__webpage_proxy'))) throw new Error(`expected no webpage proxy fetch when artifact available view=${view}`)
    }

    root.unmount()
  } finally {
    ;(globalThis as unknown as { fetch?: unknown }).fetch = prevFetch
    restore()
  }
}

export async function testMarkdownWorkspaceHtmlEditorSharesMarkdownSsot() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    const text = ['---', 'kgWebpageUrl: "https://localhost/"', 'kgWebpageView: "html"', '---', '', '# Title', ''].join('\n')

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
        activeText: text,
        setActiveText: () => {},
        disableEditorMutations: false,
        activeDocumentKey: '/webpage.md',
        highlightedLineRange: null,
        revealLineInEditor: () => {},
        showInViewer: () => {},
        showInPresentation: () => {},
        showInSlidesGallery: () => {},
        editorUri: 'inmemory://webpage.md',
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
    for (let i = 0; i < 5; i += 1) await tick()

    const textarea = doc.querySelector('textarea[aria-label="Markdown Editor Text"]') as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected editor textarea')
    if (textarea.readOnly) throw new Error('expected HTML view editor to remain editable')
    if (textarea.value !== text) throw new Error('expected HTML view editor to render Markdown SSOT text')

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

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    const cases = [
      {
        view: 'json',
        overrideText: JSON.stringify({ ok: true, mode: 'json' }, null, 2),
      },
      {
        view: 'markdown',
        overrideText: ['---', 'kgWebpageUrl: "https://localhost/"', 'kgWebpageView: "markdown"', '---', '', '# Webpage Markdown Artifact: localhost', '', '```text kg-webpage-layout', '[MOCKUP]', '```', ''].join('\n'),
      },
    ] as const

    for (const { view, overrideText } of cases) {
      const markdown = ['---', 'kgWebpageUrl: "https://localhost/"', `kgWebpageView: "${view}"`, '---', '', '# Title', ''].join('\n')
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
          editorTextOverride: overrideText,
          disableEditorMutations: true,
          activeDocumentKey: '/webpage.md',
          highlightedLineRange: null,
          revealLineInEditor: () => {},
          showInViewer: () => {},
          showInPresentation: () => {},
          showInSlidesGallery: () => {},
          editorUri: 'inmemory://webpage.md',
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
    for (let i = 0; i < 5; i += 1) await tick()

      const textarea = doc.querySelector('textarea[aria-label="Markdown Editor Text"]') as HTMLTextAreaElement | null
      if (!textarea) throw new Error('expected editor textarea')
      if (textarea.value !== overrideText) throw new Error('expected editorTextOverride rendered')
      if (!textarea.readOnly) throw new Error('expected editor readonly')
    }

    root.unmount()
  } finally {
    restore()
  }
}
