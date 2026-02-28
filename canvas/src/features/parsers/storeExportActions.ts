
import { useGraphStore } from '@/hooks/useGraphStore'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import {
  DatasetPath,
  saveGraphFile,
  exportGraphAsJSON,
  exportGraphAsCombinedCSV,
  exportGraphAsGraphML,
  exportGraphAsCypher,
  readExportPrefsMeta,
} from '@/lib/graph/file'
import {
  exportAsJsonLdBlob,
  exportAsRawJsonBlob,
  exportAsCombinedCsvBlob,
  exportAsGraphMlBlob,
  exportAsCypherBlob,
} from '@/lib/graph/io/adapter'
import {
  openSaveFilePickerHandle,
  writeBlobToFileHandle,
  saveBlobWithPicker,
  writeExportPrefs,
} from '@/lib/graph/save'

const ensureExt = (name: string, allowed: string[], fallback: string): string => {
  const s = String(name || '').toLowerCase()
  const ok = allowed.some(ext => s.endsWith(ext))
  return ok ? name : fallback
}

export const exportGraphJsonLdFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const base = suggested ? String(suggested) : 'graph.jsonld'
    const name = ensureExt(base, ['.jsonld', '.json'], 'graph.jsonld')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'JSON-LD Files',
        accept: { 'application/ld+json': ['.jsonld', '.json'] },
      })
      if (handle === '') return
      if (!handle) {
        await saveGraphFile(current, suggested)
        return
      }
      const blob = exportAsJsonLdBlob(current)
      await writeBlobToFileHandle(handle, blob)
    }

    void run()
  } catch {
    void 0
  }
}

export const exportGraphJsonFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const prefs = readExportPrefsMeta()
    const pref = prefs.format === 'json' && prefs.filename ? prefs.filename : 'graph.json'
    const base = suggested ? String(suggested) : pref
    const name = ensureExt(base, ['.json'], 'graph.json')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'JSON Files',
        accept: { 'application/json': ['.json'] },
      })
      if (handle === '') return
      if (!handle) {
        await exportGraphAsJSON(current, suggested)
        return
      }
      const blob = exportAsRawJsonBlob(current)
      await writeBlobToFileHandle(handle, blob)
      const nextName = typeof handle.name === 'string' && handle.name.trim() ? handle.name.trim() : name
      writeExportPrefs({ format: 'json', filename: nextName })
    }

    void run()
  } catch {
    void 0
  }
}

export const exportGraphCsvCombinedFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const prefs = readExportPrefsMeta()
    const pref = prefs.format === 'csv-combined' && prefs.filename ? prefs.filename : 'graph.csv'
    const base = suggested ? String(suggested) : pref
    const name = ensureExt(base, ['.csv'], 'graph.csv')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'CSV Files',
        accept: { 'text/csv': ['.csv'] },
      })
      if (handle === '') return
      if (!handle) {
        await exportGraphAsCombinedCSV(current, suggested)
        return
      }
      const blob = exportAsCombinedCsvBlob(current)
      await writeBlobToFileHandle(handle, blob)
      const nextName = typeof handle.name === 'string' && handle.name.trim() ? handle.name.trim() : name
      writeExportPrefs({ format: 'csv-combined', filename: nextName })
    }

    void run()
  } catch {
    void 0
  }
}

export const exportGraphMlFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const prefs = readExportPrefsMeta()
    const pref = prefs.format === 'graphml' && prefs.filename ? prefs.filename : 'graph.graphml'
    const base = suggested ? String(suggested) : pref
    const name = ensureExt(base, ['.graphml', '.xml'], 'graph.graphml')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'GraphML Files',
        accept: { 'application/graphml+xml': ['.graphml', '.xml'] },
      })
      if (handle === '') return
      if (!handle) {
        await exportGraphAsGraphML(current, suggested)
        return
      }
      const blob = exportAsGraphMlBlob(current)
      await writeBlobToFileHandle(handle, blob)
      const nextName = typeof handle.name === 'string' && handle.name.trim() ? handle.name.trim() : name
      writeExportPrefs({ format: 'graphml', filename: nextName })
    }

    void run()
  } catch {
    void 0
  }
}

export const exportCypherFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const prefs = readExportPrefsMeta()
    const pref = prefs.format === 'cypher' && prefs.filename ? prefs.filename : 'graph.cypher'
    const base = suggested ? String(suggested) : pref
    const name = ensureExt(base, ['.cypher', '.cql', '.txt'], 'graph.cypher')

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'Cypher Files',
        accept: { 'text/plain': ['.cypher', '.cql', '.txt'] },
      })
      if (handle === '') return
      if (!handle) {
        await exportGraphAsCypher(current, suggested)
        return
      }
      const blob = exportAsCypherBlob(current)
      await writeBlobToFileHandle(handle, blob)
      const nextName = typeof handle.name === 'string' && handle.name.trim() ? handle.name.trim() : name
      writeExportPrefs({ format: 'cypher', filename: nextName })
    }

    void run()
  } catch {
    void 0
  }
}

export const exportGraphMarkdownFromStore = () => {
  try {
    const current = useGraphStore.getState().graphData
    if (!current) return
    const { lastApplied } = verifyWorkflowPresetStorage()
    const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
    const prefs = readExportPrefsMeta()
    const pref = prefs.format === 'markdown-graph' && prefs.filename ? prefs.filename : 'graph.md'
    const base = suggested ? String(suggested) : pref
    const name = ensureExt(base, ['.md', '.markdown'], 'graph.md')

    const escapeCell = (v: unknown): string => {
      const s = String(v ?? '').replace(/\r\n?/g, '\n').replace(/\n/g, ' ').trim()
      if (!s) return ''
      return s.replace(/\|/g, '\\|')
    }

    const run = async () => {
      const handle = await openSaveFilePickerHandle(name, {
        description: 'Markdown Files',
        accept: { 'text/markdown': ['.md', '.markdown'] },
      })
      if (handle === '') return

      const nodes = Array.isArray(current.nodes) ? current.nodes : []
      const edges = Array.isArray(current.edges) ? current.edges : []
      const MAX_ROWS = 800

      const nodeRows = nodes.slice(0, MAX_ROWS).map(n => `| ${escapeCell(n.id)} | ${escapeCell(n.label)} | ${escapeCell(n.type)} |`)
      const edgeRows = edges
        .slice(0, MAX_ROWS)
        .map(e => `| ${escapeCell(e.id)} | ${escapeCell(e.source)} | ${escapeCell(e.target)} | ${escapeCell(e.label)} | ${escapeCell(e.type)} |`)

      const jsonld = await exportAsJsonLdBlob(current).text().catch(() => '')

      const lines: string[] = []
      lines.push('---')
      lines.push('kgExportKind: "graph"')
      lines.push('kgExportFormat: "markdown+jsonld"')
      lines.push(`kgExportedAt: "${new Date().toISOString()}"`)
      lines.push('---')
      lines.push('')
      lines.push('# Graph')
      lines.push('')
      lines.push(`- Nodes: ${nodes.length}`)
      lines.push(`- Edges: ${edges.length}`)
      if (nodes.length > MAX_ROWS) lines.push(`- Nodes table clipped: ${nodes.length - MAX_ROWS} not shown`)
      if (edges.length > MAX_ROWS) lines.push(`- Edges table clipped: ${edges.length - MAX_ROWS} not shown`)
      lines.push('')
      lines.push('## Nodes')
      lines.push('')
      lines.push('| id | label | type |')
      lines.push('|---|---|---|')
      lines.push(...(nodeRows.length ? nodeRows : ['| | | |']))
      lines.push('')
      lines.push('## Edges')
      lines.push('')
      lines.push('| id | source | target | label | type |')
      lines.push('|---|---|---|---|---|')
      lines.push(...(edgeRows.length ? edgeRows : ['| | | | | |']))
      lines.push('')
      if (jsonld.trim()) {
        lines.push('## JSON-LD')
        lines.push('')
        lines.push('```jsonld')
        lines.push(jsonld.trim())
        lines.push('```')
        lines.push('')
      }
      const markdown = lines.join('\n')
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })

      if (!handle) {
        const saved = await saveBlobWithPicker(blob, name, { description: 'Markdown Files', accept: { 'text/markdown': ['.md', '.markdown'] } })
        if (saved && saved !== '') writeExportPrefs({ format: 'markdown-graph', filename: saved })
        return
      }

      await writeBlobToFileHandle(handle, blob)
      const nextName = typeof handle.name === 'string' && handle.name.trim() ? handle.name.trim() : name
      writeExportPrefs({ format: 'markdown-graph', filename: nextName })
    }

    void run()
  } catch {
    void 0
  }
}
