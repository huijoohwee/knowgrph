import React from 'react'
import { createRoot } from 'react-dom/client'
import { MarkdownWorkspace } from '@/lib/markdown-workspace-runtime'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownWorkspaceWebpageHtmlSidecarDeletionDoesNotRecreate() {
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

    const mdPath = await fs.createFile({
      parentPath: '/',
      name: 'www.figma.md',
      text: ['---', 'kgWebpageUrl: "https://www.figma.com/"', 'kgWebpageView: "html"', '---', '', '# Figma', ''].join('\n'),
    })
    const otherPath = await fs.createFile({ parentPath: '/', name: 'other.md', text: '# Other\n' })

    const sidecarPath = await fs.createFile({
      parentPath: '/',
      name: 'www.figma.webpage.html',
      text: '<!doctype html><html><body><h1>Cached</h1></body></html>',
    })

    if (sidecarPath !== '/www.figma.webpage.html') {
      throw new Error(`unexpected sidecar path: ${sidecarPath}`)
    }

    g.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        text: async () => '<!doctype html><html><body><h1>Remote</h1></body></html>',
      }
    }) as unknown as typeof fetch

    useMarkdownExplorerStore.getState().setActivePath(mdPath)

    root.render(React.createElement(MarkdownWorkspace))

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

    await fs.deleteEntry('/www.figma.webpage.html')
    for (let i = 0; i < 6; i += 1) await tick()

    useMarkdownExplorerStore.getState().setActivePath(otherPath)
    for (let i = 0; i < 3; i += 1) await tick()
    useMarkdownExplorerStore.getState().setActivePath(mdPath)
    for (let i = 0; i < 16; i += 1) await tick()

    const after = await fs.readFileText('/www.figma.webpage.html')
    if (after != null) {
      throw new Error('expected deleted .webpage.html sidecar not to be recreated')
    }

    root.unmount()
  } finally {
    g.fetch = prevFetch
    restoreDom()
  }
}

