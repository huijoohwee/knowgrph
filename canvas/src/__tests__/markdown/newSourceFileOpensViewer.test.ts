import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { lsSetJson } from '@/lib/persistence'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { findElementWithTitle } from './markdownTestUtils'
import { createNewMarkdownSourceFileAndOpenViewer } from '@/features/source-files/createNewMarkdownSourceFile'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testNewSourceFileOpensBottomPanelMarkdownViewer() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }

    lsSetJson(LS_KEYS.markdownLayoutMode, 'editor')

    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setMarkdownDocument(null, null)
    state.setMarkdownDocumentSourceUrl(null)

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )

    await tick()
    await tick()

    const editorTitle = UI_COPY.bottomPanelMarkdownEditorTitle
    const viewerTitle = UI_COPY.bottomPanelMarkdownViewerTitle

    const editorHeaderInitial = findElementWithTitle(doc.body as HTMLElement, editorTitle)
    if (!editorHeaderInitial) throw new Error('expected editor header to be visible initially')

    const created = createNewMarkdownSourceFileAndOpenViewer()
    if (!created) throw new Error('expected new source file to be created')

    await tick()
    await tick()
    await tick()

    const viewerHeaderAfter = findElementWithTitle(doc.body as HTMLElement, viewerTitle)
    if (!viewerHeaderAfter) throw new Error('expected viewer header after new source file open')
    const editorHeaderAfter = findElementWithTitle(doc.body as HTMLElement, editorTitle)
    if (editorHeaderAfter) throw new Error('expected editor header to be hidden after new source file open')

    const nextState = useGraphStore.getState()
    if (nextState.markdownDocumentName !== created.name) {
      throw new Error('expected markdownDocumentName to match newly created source file')
    }
    if (!Array.isArray(nextState.sourceFiles) || nextState.sourceFiles.length !== 1) {
      throw new Error('expected exactly one source file after create')
    }
    if (nextState.sourceFiles[0]?.name !== created.name) {
      throw new Error('expected sourceFiles[0].name to match newly created file')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
