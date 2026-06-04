import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownBacklinksSidebarSection } from '@/features/markdown/ui/MarkdownBacklinksSidebarSection'

export async function testMarkdownBacklinksSidebarSectionCentralizesLayoutBacklinksAssembly() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const selectedFileIds: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownBacklinksSidebarSection, {
          uiPanelTextFontClass: 'font-sans',
          uiPanelMicroLabelTextSizeClass: 'text-[10px]',
          uiPanelKeyValueTextSizeClass: 'text-xs',
          activeDocumentKey: 'docs/current.md',
          sourceFiles: [
            { id: 'current', name: 'docs/current.md', text: '# Current' },
            { id: 'note-a', name: 'notes/a.md', text: 'See [current](docs/current.md)' },
            { id: 'note-b', name: 'notes/b.md', text: 'Link to [[docs/current.md]] and [current](docs/current.md)' },
          ],
          onSourceFileSelect: id => {
            selectedFileIds.push(id)
          },
          collapsed: false,
          onToggleCollapsed: () => void 0,
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const initialText = container.textContent || ''
    if (!initialText.includes('Backlinks')) {
      throw new Error(`expected backlinks section header, got ${initialText}`)
    }
    if (!initialText.includes('notes/a.md') || !initialText.includes('notes/b.md')) {
      throw new Error(`expected backlinks rows, got ${initialText}`)
    }

    const noteAButton = container.querySelector('button[title="notes/a.md"]')
    if (!(noteAButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected notes/a.md backlink row')
    await act(async () => {
      noteAButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (selectedFileIds[0] !== 'note-a') {
      throw new Error(`expected notes/a.md click to select note-a, got ${JSON.stringify(selectedFileIds)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
