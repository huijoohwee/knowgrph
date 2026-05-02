import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownSourceFilesPanelEmptyState } from '@/features/markdown/ui/MarkdownSourceFilesPanelEmptyState'

export async function testMarkdownSourceFilesPanelEmptyStateCentralizesSourcePanelMessages() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownSourceFilesPanelEmptyState, {
          uiPanelTextFontClass: 'font-sans',
          folderName: null,
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const initialText = container.textContent || ''
    if (initialText !== 'Open a folder to load Markdown files.') {
      throw new Error(`expected open-folder empty state, got ${initialText}`)
    }

    await act(async () => {
      root.render(
        React.createElement(MarkdownSourceFilesPanelEmptyState, {
          uiPanelTextFontClass: 'font-sans',
          folderName: 'docs',
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const folderText = container.textContent || ''
    if (folderText !== 'No Markdown files found in this folder.') {
      throw new Error(`expected no-markdown-files empty state, got ${folderText}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
