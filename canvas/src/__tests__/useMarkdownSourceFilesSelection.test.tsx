import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useMarkdownSourceFilesSelection } from '@/features/markdown/ui/useMarkdownSourceFilesSelection'

export async function testUseMarkdownSourceFilesSelectionCentralizesSourcePanelSelectionState() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const selectedFolderPaths: string[] = []
  const selectedFileIds: string[] = []

  function Harness(props: { selectedFolderPath?: string | null }) {
    const {
      expandedSourceFolderPaths,
      selectedSourceFolderPath,
      selectFile,
      selectFolder,
    } = useMarkdownSourceFilesSelection({
      initialExpandedPaths: ['docs'],
      selectedFolderPath: props.selectedFolderPath,
      onSelectedFolderPathChange: path => {
        selectedFolderPaths.push(path)
      },
      onSourceFileSelect: id => {
        selectedFileIds.push(id)
      },
    })

    return (
      <section>
        <button type="button" aria-label="select-docs" onClick={() => selectFolder('docs')} />
        <button
          type="button"
          aria-label="select-ref-file"
          onClick={() => selectFile({ fileId: 'ref-file', path: 'api/ref/index.md' })}
        />
        <span data-testid="selected-folder">{selectedSourceFolderPath}</span>
        <span data-testid="expanded-paths">{Array.from(expandedSourceFolderPaths).sort().join('|')}</span>
      </section>
    )
  }

  try {
    await act(async () => {
      root.render(React.createElement(Harness, { selectedFolderPath: 'docs/guides' }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const initialSelectedFolder = container.querySelector('[data-testid="selected-folder"]')?.textContent || ''
    const initialExpandedPaths = container.querySelector('[data-testid="expanded-paths"]')?.textContent || ''
    if (initialSelectedFolder !== 'docs/guides') {
      throw new Error(`expected selected folder docs/guides, got ${initialSelectedFolder}`)
    }
    if (initialExpandedPaths !== '|docs|docs/guides') {
      throw new Error(`expected initial expanded ancestors, got ${initialExpandedPaths}`)
    }

    const docsButton = container.querySelector('button[aria-label="select-docs"]')
    if (!(docsButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected docs button')
    await act(async () => {
      docsButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const selectedAfterFolderClick = container.querySelector('[data-testid="selected-folder"]')?.textContent || ''
    if (selectedAfterFolderClick !== 'docs') {
      throw new Error(`expected folder click to select docs, got ${selectedAfterFolderClick}`)
    }
    if (selectedFolderPaths[0] !== 'docs') {
      throw new Error(`expected docs callback after folder click, got ${JSON.stringify(selectedFolderPaths)}`)
    }

    await act(async () => {
      root.render(React.createElement(Harness, { selectedFolderPath: 'api/ref' }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const selectedAfterExternalChange = container.querySelector('[data-testid="selected-folder"]')?.textContent || ''
    const expandedAfterExternalChange = container.querySelector('[data-testid="expanded-paths"]')?.textContent || ''
    if (selectedAfterExternalChange !== 'api/ref') {
      throw new Error(`expected external folder selection api/ref, got ${selectedAfterExternalChange}`)
    }
    if (expandedAfterExternalChange !== '|api|api/ref|docs|docs/guides') {
      throw new Error(`expected external selection to expand api ancestors, got ${expandedAfterExternalChange}`)
    }

    const fileButton = container.querySelector('button[aria-label="select-ref-file"]')
    if (!(fileButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected file button')
    await act(async () => {
      fileButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const selectedAfterFileClick = container.querySelector('[data-testid="selected-folder"]')?.textContent || ''
    const expandedAfterFileClick = container.querySelector('[data-testid="expanded-paths"]')?.textContent || ''
    if (selectedAfterFileClick !== 'api/ref') {
      throw new Error(`expected file click to select parent folder api/ref, got ${selectedAfterFileClick}`)
    }
    if (selectedFileIds[0] !== 'ref-file') {
      throw new Error(`expected file click to emit ref-file, got ${JSON.stringify(selectedFileIds)}`)
    }
    if (selectedFolderPaths[selectedFolderPaths.length - 1] !== 'api/ref') {
      throw new Error(`expected file click to emit parent folder api/ref, got ${JSON.stringify(selectedFolderPaths)}`)
    }
    if (expandedAfterFileClick !== '|api|api/ref|docs|docs/guides') {
      throw new Error(`expected file click to preserve expanded api ancestors, got ${expandedAfterFileClick}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
