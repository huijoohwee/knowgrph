import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import type { WorkspaceEntry, WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { builtInParsers, registerParser, resetParsers } from '@/features/parsers'

const ensureWindowStub = () => {
  const g = globalThis as unknown as { window?: unknown }
  if (g.window) return
  ;(globalThis as unknown as { window: unknown }).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    requestAnimationFrame: (cb: (t: number) => void) => globalThis.setTimeout(() => cb(Date.now()), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => globalThis.clearTimeout(id as unknown as NodeJS.Timeout),
  }
}

const buildFs = (opts: { path: WorkspacePath; text: string }): WorkspaceFs => {
  const entry: WorkspaceEntry = {
    kind: 'file',
    path: opts.path,
    parentPath: '/',
    name: String(opts.path).replace(/^\/+/, ''),
    text: undefined,
    updatedAtMs: Date.now(),
  }
  return {
    ensureSeed: async () => void 0,
    listEntries: async () => [entry],
    readFileText: async (path) => (path === opts.path ? opts.text : null),
    writeFileText: async () => {
      throw new Error('not implemented')
    },
    createFile: async () => {
      throw new Error('not implemented')
    },
    createFolder: async () => {
      throw new Error('not implemented')
    },
    deleteEntry: async () => {
      throw new Error('not implemented')
    },
  }
}

async function main() {
  ensureWindowStub()
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))
  const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
  const sanity = await loadGraphDataFromTextViaParser('a.json', JSON.stringify({ nodes: [{ id: 'n1', type: 'Entity', label: 'n1' }] }), {
    applyToStore: false,
  })
  if (!sanity?.graphData || !Array.isArray(sanity.graphData.nodes) || sanity.graphData.nodes.length === 0) {
    throw new Error('Parser sanity check failed')
  }
  const store = useGraphStore.getState()
  store.setCanvasRenderMode('2d')
  store.setCanvas2dRenderer('d3')
  store.setSourceFiles([])
  store.setGraphData({ context: '', type: 'Graph', nodes: [], edges: [] })

  const fs = buildFs({
    path: '/a.json',
    text: JSON.stringify({ nodes: [{ id: 'n1', type: 'Entity', label: 'n1' }] }),
  })

  await applyWorkspaceImportToCanvas({ fs, createdPaths: ['/a.json'] })

  await new Promise<void>(resolve => setTimeout(resolve, 10))

  const gd = useGraphStore.getState().graphData
  if (!gd || !Array.isArray(gd.nodes) || gd.nodes.length === 0) {
    throw new Error('Expected imported workspace file to produce graph nodes')
  }
}

void main()
