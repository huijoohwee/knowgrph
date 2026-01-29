import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { LS_KEYS } from '@/lib/config'
import { lsSetBool, lsSetJson } from '@/lib/persistence'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { useGraphStore } from '@/hooks/useGraphStore'

async function renderWithLayoutMode(mode: 'viewer' | 'editor' | 'presentation') {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    lsSetJson(LS_KEYS.markdownLayoutMode, mode)
    lsSetBool(LS_KEYS.markdownSidebarOpen, true)

    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.addSourceFile({
      id: 'sf-1',
      name: 'a.md',
      text: '# A',
      enabled: true,
      status: 'idle',
      source: { kind: 'local' },
    })
    state.setMarkdownDocument('a.md', '# A')
    state.setBottomPanelCurationView('markdown')

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
    await tick()
    await tick()

    const toolbar = doc.querySelector('nav[aria-label="Markdown Toolbar"]') as HTMLElement | null
    if (!toolbar) throw new Error('Markdown Toolbar nav not found')
    const bold = toolbar.querySelector('button[aria-label="Bold"]') as HTMLButtonElement | null
    const italic = toolbar.querySelector('button[aria-label="Italic"]') as HTMLButtonElement | null
    const quote = toolbar.querySelector('button[aria-label="Quote"]') as HTMLButtonElement | null
    if (!bold || !italic || !quote) throw new Error(`Expected formatting buttons in mode=${mode}`)

    return { mode, boldDisabled: bold.disabled, italicDisabled: italic.disabled, quoteDisabled: quote.disabled, root, restoreDom, restoreWindow }
  } catch (e) {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
    throw e
  }
}

export async function testMarkdownFormattingToolbarVisibleAcrossModes() {
  const viewer = await renderWithLayoutMode('viewer')
  try {
    if (!viewer.boldDisabled || !viewer.italicDisabled || !viewer.quoteDisabled) {
      throw new Error('Expected formatting buttons to be disabled in viewer mode')
    }
  } finally {
    viewer.root.unmount()
    viewer.restoreDom()
    viewer.restoreWindow()
  }

  const editor = await renderWithLayoutMode('editor')
  try {
    if (editor.boldDisabled || editor.italicDisabled || editor.quoteDisabled) {
      throw new Error('Expected formatting buttons to be enabled in editor mode')
    }
  } finally {
    editor.root.unmount()
    editor.restoreDom()
    editor.restoreWindow()
  }

  const presentation = await renderWithLayoutMode('presentation')
  try {
    if (!presentation.boldDisabled || !presentation.italicDisabled || !presentation.quoteDisabled) {
      throw new Error('Expected formatting buttons to be disabled in presentation mode')
    }
  } finally {
    presentation.root.unmount()
    presentation.restoreDom()
    presentation.restoreWindow()
  }
}

