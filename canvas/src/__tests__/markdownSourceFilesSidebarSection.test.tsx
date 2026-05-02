import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownSourceFilesSidebarSection } from '@/features/markdown/ui/MarkdownSourceFilesSidebarSection'

export async function testMarkdownSourceFilesSidebarSectionCentralizesLayoutSourceFilesAssembly() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let openFolderCalls = 0
  let refreshCalls = 0
  let createFolderCalls = 0
  let createFileCalls = 0
  const selectedFileIds: string[] = []
  const selectedFolderPaths: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownSourceFilesSidebarSection, {
          uiPanelTextFontClass: 'font-sans',
          uiPanelMicroLabelTextSizeClass: 'text-[10px]',
          uiPanelKeyValueTextSizeClass: 'text-xs',
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
            canWrite: true,
            accessMode: 'read-write',
            onOpenFolder: () => {
              openFolderCalls += 1
            },
            onRefreshFiles: () => {
              refreshCalls += 1
            },
            onCreateFolder: () => {
              createFolderCalls += 1
              return null
            },
            onCreateFile: () => {
              createFileCalls += 1
            },
            onSelectedFolderPathChange: (path: string) => {
              selectedFolderPaths.push(path)
            },
          },
          collapsed: false,
          onToggleCollapsed: () => void 0,
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const initialText = container.textContent || ''
    if (!initialText.includes('Writable') || !initialText.includes('read-write')) {
      throw new Error(`expected source files status strip, got ${initialText}`)
    }
    if (!initialText.includes('docs')) {
      throw new Error(`expected source files section title or root node, got ${initialText}`)
    }

    for (const title of ['Open folder', 'Refresh', 'New folder', 'New file']) {
      const button = container.querySelector(`button[aria-label="${title}"]`)
      if (!(button instanceof dom.window.HTMLButtonElement)) throw new Error(`expected ${title} button`)
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        await new Promise(resolve => setTimeout(resolve, 0))
      })
    }

    if (openFolderCalls !== 1) throw new Error(`expected open folder once, got ${String(openFolderCalls)}`)
    if (refreshCalls !== 1) throw new Error(`expected refresh once, got ${String(refreshCalls)}`)
    if (createFolderCalls !== 1) throw new Error(`expected create folder once, got ${String(createFolderCalls)}`)
    if (createFileCalls !== 1) throw new Error(`expected create file once, got ${String(createFileCalls)}`)

    const docsButton = container.querySelector('button[role="treeitem"][title="docs"]')
    if (!(docsButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected docs folder button')
    await act(async () => {
      docsButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const afterExpand = container.textContent || ''
    if (!afterExpand.includes('readme.md') || !afterExpand.includes('guides')) {
      throw new Error(`expected nested source files after expand, got ${afterExpand}`)
    }
    if (selectedFolderPaths[0] !== 'docs') {
      throw new Error(`expected docs folder selection, got ${JSON.stringify(selectedFolderPaths)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
