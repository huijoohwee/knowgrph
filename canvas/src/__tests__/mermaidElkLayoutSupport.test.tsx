import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'

export async function testMermaidElkLayoutRegistersLoadersBeforeInit() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  const calls: string[] = []
  const api = {
    registerLayoutLoaders: () => {
      calls.push('register')
    },
    initialize: () => {
      calls.push('init')
    },
    render: async () => {
      calls.push('render')
      return { svg: '<svg viewBox="0 0 100 100"></svg>' }
    },
  }

  try {
    ;(globalThis as unknown as { __KG_TEST_MERMAID_API__?: unknown }).__KG_TEST_MERMAID_API__ = api

    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MermaidDiagram, {
        code: 'flowchart TD\n  A-->B',
        highlightClass: '',
        frontmatterConfig: { layout: 'elk' } as never,
        rootThemeMode: 'light',
        variant: 'codeblock',
        enablePanZoom: false,
      } as never),
    )

    const waitFor = async (label: string, predicate: () => boolean) => {
      const deadline = Date.now() + 750
      while (Date.now() < deadline) {
        if (predicate()) return
        await new Promise<void>(resolve => setTimeout(resolve, 10))
      }
      throw new Error(`${label} timed out`)
    }

    await waitFor('mermaid calls', () => calls.includes('init') && calls.includes('render'))

    const initIndex = calls.indexOf('init')
    const registerIndex = calls.indexOf('register')
    if (registerIndex === -1) {
      throw new Error(`expected registerLayoutLoaders to be called; calls=${JSON.stringify(calls)}`)
    }
    if (initIndex !== -1 && registerIndex > initIndex) {
      throw new Error(`expected registerLayoutLoaders before initialize; calls=${JSON.stringify(calls)}`)
    }
  } finally {
    try {
      delete (globalThis as unknown as { __KG_TEST_MERMAID_API__?: unknown }).__KG_TEST_MERMAID_API__
    } catch {
      void 0
    }
    try {
      root?.unmount()
    } catch {
      void 0
    }
    try {
      restoreDom()
    } catch {
      void 0
    }
    try {
      restoreWindow()
    } catch {
      void 0
    }
  }
}

export async function testMermaidElkLayoutSkipsUnsupportedDiagramFamilies() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  const calls: string[] = []
  const api = {
    registerLayoutLoaders: () => {
      calls.push('register')
    },
    initialize: () => {
      calls.push('init')
    },
    render: async () => {
      calls.push('render')
      return { svg: '<svg viewBox="0 0 100 100"></svg>' }
    },
  }

  try {
    ;(globalThis as unknown as { __KG_TEST_MERMAID_API__?: unknown }).__KG_TEST_MERMAID_API__ = api

    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MermaidDiagram, {
        code: 'sequenceDiagram\n  Alice->>Bob: hello',
        highlightClass: '',
        frontmatterConfig: { layout: 'elk' } as never,
        rootThemeMode: 'light',
        variant: 'codeblock',
        enablePanZoom: false,
      } as never),
    )

    const waitFor = async (label: string, predicate: () => boolean) => {
      const deadline = Date.now() + 750
      while (Date.now() < deadline) {
        if (predicate()) return
        await new Promise<void>(resolve => setTimeout(resolve, 10))
      }
      throw new Error(`${label} timed out`)
    }

    await waitFor('mermaid calls', () => calls.includes('init') && calls.includes('render'))

    if (calls.includes('register')) {
      throw new Error(`expected unsupported Mermaid families to skip ELK loader registration; calls=${JSON.stringify(calls)}`)
    }
  } finally {
    try {
      delete (globalThis as unknown as { __KG_TEST_MERMAID_API__?: unknown }).__KG_TEST_MERMAID_API__
    } catch {
      void 0
    }
    try {
      root?.unmount()
    } catch {
      void 0
    }
    try {
      restoreDom()
    } catch {
      void 0
    }
    try {
      restoreWindow()
    } catch {
      void 0
    }
  }
}
