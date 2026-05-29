import { SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import {
  isGlbAssetName,
  isGltfAssetName,
  type WorkspaceModelAssetFormat,
} from './glbAsset'
import { isCorpusMediaImportFileName } from '@/features/queryable-corpus/corpusGraph'

export function toFileArray(files: FileList | ReadonlyArray<File> | null): File[] {
  if (!files) return []
  try {
    return Array.from(files as ArrayLike<File>)
  } catch {
    return []
  }
}

export function isPdfFile(file: File): boolean {
  const lower = String(file.name || '').toLowerCase()
  if (lower.endsWith('.pdf')) return true
  return file.type === 'application/pdf'
}

function isGlbFile(file: File): boolean {
  if (isGlbAssetName(file.name)) return true
  return String(file.type || '').toLowerCase().split(';')[0] === 'model/gltf-binary'
}

function isGltfFile(file: File): boolean {
  if (isGltfAssetName(file.name)) return true
  const type = String(file.type || '').toLowerCase().split(';')[0]
  return type === 'model/gltf+json' || type === 'application/json+gltf'
}

export function getModelAssetFormat(file: File): WorkspaceModelAssetFormat | null {
  if (isGltfFile(file)) return 'gltf'
  if (isGlbFile(file)) return 'glb'
  return null
}

export function isCorpusMediaImportFile(file: File): boolean {
  return isCorpusMediaImportFileName(file.name, file.type)
}

const WORKSPACE_IMPORT_EXTS = (() => {
  const exts = new Set<string>()
  for (const ext of SOURCE_FILES_FORMATS.import) exts.add(String(ext || '').toLowerCase())
  exts.add('.mdx')
  return exts
})()

const WORKSPACE_IMPORT_LOCAL_TEXT_EXTS = (() => {
  const exts = new Set<string>()
  for (const ext of SOURCE_FILES_FORMATS.importLocalText) exts.add(String(ext || '').toLowerCase())
  exts.add('.mdx')
  return exts
})()

function fileExtension(nameRaw: string): string {
  const lower = String(nameRaw || '').trim().toLowerCase()
  if (lower.split('/').pop() === 'dockerfile') return '.dockerfile'
  const dot = lower.lastIndexOf('.')
  return dot > 0 ? lower.slice(dot) : ''
}

export function isSupportedWorkspaceImportFile(file: File): boolean {
  const name = String(file.name || '').trim()
  if (!name) return false
  const ext = fileExtension(name)
  if (!ext || !ext.startsWith('.')) return false
  return WORKSPACE_IMPORT_EXTS.has(ext)
}

export function isLocalTextWorkspaceImportName(nameRaw: string): boolean {
  const ext = fileExtension(nameRaw)
  return !!ext && WORKSPACE_IMPORT_LOCAL_TEXT_EXTS.has(ext)
}
