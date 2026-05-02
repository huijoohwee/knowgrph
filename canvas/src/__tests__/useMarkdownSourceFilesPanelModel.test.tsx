import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { LS_KEYS } from '@/lib/config'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useMarkdownSourceFilesPanelModel } from '@/features/markdown/ui/useMarkdownSourceFilesPanelModel'

export async function testUseMarkdownSourceFilesPanelModelCentralizesSourcePanelOrchestration() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const selectedFileIds: string[] = []
  const selectedFolderPaths: string[] = []

  dom.window.localStorage.setItem(
    LS_KEYS.markdownExplorerSourceFilesExpandedPaths,
    JSON.stringify(['docs']),
  )

  function Harness(props: { selectedFolderPath?: string | null }) {
    const {
      expandedSourceFolderPaths,
      selectedSourceFolderPath,
      selectFolder,
      selectFile,
      visible,
    } = useMarkdownSourceFilesPanelModel({
      sourceFiles: [
        { id: 'a', name: 'docs/readme.md', active: true },
        { id: 'b', name: 'docs/guides/intro.md' },
      ],
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
        <button type="button" aria-label="select-guides" onClick={() => selectFolder('docs/guides')} />
        <button
          type="button"
          aria-label="select-intro"
          onClick={() => selectFile({ fileId: 'b', path: 'docs/guides/intro.md' })}
        />
        <span data-testid="selected-folder">{selectedSourceFolderPath}</span>
        <span data-testid="expanded-paths">{Array.from(expandedSourceFolderPaths).sort().join('|')}</span>
        <span data-testid="visible-labels">{visible.map(node => node.label).join('|')}</span>
      </section>
    )
  }

  try {
    await act(async () => {
      root.render(React.createElement(Harness, { selectedFolderPath: 'docs' }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const initialSelectedFolder = container.querySelector('[data-testid="selected-folder"]')?.textContent || ''
    const initialExpandedPaths = container.querySelector('[data-testid="expanded-paths"]')?.textContent || ''
    const initialVisibleLabels = container.querySelector('[data-testid="visible-labels"]')?.textContent || ''
    if (initialSelectedFolder !== 'docs') {
      throw new Error(`expected initial selected folder docs, got ${initialSelectedFolder}`)
    }
    if (initialExpandedPaths !== '|docs') {
      throw new Error(`expected persisted expanded docs path, got ${initialExpandedPaths}`)
    }
    if (initialVisibleLabels !== 'docs|readme.md|guides') {
      throw new Error(`expected visible nodes from persisted docs expansion, got ${initialVisibleLabels}`)
    }

    const guidesButton = container.querySelector('button[aria-label="select-guides"]')
    if (!(guidesButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected guides folder button')
    await act(async () => {
      guidesButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const afterFolderClickVisibleLabels = container.querySelector('[data-testid="visible-labels"]')?.textContent || ''
    if (afterFolderClickVisibleLabels !== 'docs|readme.md|guides|intro.md') {
      throw new Error(`expected guides selection to reveal intro.md, got ${afterFolderClickVisibleLabels}`)
    }
    if (selectedFolderPaths[0] !== 'docs/guides') {
      throw new Error(`expected guides folder callback, got ${JSON.stringify(selectedFolderPaths)}`)
    }

    const introButton = container.querySelector('button[aria-label="select-intro"]')
    if (!(introButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected intro file button')
    await act(async () => {
      introButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (selectedFileIds[0] !== 'b') {
      throw new Error(`expected intro file selection callback b, got ${JSON.stringify(selectedFileIds)}`)
    }
    if (selectedFolderPaths[selectedFolderPaths.length - 1] !== 'docs/guides') {
      throw new Error(`expected intro file click to preserve parent folder selection, got ${JSON.stringify(selectedFolderPaths)}`)
    }
    const persistedPathsRaw = dom.window.localStorage.getItem(LS_KEYS.markdownExplorerSourceFilesExpandedPaths)
    if (persistedPathsRaw !== JSON.stringify(['docs', 'docs/guides'])) {
      throw new Error(`expected persisted expanded paths to include guides, got ${String(persistedPathsRaw)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
