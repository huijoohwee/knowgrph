import React from 'react'
import { createRoot } from 'react-dom/client'
import BottomPanel from '@/components/BottomPanel'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { COLLAPSE_STORAGE_KEY } from '@/features/bottom-panel/constants'

const tick = async () => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0)
  })
}

const findButtonByAriaLabel = (root: ParentNode, label: string): HTMLButtonElement | null => {
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[]
  for (const btn of buttons) {
    if (String(btn.getAttribute('aria-label') || '') === label) return btn
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

    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const readmePath = '/README.md'
    const expected = String((await fs.readFileText(readmePath)) || '')
    if (!expected.trim()) throw new Error('expected README seed text')

    useGraphStore.getState().setBottomPanelTab('curation')
    useGraphStore.getState().setBottomPanelCurationView('markdown')
    useMarkdownExplorerStore.getState().setActivePath(readmePath)

    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanel))

    let textarea: HTMLTextAreaElement | null = null
    for (let i = 0; i < 120; i += 1) {
      await tick()
      textarea = container.querySelector('textarea') as HTMLTextAreaElement | null
      if (textarea && String(textarea.value || '').trim() === expected.trim()) break
      if (i === 119) throw new Error('expected editor textarea to contain README content')
    }

    const minimize = findButtonByAriaLabel(container, UI_COPY.floatingPanelMinimize)
    if (!minimize) throw new Error('minimize button not found')
    minimize.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    for (let i = 0; i < 20; i += 1) {
      await tick()
      textarea = container.querySelector('textarea') as HTMLTextAreaElement | null
      if (textarea && String(textarea.value || '').trim() === expected.trim()) break
      if (i === 19) {
        const count = container.querySelectorAll('textarea').length
        const prefix = textarea ? String(textarea.value || '').slice(0, 60) : ''
        const view = useGraphStore.getState().bottomPanelCurationView
        const tab = useGraphStore.getState().bottomPanelTab
        const activePath = useMarkdownExplorerStore.getState().activePath
        throw new Error(
          `expected textarea to remain mounted with content while collapsed (textareas=${count}, valuePrefix=${JSON.stringify(prefix)}, tab=${JSON.stringify(tab)}, view=${JSON.stringify(view)}, activePath=${JSON.stringify(activePath || '')})`,
        )
      }
    }

    const restoreBtn = findButtonByAriaLabel(container, UI_COPY.floatingPanelRestore)
    if (!restoreBtn) throw new Error('restore button not found')
    restoreBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    for (let i = 0; i < 80; i += 1) {
      await tick()
      textarea = container.querySelector('textarea') as HTMLTextAreaElement | null
      if (textarea && String(textarea.value || '').trim() === expected.trim()) break
      if (i === 79) {
        const count = container.querySelectorAll('textarea').length
        const prefix = textarea ? String(textarea.value || '').slice(0, 60) : ''
        const view = useGraphStore.getState().bottomPanelCurationView
        const tab = useGraphStore.getState().bottomPanelTab
        const activePath = useMarkdownExplorerStore.getState().activePath
        throw new Error(
          `expected textarea content to remain after expand (textareas=${count}, valuePrefix=${JSON.stringify(prefix)}, tab=${JSON.stringify(tab)}, view=${JSON.stringify(view)}, activePath=${JSON.stringify(activePath || '')})`,
        )
      }
    }

    root.unmount()
  } finally {
    restore()
  }
}
