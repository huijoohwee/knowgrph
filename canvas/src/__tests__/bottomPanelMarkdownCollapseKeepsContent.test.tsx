import React from 'react'
import { createRoot } from 'react-dom/client'
import BottomPanel from '@/components/BottomPanel'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS } from '@/lib/config'
import { COLLAPSE_STORAGE_KEY } from '@/features/bottom-panel/constants'

const tick = async () => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0)
  })
}

const findButtonByText = (root: ParentNode, text: string): HTMLButtonElement | null => {
  const normalized = String(text || '').trim()
  if (!normalized) return null
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[]
  for (const btn of buttons) {
    if (String(btn.textContent || '').trim() === normalized) return btn
  }
  return null
}

export async function testBottomPanelMarkdownCollapseKeepsEditorContentMounted() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)

  try {
    dom.window.localStorage.setItem(COLLAPSE_STORAGE_KEY, '0')
    dom.window.localStorage.setItem(LS_KEYS.markdownLayoutMode, JSON.stringify('editor'))

    useGraphStore.getState().setBottomPanelTab('curation')
    useGraphStore.getState().setBottomPanelCurationView('markdown')

    if (useGraphStore.getState().workspaceViewMode !== 'editor') {
      throw new Error('expected setBottomPanelCurationView(\'markdown\') to open Editor workspace')
    }
    if (useGraphStore.getState().bottomPanelCurationView !== 'grid') {
      throw new Error('expected setBottomPanelCurationView(\'markdown\') to keep bottom panel on grid view')
    }

    useMarkdownExplorerStore.getState().setActivePath('/README.md')

    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanel))

    for (let i = 0; i < 40; i += 1) {
      await tick()
      const legacyMarkdownButton = findButtonByText(container, 'Markdown Section')
      if (legacyMarkdownButton) {
        throw new Error('expected BottomPanel to not render legacy Markdown Section toggle button')
      }
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null
      if (textarea) {
        throw new Error('expected BottomPanel to not render markdown editor textarea')
      }
    }


    root.unmount()
  } finally {
    restore()
  }
}
