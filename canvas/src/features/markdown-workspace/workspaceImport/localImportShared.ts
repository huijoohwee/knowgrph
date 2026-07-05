import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { WORKSPACE_IMPORT_DEFER_LOCAL_FILE_BYTES, WORKSPACE_IMPORT_DEFER_LOCAL_MODEL_BYTES } from '@/lib/config'
import { inferCorpusMediaKind, type CorpusSourceUnit } from '@/features/queryable-corpus/corpusGraph'
import { createCorpusSourceUnitRecorder } from '@/features/queryable-corpus/sourceFilesCorpusManifest'
import { type VideoSequenceImportAsset } from './videoSequenceTimelineImport'
import { getModelAssetFormat, isCorpusMediaImportFile, isPdfFile } from './localImportFormats'
import { isWorkspaceJsonLdName } from './workspaceFileJsonLd'
import { buildSpatialCaptureStandaloneManifestMarkdown, type SpatialCaptureStandaloneFormat } from './spatialCaptureFileset'
import { setPendingLocalImport } from './pendingLocalImport'

export function recordCorpusSourceUnit(
  recordSourceUnit: ReturnType<typeof createCorpusSourceUnitRecorder>,
  args: { path: WorkspacePath; relativePath: string; originalName: string; text: string; file: File; status: CorpusSourceUnit['status'] },
): void {
  recordSourceUnit({
    path: args.path,
    relativePath: args.relativePath,
    originalName: args.originalName,
    text: args.text,
    mimeHint: args.file.type,
    byteSize: args.file.size,
    status: args.status,
  })
}

export function buildLocalSpatialCaptureManifest(args: {
  originalName: string
  format: SpatialCaptureStandaloneFormat
  sourceIdentity: string
  pendingLocalPath: WorkspacePath
  byteSize?: number | null
  mimeHint?: string | null
}): string {
  return buildSpatialCaptureStandaloneManifestMarkdown({
    originalName: args.originalName,
    format: args.format,
    sourceKind: 'local',
    sourceIdentity: args.sourceIdentity,
    pendingLocalPath: args.pendingLocalPath,
    byteSize: args.byteSize,
    mimeHint: args.mimeHint,
  })
}

export function setPendingSpatialCaptureLocalImport(path: WorkspacePath, file: File, originalName: string, format: SpatialCaptureStandaloneFormat): void {
  setPendingLocalImport(path, { kind: format, file, originalName })
}

export function pushLocalVideoSequenceImportAsset(
  assets: VideoSequenceImportAsset[],
  args: { workspacePath: WorkspacePath; relativePath: string; originalName: string; file: File; importMode: VideoSequenceImportAsset['importMode'] },
): void {
  if (inferCorpusMediaKind(args.originalName || args.relativePath, args.file.type) !== 'video') return
  assets.push({
    workspacePath: args.workspacePath,
    relativePath: args.relativePath,
    originalName: args.originalName,
    mimeHint: args.file.type,
    byteSize: args.file.size,
    importMode: args.importMode,
  })
}

export async function pruneVideoSequenceSourceDocuments(args: {
  fs: WorkspaceFs
  createdPaths: WorkspacePath[]
  sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }>
  assets: VideoSequenceImportAsset[]
}): Promise<WorkspacePath[]> {
  const sourcePaths = new Set(
    args.assets
      .map(asset => normalizeWorkspacePath(asset.workspacePath || ''))
      .filter(path => path && /\.source\.md$/i.test(path)),
  )
  if (sourcePaths.size === 0) return []
  const removed: WorkspacePath[] = []
  for (const path of sourcePaths) {
    await args.fs.deleteEntry(path).catch(() => void 0)
    removed.push(path)
  }
  const keepCreated = args.createdPaths.filter(path => !sourcePaths.has(normalizeWorkspacePath(path)))
  args.createdPaths.splice(0, args.createdPaths.length, ...keepCreated)
  const keepSources = args.sources.filter(item => !sourcePaths.has(normalizeWorkspacePath(item.path)))
  args.sources.splice(0, args.sources.length, ...keepSources)
  return removed
}

export function shouldDeferLargeLocalFileImport(file: File, nameRaw: string): boolean {
  if (isPdfFile(file)) return false
  if (isCorpusMediaImportFile(file)) return false
  if (isWorkspaceJsonLdName(nameRaw)) return false
  const lower = String(nameRaw || '').toLowerCase()
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.tab')) return false
  const size = Math.max(0, Number(file?.size || 0))
  if (getModelAssetFormat(file)) return size >= WORKSPACE_IMPORT_DEFER_LOCAL_MODEL_BYTES
  return size >= WORKSPACE_IMPORT_DEFER_LOCAL_FILE_BYTES
}

export function shouldMaterializeFolderTextForCorpus(nameRaw: string, mimeHint?: string | null): boolean {
  const mediaKind = inferCorpusMediaKind(nameRaw, mimeHint)
  return mediaKind === 'code' || mediaKind === 'sql' || mediaKind === 'script' || mediaKind === 'data'
}
