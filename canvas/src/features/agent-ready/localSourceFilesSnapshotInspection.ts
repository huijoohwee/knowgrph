import type { SourceFile } from '@/hooks/store/types'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import { resolveMaterializedWorkspaceActivePath } from '@/features/source-files/sourceFilesRuntimeMaterialization'
import { buildSourceFilesCompositionSignature } from '@/features/source-files/sourceFilesSignatures'
import { buildSourceFilesStorageSyncSignature } from '@/features/source-files/sourceFilesStorageSync'

type LocalSourceFilesSnapshotInspectionArgs = {
  sourceFiles?: SourceFile[] | null | undefined
  activePath?: WorkspacePath | null | undefined
}

type SourceFileSummary = {
  id: string
  name: string
  enabled: boolean
  status: SourceFile['status']
  sourceKind: 'url' | 'local' | ''
  sourcePath: string | null
  sourceUrl: string | null
  textLength: number
  hasParsedGraphData: boolean
  parsedGraphRevision: number | null
  error: string | null
}

const SOURCE_FILE_SAMPLE_LIMIT = 10

const normalizeString = (value: unknown): string => String(value || '').trim()

const isWorkspaceBackedSourceFile = (file: SourceFile | null | undefined): boolean =>
  normalizeString(file?.source?.path).startsWith('workspace:')

const summarizeSourceFile = (file: SourceFile | null | undefined): SourceFileSummary => {
  const sourceKind = normalizeString(file?.source?.kind)
  return {
    id: normalizeString(file?.id),
    name: normalizeString(file?.name),
    enabled: file?.enabled === true,
    status: file?.status === 'loading' || file?.status === 'parsed' || file?.status === 'error' ? file.status : 'idle',
    sourceKind: sourceKind === 'url' || sourceKind === 'local' ? sourceKind : '',
    sourcePath: normalizeString(file?.source?.path) || null,
    sourceUrl: normalizeString(file?.source?.url) || null,
    textLength: String(file?.text || '').length,
    hasParsedGraphData: !!(file?.parsedGraphData && typeof file.parsedGraphData === 'object'),
    parsedGraphRevision: typeof file?.parsedGraphRevision === 'number' ? file.parsedGraphRevision : null,
    error: normalizeString(file?.error) || null,
  }
}

export const inspectLocalSourceFilesSnapshot = (args: LocalSourceFilesSnapshotInspectionArgs) => {
  const sourceFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  const activePath = resolveMaterializedWorkspaceActivePath({
    activePathOverride: args.activePath ?? null,
  })
  const activeSourcePath = activePath ? resolveWorkspaceSourcePathKey(activePath) : null
  const activeSourceFile = activeSourcePath
    ? sourceFiles.find(file => normalizeString(file?.source?.path) === activeSourcePath) || null
    : null
  const workspaceBackedSourceFiles = sourceFiles.filter(file => isWorkspaceBackedSourceFile(file))
  const enabledSourceFiles = sourceFiles.filter(file => file?.enabled === true)
  const enabledWorkspaceBackedSourceFiles = workspaceBackedSourceFiles.filter(file => file?.enabled === true)
  const parsedSourceFiles = sourceFiles.filter(file => file?.status === 'parsed')
  const errorSourceFiles = sourceFiles.filter(file => file?.status === 'error')
  const compositionSignature = buildSourceFilesCompositionSignature(sourceFiles, {
    includeWorkspaceBacked: true,
    intent: 'explicit-graph-owner',
  })
  const storageSyncSignature = buildSourceFilesStorageSyncSignature(sourceFiles)
  const sampleSourceFiles = sourceFiles.slice(0, SOURCE_FILE_SAMPLE_LIMIT).map(summarizeSourceFile)

  if (sourceFiles.length === 0) {
    return {
      available: false,
      sourceKind: 'browser-local-source-files-snapshot',
      activePath,
      activeSourcePath,
      compositionSignature,
      storageSyncSignature,
      sourceFileCount: 0,
      workspaceBackedSourceFileCount: 0,
      enabledSourceFileCount: 0,
      enabledWorkspaceBackedSourceFileCount: 0,
      enabledNonWorkspaceSourceFileCount: 0,
      parsedSourceFileCount: 0,
      errorSourceFileCount: 0,
      activeSourceFile: null,
      sampleLimit: SOURCE_FILE_SAMPLE_LIMIT,
      truncated: false,
      sampleSourceFiles,
      message: 'No local source-files snapshot is currently registered in the app runtime.',
    }
  }

  return {
    available: true,
    sourceKind: 'browser-local-source-files-snapshot',
    activePath,
    activeSourcePath,
    compositionSignature,
    storageSyncSignature,
    sourceFileCount: sourceFiles.length,
    workspaceBackedSourceFileCount: workspaceBackedSourceFiles.length,
    enabledSourceFileCount: enabledSourceFiles.length,
    enabledWorkspaceBackedSourceFileCount: enabledWorkspaceBackedSourceFiles.length,
    enabledNonWorkspaceSourceFileCount: enabledSourceFiles.length - enabledWorkspaceBackedSourceFiles.length,
    parsedSourceFileCount: parsedSourceFiles.length,
    errorSourceFileCount: errorSourceFiles.length,
    activeSourceFile: activeSourceFile ? summarizeSourceFile(activeSourceFile) : null,
    sampleLimit: SOURCE_FILE_SAMPLE_LIMIT,
    truncated: sourceFiles.length > SOURCE_FILE_SAMPLE_LIMIT,
    sampleSourceFiles,
    message: null,
  }
}
