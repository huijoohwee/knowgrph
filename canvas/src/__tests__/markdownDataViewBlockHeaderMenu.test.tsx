import React from 'react'
import { createRoot } from 'react-dom/client'

import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownDataViewBlock } from '@/features/markdown/ui/MarkdownDataViewBlock'
import type { RenderOpts } from '@/features/markdown/ui/MarkdownRendererTypes'
import {
  defaultWorkspaceDataViewConfig,
  writeWorkspaceDataViewConfig,
} from '@/features/markdown-workspace/main/viewer/workspaceDataViewConfig'

const tick = async () => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0)
  })
}

export async function testMarkdownDataViewBlockColumnHeaderTypeMenuIsClickable() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  container.id = 'root'
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    const token: any = { type: 'table', startLine: 1, endLine: 4 }
    const table: any = {
      type: 'table',
      header: [{ text: 'Status' }, { text: 'Title' }],
      rows: [
        [{ text: 'Todo' }, { text: 'A' }],
        [{ text: 'Doing' }, { text: 'B' }],
      ],
    }

    const opts: RenderOpts = {
      activeDocumentPath: 'doc.md',
      uiPanelTextFontClass: '',
      uiPanelMonospaceTextClass: '',
      markdownPresentationMode: false,
      highlightedLineRange: null,
      markdownWordWrap: false,
      codeAnnotations: null,
      mermaidFrontmatterConfig: null,
      rootThemeMode: 'light',
      previewOverlayScope: 'container',
      webpageLayoutWireframeAscii: null,
    }
    writeWorkspaceDataViewConfig({
      activeDocumentPath: 'doc.md',
      tableId: 'md-block:1-4',
      value: defaultWorkspaceDataViewConfig({
        title: 'Multi-dimensional Table',
        layout: 'table',
        groupByColumnId: null,
      }),
    })

    root.render(
      React.createElement(MarkdownDataViewBlock, {
        token,
        table,
        highlightClass: '',
        opts,
      }),
    )

    for (let i = 0; i < 50; i += 1) await tick()

    const tableLayoutButton = container.querySelector('button[aria-label="Layout: Table View"]') as HTMLButtonElement | null
    if (!tableLayoutButton) throw new Error('Expected table layout control')

    const summary = doc.querySelector('summary[aria-label="Column type: Status"]') as HTMLElement | null
    if (!summary) throw new Error('Expected Status header summary')
    const svg = summary.querySelector('svg') as SVGElement | null
    if (!svg) throw new Error('Expected svg in summary')
    svg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    let columnMenu: HTMLElement | null = null
    for (let i = 0; i < 60; i += 1) {
      await tick()
      columnMenu = doc.querySelector('menu[aria-label="Column menu: Status"]') as HTMLElement | null
      if (columnMenu) break
    }
    if (!columnMenu) throw new Error('Expected column menu')

    const typeDetails = columnMenu.querySelector('details') as HTMLDetailsElement | null
    if (!typeDetails) throw new Error('Expected Type details')
    const typeSummary = typeDetails.querySelector('summary') as HTMLElement | null
    if (!typeSummary) throw new Error('Expected Type summary')
    typeSummary.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await tick()

    const typeMenu = doc.querySelector('menu[aria-label="Column type: Status"]') as HTMLElement | null
    if (!typeMenu) throw new Error('Expected type submenu')
    const buttons = Array.from(typeMenu.querySelectorAll('button')) as HTMLButtonElement[]
    const selectBtn = buttons.find(b => String(b.textContent || '').trim() === 'Select') || null
    if (!selectBtn) throw new Error('Expected Select option')
    if (selectBtn.disabled) throw new Error('Expected Select option enabled')
    selectBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    for (let i = 0; i < 10; i += 1) await tick()

    svg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    for (let i = 0; i < 60; i += 1) {
      await tick()
      columnMenu = doc.querySelector('menu[aria-label="Column menu: Status"]') as HTMLElement | null
      if (columnMenu) break
    }
    if (!columnMenu) throw new Error('Expected column menu after reselection')
    if (!String(columnMenu.textContent || '').includes('Select')) {
      throw new Error(`Expected menu to show updated type label, got: ${String(columnMenu.textContent || '').slice(0, 200)}`)
    }
  } finally {
    try {
      root.unmount()
    } catch {
      void 0
    }
    restoreDom()
  }
}
