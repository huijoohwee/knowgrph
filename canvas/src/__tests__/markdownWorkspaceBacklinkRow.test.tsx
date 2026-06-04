import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceBacklinkRow } from '@/features/markdown-workspace/MarkdownWorkspaceBacklinkRow'
import { UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

export async function testMarkdownWorkspaceBacklinkRowUsesSharedExplorerBacklinkShell() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const opened: Array<{ path: string; line: number }> = []

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceBacklinkRow, {
          backlink: {
            fromPath: 'notes/example.md',
            line: 7,
            lineText: 'See [[target]]',
          },
          textSizeClass: 'text-xs',
          onOpenBacklink: args => {
            opened.push(args)
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const button = container.querySelector('button')
    if (!(button instanceof dom.window.HTMLButtonElement)) throw new Error('expected shared explorer backlink row to render a button')
    if (button.getAttribute('aria-label') !== 'Backlink from notes/example.md') {
      throw new Error(`expected backlink aria-label, got ${String(button.getAttribute('aria-label') || '')}`)
    }
    if (!String(button.className || '').includes('w-full')) {
      throw new Error(`expected shared backlink row shell classes, got ${String(button.className || '')}`)
    }
    const icon = container.querySelector('svg')
    if (!(icon instanceof dom.window.SVGElement)) throw new Error('expected backlink row to render an icon')
    if (!String(icon.getAttribute('class') || '').includes(UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME)) {
      throw new Error(`expected backlink row icon to use shared compact glyph sizing, got ${String(icon.getAttribute('class') || '')}`)
    }

    button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    if (opened.length !== 1) throw new Error(`expected backlink open once, got ${String(opened.length)}`)
    if (opened[0]?.path !== 'notes/example.md' || opened[0]?.line !== 7) {
      throw new Error(`expected backlink open args for notes/example.md:7, got ${JSON.stringify(opened[0] || null)}`)
    }

    const text = container.textContent || ''
    if (!text.includes('notes/example.md')) throw new Error('expected backlink row to render the source path')
    if (!text.includes('L7: See [[target]]')) throw new Error('expected backlink row to render the line preview')
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
