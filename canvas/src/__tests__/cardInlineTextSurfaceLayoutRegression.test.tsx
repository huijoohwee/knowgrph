import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import {
  CARD_TEXT_SURFACE_EDIT_CLASS_NAME,
  CARD_TEXT_SURFACE_TEXT_CLASS_NAME,
  CARD_TEXT_SURFACE_VIEW_CLASS_NAME,
} from '@/lib/cards/cardTextSurfaceFrame'
import { setWorkspaceDataViewFloatingDensity } from '@/features/markdown-workspace/main/viewer/workspaceDataViewFloatingStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { waitForFrames } from '@/tests/lib/reactRootHarness'
import { cn } from '@/lib/utils'

export async function testCardInlineTextSurfaceKeepsViewEditLayoutStable() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const commits: string[] = []
  try {
    setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'compact', fieldLineMode: 'single' })
    await act(async () => {
      root.render(
        <CardInlineTextEditor
          value="I and buddydrone.jpg can ... #storyboard"
          ariaLabel="Summary for workspace-source"
          placeholder="Add summary"
          canEdit
          editActivation="click"
          multiline
          displayLineClamp="none"
          editorSurface="viewer"
          inlineChipDensity="compact"
          displayClassName={cn(CARD_TEXT_SURFACE_VIEW_CLASS_NAME, CARD_TEXT_SURFACE_TEXT_CLASS_NAME)}
          editorClassName={cn(CARD_TEXT_SURFACE_EDIT_CLASS_NAME, CARD_TEXT_SURFACE_TEXT_CLASS_NAME)}
          onCommit={value => commits.push(value)}
        />,
      )
      await waitForFrames(dom.window, 6)
    })
    const display = container.querySelector('[data-kg-card-inline-edit="1"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected Card read surface')
    if (!display.className.includes('min-h-full') || !display.className.includes('whitespace-pre-wrap')) {
      throw new Error(`expected caller-owned full-height read layout, got ${display.className}`)
    }
    if (display.className.includes('truncate') || display.className.includes('line-clamp-')) {
      throw new Error(`expected full Card surface not to inherit Data View clamping, got ${display.className}`)
    }
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 6)
    })
    const editor = container.querySelector('[data-kg-card-inline-viewer-edit-surface="1"]')
    if (!(editor instanceof dom.window.HTMLElement)) throw new Error('expected Card Viewer edit surface')
    if (!editor.className.includes('h-full') || !editor.className.includes('min-h-0')) {
      throw new Error(`expected edit surface to fill the same shared frame, got ${editor.className}`)
    }
    if (editor.className.includes('min-h-[3rem]')) {
      throw new Error(`expected no competing edit-only minimum height, got ${editor.className}`)
    }
    await act(async () => {
      editor.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 4)
    })
    if (commits.length) throw new Error(`expected layout-only edit activation not to mutate Card data, got ${JSON.stringify(commits)}`)
  } finally {
    setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'comfortable', fieldLineMode: 'single' })
    await act(async () => root.unmount())
    restore()
  }
}
