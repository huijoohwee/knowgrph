import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import type { CorpusSourceUnit } from '@/features/queryable-corpus/corpusGraph'
import { setPendingLocalImport } from './pendingLocalImport'
import { deriveModelWorkspaceDocumentName } from './glbAsset'
import { ensureWorkspaceFolderRel } from './localImportFolderPaths'
import {
  buildSpatialCaptureFilesetManifestMarkdown,
  deriveSpatialCaptureManifestName,
  resolveSpatialCaptureFilesets,
} from './spatialCaptureFileset'

type SourceUnitRecorder = (args: {
  path: WorkspacePath
  relativePath: string
  originalName: string
  text: string
  file: File
  status: CorpusSourceUnit['status']
}) => void

export async function materializeSpatialCaptureFilesetImports(args: {
  fs: WorkspaceFs
  files: ReadonlyArray<File>
  createdPaths: WorkspacePath[]
  sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }>
  failed: Array<{ name: string; error: string }>
  recordSourceUnit: SourceUnitRecorder
}): Promise<Set<string>> {
  const filesets = resolveSpatialCaptureFilesets(args.files)
  const handledFileKeys = new Set(
    filesets.flatMap(fileset => fileset.files.map(file => file.relativePath || file.originalName)),
  )

  for (const fileset of filesets) {
    try {
      const parentPath = fileset.folderPath ? await ensureWorkspaceFolderRel(args.fs, fileset.folderPath) : WORKSPACE_ROOT_PATH
      const colliderName = deriveModelWorkspaceDocumentName(fileset.collider.originalName, 'glb')
      const colliderPath = normalizeWorkspacePath(`${parentPath}/${colliderName}`)
      setPendingLocalImport(colliderPath, { kind: 'glb', file: fileset.collider.file, originalName: fileset.collider.originalName })

      const manifestName = deriveSpatialCaptureManifestName(fileset)
      const manifestText = buildSpatialCaptureFilesetManifestMarkdown({
        fileset,
        colliderWorkspacePath: colliderPath,
        colliderDocumentName: colliderName,
      })
      const manifestPath = normalizeWorkspacePath(await args.fs.createFile({ parentPath, name: manifestName, text: manifestText }))
      args.createdPaths.push(manifestPath)
      args.sources.push({ path: manifestPath, source: { kind: 'local', originalName: manifestName } })
      for (const file of fileset.files) {
        args.recordSourceUnit({
          path: manifestPath,
          relativePath: file.relativePath || file.originalName,
          originalName: file.originalName,
          text: manifestText,
          file: file.file,
          status: 'pending',
        })
      }
    } catch (e) {
      args.failed.push({ name: fileset.baseName, error: String((e as { message?: unknown })?.message ?? e) })
    }
  }

  return handledFileKeys
}
