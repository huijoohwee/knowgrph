
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
