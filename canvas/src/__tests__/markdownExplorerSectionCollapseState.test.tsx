import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  persistMarkdownExplorerSectionCollapseState,
  readMarkdownExplorerSectionCollapseState,
  useMarkdownExplorerSectionCollapseState,
} from '@/features/markdown/ui/useMarkdownExplorerSectionCollapseState'

function Harness() {
  const state = useMarkdownExplorerSectionCollapseState()
  return (
    <section>
      <button type="button" title="toggle-source-files" onClick={state.toggleSourceFilesCollapsed}>
        source:{String(state.sourceFilesCollapsed)}
      </button>
      <button type="button" title="toggle-outline" onClick={state.toggleOutlineCollapsed}>
        outline:{String(state.outlineCollapsed)}
      </button>
      <button type="button" title="toggle-backlinks" onClick={state.toggleBacklinksCollapsed}>
        backlinks:{String(state.backlinksCollapsed)}
      </button>
    </section>
  )
}

export async function testMarkdownExplorerSectionCollapseStateCentralizesExplorerSidebarPersistence() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    dom.window.localStorage.clear()

    const persisted = persistMarkdownExplorerSectionCollapseState(
      {
        sourceFilesCollapsed: true,
        backlinksCollapsed: true,
      },
      dom.window.localStorage,
    )

    if (persisted.sourceFilesCollapsed !== true || persisted.outlineCollapsed !== false || persisted.backlinksCollapsed !== true) {
      throw new Error(`expected normalized persisted explorer collapse state, got ${JSON.stringify(persisted)}`)
    }

    const initial = readMarkdownExplorerSectionCollapseState(dom.window.localStorage)
    if (initial.sourceFilesCollapsed !== true || initial.outlineCollapsed !== false || initial.backlinksCollapsed !== true) {
      throw new Error(`expected persisted explorer collapse state to round-trip, got ${JSON.stringify(initial)}`)
    }

    await act(async () => {
      root.render(React.createElement(Harness))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const initialText = container.textContent || ''
    if (!initialText.includes('source:true') || !initialText.includes('outline:false') || !initialText.includes('backlinks:true')) {
      throw new Error(`expected hook to bootstrap from persisted explorer collapse state, got ${initialText}`)
    }

    for (const title of ['toggle-source-files', 'toggle-outline', 'toggle-backlinks']) {
      const button = container.querySelector(`button[title="${title}"]`)
      if (!(button instanceof dom.window.HTMLButtonElement)) throw new Error(`expected ${title} button`)
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        await new Promise(resolve => setTimeout(resolve, 0))
      })
    }

    const next = readMarkdownExplorerSectionCollapseState(dom.window.localStorage)
    if (next.sourceFilesCollapsed !== false || next.outlineCollapsed !== true || next.backlinksCollapsed !== false) {
      throw new Error(`expected hook toggles to persist explorer collapse state, got ${JSON.stringify(next)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
