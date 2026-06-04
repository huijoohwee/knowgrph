import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownOutlineSidebarSection } from '@/features/markdown/ui/MarkdownOutlineSidebarSection'

export async function testMarkdownOutlineSidebarSectionCentralizesLayoutOutlineAssembly() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const selectedIds: string[] = []
  let toggleCalls = 0

  const tokens = [
    { type: 'heading', depth: 1, id: 'doc', text: 'Doc', tokens: [], raw: '', startLine: 1, endLine: 1 },
    { type: 'heading', depth: 2, id: 'child', text: 'Child', tokens: [], raw: '', startLine: 3, endLine: 3 },
  ] as unknown as import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[]

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownOutlineSidebarSection, {
          tokens,
          uiPanelTextFontClass: 'font-sans',
          uiPanelMicroLabelTextSizeClass: 'text-[10px]',
          uiPanelKeyValueTextSizeClass: 'text-xs',
          onTocSelect: (id: string) => {
            selectedIds.push(id)
          },
          collapsedIds: new Set<string>(),
          collapsed: false,
          onToggleCollapsed: () => {
            toggleCalls += 1
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const initialText = container.textContent || ''
    if (!initialText.includes('Outline')) {
      throw new Error(`expected outline section header, got ${initialText}`)
    }
    if (!initialText.includes('Doc') || !initialText.includes('Child')) {
      throw new Error(`expected outline rows, got ${initialText}`)
    }

    const docRow = (Array.from(container.querySelectorAll('[role="button"]')) as HTMLElement[]).find(
      element => (element.textContent || '').includes('Doc'),
    )
    if (!(docRow instanceof dom.window.HTMLElement)) throw new Error('expected Doc outline row')
    await act(async () => {
      docRow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (selectedIds[0] !== 'doc') {
      throw new Error(`expected Doc row click to select doc, got ${JSON.stringify(selectedIds)}`)
    }

    const collapseButton = container.querySelector('button[aria-label="Collapse Outline"]')
    if (!(collapseButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected outline collapse button')
    await act(async () => {
      collapseButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (toggleCalls !== 1) {
      throw new Error(`expected collapse toggle once, got ${String(toggleCalls)}`)
    }

    await act(async () => {
      root.render(
        React.createElement(MarkdownOutlineSidebarSection, {
          tokens,
          uiPanelTextFontClass: 'font-sans',
          uiPanelMicroLabelTextSizeClass: 'text-[10px]',
          uiPanelKeyValueTextSizeClass: 'text-xs',
          onTocSelect: (id: string) => {
            selectedIds.push(id)
          },
          collapsedIds: new Set<string>(),
          collapsed: true,
          onToggleCollapsed: () => {
            toggleCalls += 1
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const collapsedText = container.textContent || ''
    if (!collapsedText.includes('Outline')) {
      throw new Error(`expected collapsed outline header, got ${collapsedText}`)
    }
    if (collapsedText.includes('Doc') || collapsedText.includes('Child')) {
      throw new Error(`expected collapsed outline to hide rows, got ${collapsedText}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
