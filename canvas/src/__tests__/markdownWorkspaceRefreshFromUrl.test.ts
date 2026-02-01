import React from 'react'
import { createRoot } from 'react-dom/client'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { setWorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

type FetchResponseStub = {
  ok: boolean
  status: number
  headers: { get: (key: string) => string | null }
  text: () => Promise<string>
}

export async function testMarkdownWorkspaceRefreshFromUrlUpdatesActiveDocumentAndGraphStore() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const path = await fs.createFile({ parentPath: '/', name: 'url-refresh.md', text: '# Old\n' })
    const url = 'https://example.com/refresh.md'
    setWorkspaceEntrySource(path, { kind: 'url', url })
    useMarkdownExplorerStore.getState().setActivePath(path)

    const updatedText = '# Updated\n\nHello\n'

    g.fetch = (async (input: unknown, init?: unknown) => {
      const initObj = init && typeof init === 'object' ? (init as { method?: unknown }) : null
      const methodRaw = initObj?.method
      const method = (typeof methodRaw === 'string' ? methodRaw : 'GET').toUpperCase()
      const res: FetchResponseStub = {
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            if (key.toLowerCase() === 'content-length') return String(updatedText.length)
            return null
          },
        },
        text: async () => (method === 'HEAD' ? '' : updatedText),
      }
      return res as unknown as Response
    }) as unknown as typeof fetch

    const state = useGraphStore.getState()
    state.setMarkdownDocument(null, null)
    state.setMarkdownDocumentSourceUrl(null)

    root.render(React.createElement(BottomPanelMarkdownSection))

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    for (let i = 0; i < 12; i += 1) await tick()

    const findRefreshButton = (): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        const label = String(btn.getAttribute('aria-label') || '')
        if (label === 'Refresh url-refresh.md') return btn
      }
      return null
    }

    const refreshBtn = findRefreshButton()
    if (!refreshBtn) throw new Error('refresh button not found')

    refreshBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    for (let i = 0; i < 24; i += 1) await tick()

    const nextState = useGraphStore.getState()
    if (String(nextState.markdownDocumentText || '').trim() !== updatedText.trim()) {
      throw new Error('expected markdownDocumentText to update after URL refresh')
    }
    if (nextState.markdownDocumentSourceUrl !== url) {
      throw new Error(`expected markdownDocumentSourceUrl to remain ${url}`)
    }

    const saved = await fs.readFileText(path)
    if (String(saved || '').trim() !== updatedText.trim()) {
      throw new Error('expected workspace file text to update after URL refresh')
    }

    root.unmount()
  } finally {
    g.fetch = prevFetch
    restoreDom()
  }
}
