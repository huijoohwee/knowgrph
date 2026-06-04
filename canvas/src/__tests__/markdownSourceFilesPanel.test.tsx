import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownSourceFilesPanel } from '@/features/markdown/ui/MarkdownSourceFilesPanel'

export async function testMarkdownSourceFilesPanelUsesSharedTreeModel() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const selectedFileIds: string[] = []
  const selectedFolderPaths: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownSourceFilesPanel, {
          uiPanelTextFontClass: 'font-sans',
          sourceFiles: [
            { id: 'a', name: 'docs/readme.md', active: true },
            { id: 'b', name: 'docs/guides/intro.md' },
          ],
          onSourceFileSelect: (id: string) => {
            selectedFileIds.push(id)
          },
          integration: {
            iconClassName: 'w-3 h-3',
            folderName: 'docs',
            canWrite: false,
            accessMode: 'read-write',
            onOpenFolder: () => void 0,
            onSelectedFolderPathChange: (path: string) => {
              selectedFolderPaths.push(path)
            },
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const initialText = container.textContent || ''
    if (!initialText.includes('docs')) throw new Error('expected source files panel to render root folder node')
    if (initialText.includes('intro.md')) throw new Error('expected nested intro file to stay collapsed until folder expansion')

    const docsButton = (Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.textContent?.includes('docs'),
    ) || null
    if (!(docsButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected docs folder button')
    await act(async () => {
      docsButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const afterDocsExpand = container.textContent || ''
    if (!afterDocsExpand.includes('readme.md') || !afterDocsExpand.includes('guides')) {
      throw new Error(`expected docs expansion to reveal nested items, got ${afterDocsExpand}`)
    }
    if (selectedFolderPaths[0] !== 'docs') throw new Error(`expected docs folder selection callback, got ${JSON.stringify(selectedFolderPaths)}`)

    const guidesButton = (Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.textContent?.includes('guides'),
    ) || null
    if (!(guidesButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected guides folder button')
    await act(async () => {
      guidesButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const afterGuidesExpand = container.textContent || ''
    if (!afterGuidesExpand.includes('intro.md')) throw new Error('expected guides expansion to reveal intro.md')

    const introButton = (Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]).find(
      button => button.textContent?.includes('intro.md'),
    ) || null
    if (!(introButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected intro file button')
    await act(async () => {
      introButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (selectedFileIds[0] !== 'b') throw new Error(`expected intro file click to select file b, got ${JSON.stringify(selectedFileIds)}`)
    if (selectedFolderPaths[selectedFolderPaths.length - 1] !== 'docs/guides') {
      throw new Error(`expected intro file click to update selected folder to docs/guides, got ${JSON.stringify(selectedFolderPaths)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
