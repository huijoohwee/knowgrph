import { buildSourceFileRecord } from '@/features/source-files/sourceFileParsedState'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { SourceFile } from '@/hooks/store/types'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { SOURCE_FILES_FORMATS } from '@/lib/config.copy'

type SourceFileSelection = FileList | File[] | null | undefined

const SOURCE_FILE_TEXT_IMPORT_EXTENSIONS = new Set<string>(SOURCE_FILES_FORMATS.importLocalText.map(ext => ext.toLowerCase()))

const normalizeImportPath = (value: string): string =>
  String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')

const readFileImportPath = (file: File): string => {
  const relative = normalizeImportPath(String((file as unknown as { webkitRelativePath?: unknown }).webkitRelativePath || ''))
  return relative || normalizeImportPath(file.name)
}

const isSupportedTextSourceFile = (path: string): boolean => {
  const lower = String(path || '').trim().toLowerCase()
  if (!lower) return false
  if (lower.endsWith('/dockerfile') || lower === 'dockerfile') return true
  const dotIndex = lower.lastIndexOf('.')
  if (dotIndex < 0) return false
  return SOURCE_FILE_TEXT_IMPORT_EXTENSIONS.has(lower.slice(dotIndex))
}

const buildSelectedSourceFileId = (path: string): string =>
  `sf_selected_${hashStringToHex(`selected-source-file:${path.toLowerCase()}`)}`

export async function importSelectedSourceFiles(selection: SourceFileSelection): Promise<number> {
  const files = selection ? Array.from(selection) : []
  if (files.length === 0) return 0
  const store = useGraphStore.getState()
  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const existingByPath = new Map<string, SourceFile>()
  for (const file of existing) {
    const sourcePath = normalizeImportPath(String(file?.source?.path || file?.name || ''))
    if (sourcePath) existingByPath.set(sourcePath.toLowerCase(), file)
  }
  const imported: SourceFile[] = []
  for (const file of files) {
    const path = readFileImportPath(file)
    if (!isSupportedTextSourceFile(path)) continue
    const previous = existingByPath.get(path.toLowerCase()) || null
    imported.push(buildSourceFileRecord({
      id: previous?.id || buildSelectedSourceFileId(path),
      name: path,
      text: await file.text(),
      enabled: previous ? !!previous.enabled : true,
      geoLayerEnabled: previous?.geoLayerEnabled,
      status: 'idle',
      previousState: previous || undefined,
      preserveParsedState: true,
      source: { kind: 'local', path },
    }))
  }
  if (imported.length === 0) return 0
  const importedIds = new Set(imported.map(file => file.id))
  store.setSourceFiles([...imported, ...existing.filter(file => !importedIds.has(file.id))])
  return imported.length
}
