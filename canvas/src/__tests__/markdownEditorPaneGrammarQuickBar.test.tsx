import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { MarkdownEditorPane } from '@/features/markdown-workspace/main/editor/MarkdownEditorPane'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

export async function testMarkdownEditorPaneGrammarQuickBarSeedsSigilsAtTheCaret() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const editorRef = { current: null as MonacoTextEditorHandle | null }

  function Harness() {
    const [value, setValue] = React.useState('')
    return (
      <MarkdownEditorPane
        value={value}
        onChange={setValue}
        wordWrap={true}
        editorRef={editorRef}
        panelTypography={{ panelTextClass: 'text-sm', panelMonospaceTextClass: 'font-mono text-xs' }}
        themeMode="light"
        language="markdown"
        uri="file:///grammar-quick-bar.md"
        ariaLabel="Markdown Editor Text"
      />
    )
  }

  try {
    await mountReactRoot(root, React.createElement(Harness), {
      window: dom.window as unknown as Window,
      frames: 2,
    })

    const quickBar = container.querySelector('[data-kg-markdown-editor-grammar-quick-bar="true"]') as HTMLElement | null
    if (!quickBar) throw new Error('expected MarkdownEditorPane to render the mobile grammar quick bar')
    if (!String(quickBar.className || '').includes('sm:hidden')) {
      throw new Error(`expected MarkdownEditorPane quick bar to stay mobile-only, got ${JSON.stringify(quickBar.className)}`)
    }

    const textarea = container.querySelector('textarea[aria-label="Markdown Editor Text"]') as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected MarkdownEditorPane textarea fallback')

    const slashButton = container.querySelector('[data-kg-markdown-editor-grammar-quick-bar-token="/"]') as HTMLButtonElement | null
    if (!slashButton) throw new Error('expected MarkdownEditorPane slash quick bar button')

    await act(async () => {
      slashButton.click()
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    if (textarea.value !== '/') {
      throw new Error(`expected slash quick bar button to seed slash token at the caret, got ${JSON.stringify(textarea.value)}`)
    }

    await act(async () => {
      textarea.value = 'Tell me'
      Simulate.change(textarea)
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    await act(async () => {
      editorRef.current?.setSelectionOffsets(textarea.value.length, textarea.value.length)
      editorRef.current?.focus()
      await waitForFrames(dom.window as unknown as Window, 1)
    })

    const keywordButton = container.querySelector('[data-kg-markdown-editor-grammar-quick-bar-token="#"]') as HTMLButtonElement | null
    if (!keywordButton) throw new Error('expected MarkdownEditorPane keyword quick bar button')

    await act(async () => {
      keywordButton.click()
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    if (textarea.value !== 'Tell me #') {
      throw new Error(`expected keyword quick bar button to append a spaced token at the caret, got ${JSON.stringify(textarea.value)}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
