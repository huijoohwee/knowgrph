import React from 'react'
import { createRoot } from 'react-dom/client'
import { LS_KEYS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { lsSetJson } from '@/lib/persistence'
import { jsonToMarkdown, type JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { builtInParsers, registerParser, resetParsers } from '@/features/parsers'

export async function testJsonMarkdownModeUpdatesMarkdownFromJsonSource() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const json = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]
    const text = JSON.stringify(json)

    const initialMode: JsonToMarkdownMode = 'table'
    lsSetJson<JsonToMarkdownMode>(LS_KEYS.jsonMarkdownMode, initialMode)

    const state = useGraphStore.getState()
    state.setJsonSourceDocument('data.json', text)
    const initialMarkdown = jsonToMarkdown(json, { defaultMode: initialMode }, initialMode)
    state.setMarkdownDocument('data.json', initialMarkdown)

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

    await tick()
    await tick()

    const before = String(useGraphStore.getState().markdownDocumentText || '')
    if (!before.trim()) {
      throw new Error('expected markdown before changing jsonMarkdownMode')
    }

    const selects = Array.from(doc.querySelectorAll('select')) as HTMLSelectElement[]
    const select =
      selects.find(el => el.value === initialMode) || selects[0] || null
    if (!select) {
      throw new Error('json markdown mode select not found')
    }

    select.value = 'key-value'
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

    await tick()
    await tick()

    const after = String(useGraphStore.getState().markdownDocumentText || '')
    if (!after.trim()) {
      throw new Error('expected markdown after changing jsonMarkdownMode')
    }
    if (after === before) {
      throw new Error('expected markdown to change after jsonMarkdownMode update')
    }

    const expectedAfter = jsonToMarkdown(json, { defaultMode: 'key-value' }, 'key-value')
    if (after !== expectedAfter) {
      throw new Error('expected markdown to match key-value rendering after mode change')
    }

    await Promise.resolve(text)
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testJsonMarkdownApplyJsonUpdatesJsonSourceAndMarkdown() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const initialMode: JsonToMarkdownMode = 'table'
    lsSetJson<JsonToMarkdownMode>(LS_KEYS.jsonMarkdownMode, initialMode)

    const initialJson = {
      nodes: [
        { id: 'n1', type: 'Node', properties: { name: 'Before A' } },
        { id: 'n2', type: 'Node', properties: { name: 'Before B' } },
      ],
      edges: [],
    }
    const updatedJson = {
      nodes: [
        { id: 'n1', type: 'Node', properties: { name: 'After A' } },
        { id: 'n2', type: 'Node', properties: { name: 'After B' } },
      ],
      edges: [],
    }
    const initialJsonText = JSON.stringify(initialJson)
    const updatedJsonText = JSON.stringify(updatedJson)

    const state = useGraphStore.getState()
    const initialMarkdown = jsonToMarkdown(initialJson, { defaultMode: initialMode }, initialMode)
    state.setJsonSourceDocument('graph.json', initialJsonText)
    state.setMarkdownDocument('graph.json', initialMarkdown)

    root.render(React.createElement(BottomPanelMarkdownSection))

    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: () => void) => number
    }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    await tick()
    await tick()

    const beforeJson = String(useGraphStore.getState().jsonSourceDocumentText || '')
    const beforeMarkdown = String(useGraphStore.getState().markdownDocumentText || '')
    if (!beforeJson.includes('Before A') || !beforeMarkdown.trim()) {
      throw new Error('expected initial json and markdown before applyJson')
    }

    const nextState = useGraphStore.getState()
    nextState.setGraphData(updatedJson as never)
    nextState.setJsonSourceDocument('graph.json', updatedJsonText)

    await tick()
    await tick()

    const afterState = useGraphStore.getState()
    const afterJson = String(afterState.jsonSourceDocumentText || '')
    const afterMarkdown = String(afterState.markdownDocumentText || '')

    if (afterJson === beforeJson) {
      throw new Error('expected jsonSourceDocumentText to change after simulated applyJson')
    }

    const expectedMarkdown = jsonToMarkdown(updatedJson, { defaultMode: initialMode }, initialMode)
    if (afterMarkdown !== expectedMarkdown) {
      throw new Error('expected markdown to match updated json after simulated applyJson')
    }

    await Promise.resolve(afterMarkdown)
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testJsonMarkdownModeWithExternalJsonFiles() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: () => void) => number
    }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    const paths: string[] = [
      '/Users/huijoohwee/Documents/GitHub/joohwee/aisg-aiap22/eda-mlp-extended-path-v2.1.json',
      '/Users/huijoohwee/Documents/GitHub/joohwee/aisg-aiap22/eda-mlp-extended-path.json',
      '/Users/huijoohwee/Documents/GitHub/joohwee/aisg-aiap22/eda-mlp-interview-session.json',
      '/Users/huijoohwee/Documents/GitHub/joohwee/aisg-aiap22/eda-mlp-path.json',
      '/Users/huijoohwee/Documents/GitHub/joohwee/aisg-aiap22/interviewer-v1.jsonld',
    ]

    const initialMode: JsonToMarkdownMode = 'table'
    lsSetJson<JsonToMarkdownMode>(LS_KEYS.jsonMarkdownMode, initialMode)

    root.render(React.createElement(BottomPanelMarkdownSection))

    await tick()
    await tick()

    for (const path of paths) {
      const name = path.split('/').pop() || path
      const text = await fetch(path).then(r => r.text())
      if (!text.trim()) {
        continue
      }

      const parsed = JSON.parse(text) as unknown
      const expectedTable = jsonToMarkdown(parsed, { defaultMode: 'table' }, 'table')
      const expectedKeyValue = jsonToMarkdown(parsed, { defaultMode: 'key-value' }, 'key-value')

      const state = useGraphStore.getState()
      state.setJsonSourceDocument(name, text)
      state.setMarkdownDocument(name, expectedTable)

      await tick()
      await tick()

      const before = String(useGraphStore.getState().markdownDocumentText || '')
      if (!before.trim()) {
        throw new Error(`expected markdown before mode change for ${name}`)
      }

      const domSelects = Array.from(doc.querySelectorAll('select')) as HTMLSelectElement[]
      const select =
        domSelects.find(el => el.value === 'table') || domSelects[0] || null
      if (!select) {
        throw new Error('json markdown mode select not found')
      }

      select.value = 'key-value'
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

      await tick()
      await tick()

      const after = String(useGraphStore.getState().markdownDocumentText || '')
      if (!after.trim()) {
        throw new Error(`expected markdown after mode change for ${name}`)
      }
      if (after === before) {
        throw new Error(`expected markdown to change after mode update for ${name}`)
      }
      if (after !== expectedKeyValue) {
        throw new Error(`expected markdown to match key-value rendering for ${name}`)
      }
    }
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownApplyButtonUpdatesGraphData() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    resetParsers()
    builtInParsers.forEach(p => registerParser(p))

    const markdown = ['# Title', '', '- Item one', '- Item two', ''].join('\n')

    const state = useGraphStore.getState()
    state.setMarkdownDocument('apply-test.md', markdown)

    root.render(React.createElement(BottomPanelMarkdownSection))

    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: () => void) => number
    }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    await tick()
    await tick()

    const beforeGraph = useGraphStore.getState().graphData

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const applyButton =
      buttons.find(btn => btn.getAttribute('title') === 'Apply') || null
    if (!applyButton) {
      throw new Error('markdown Apply button not found')
    }

    applyButton.click()

    await tick()
    await tick()

    const afterGraph = useGraphStore.getState().graphData

    if (!afterGraph || typeof afterGraph !== 'object') {
      throw new Error('expected graphData after markdown Apply')
    }
    if (afterGraph === beforeGraph) {
      throw new Error('expected graphData to change after markdown Apply')
    }

    const nodes = Array.isArray((afterGraph as { nodes?: unknown[] }).nodes)
      ? ((afterGraph as { nodes?: unknown[] }).nodes as unknown[])
      : []
    if (nodes.length === 0) {
      throw new Error('expected markdown Apply to produce at least one node')
    }

    const jsonText = JSON.stringify(afterGraph, null, 2)
    if (!jsonText.includes('"nodes"') || !jsonText.includes('"edges"')) {
      throw new Error('expected markdown Apply graph JSON to include nodes and edges')
    }

    await Promise.resolve(jsonText)
  } finally {
    restoreDom()
    restoreWindow()
  }
}
