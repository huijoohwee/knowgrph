import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { parseWebkitRelativePath } from '@/features/source-files/webkitRelativePath'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { WORKSPACE_IMPORT_DEFER_LOCAL_FILE_BYTES, WORKSPACE_IMPORT_DEFER_LOCAL_MODEL_BYTES } from '@/lib/config'
import { readPdfWorkspaceOutputDirRel } from '@/lib/pdf/pdfWorkspacePreferences'
import { fetchPdfWorkspaceDoc, importPdfToWorkspace } from '@/lib/pdf/pdfWorkspaceClient'
import { deriveMarkdownNameFromPdfFilename } from '@/features/toolbar/ingestUtils'
import {
  buildPendingLocalImportStub,
  clearPendingLocalImport,
  isPendingLocalImportStubText,
  setPendingLocalImport,
} from './pendingLocalImport'
import {
  buildModelAssetMarkdownFromFile,
  deriveModelWorkspaceDocumentName,
} from './glbAsset'
import { importTextFileOrWorkspaceJsonLd, isWorkspaceJsonLdName } from './workspaceFileJsonLd'
import type { WorkspaceImportResult } from './types'
import {
  buildCorpusMediaMetadataMarkdown,
  buildCorpusMediaWorkspaceDocumentName,
  inferCorpusMediaKind,
  type CorpusSourceUnit,
} from '@/features/queryable-corpus/corpusGraph'
import {
  buildCorpusWorkspaceImportResult,
  createCorpusSourceUnitRecorder,
} from '@/features/queryable-corpus/sourceFilesCorpusManifest'
import {
  getModelAssetFormat,
  isCorpusMediaImportFile,
  isLocalTextWorkspaceImportName,
  isPdfFile,
  isSupportedWorkspaceImportFile,
  toFileArray,
} from './localImportFormats'

function recordCorpusSourceUnit(
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

function stripEmbeddedBase64ImageSrc(raw: string): { text: string; changed: boolean } {
  const s = String(raw || '')
  const needle = 'data:image/'
  const base64Needle = ';base64,'
  let index = 0
  let changed = false
  let out = ''
  while (index < s.length) {
    const start = s.indexOf(needle, index)
    if (start < 0) {
      out += s.slice(index)
      break
    }
    const base64Pos = s.indexOf(base64Needle, start)
    if (base64Pos < 0) {
      out += s.slice(index)
      break
    }
    out += s.slice(index, start)
    const afterBase64 = base64Pos + base64Needle.length
    const maxScan = Math.min(s.length, afterBase64 + 2_000_000)
    let end = afterBase64
    for (; end < maxScan; end += 1) {
      const ch = s.charCodeAt(end)
      if (ch === 41 || ch === 34 || ch === 39 || ch === 32 || ch === 10 || ch === 13 || ch === 9) break
    }
    changed = true
    out += 'data:image/omitted;base64,'
    index = end
  }
  return { text: out, changed }
}

function yamlQuote(value: string): string {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function buildPdfWorkspaceFrontmatter(args: { docId: string; outputDirRel: string }): string {
  return `---\nkgPdfWorkspaceDocId: ${yamlQuote(args.docId)}\nkgPdfWorkspaceOutputDirRel: ${yamlQuote(args.outputDirRel)}\n---\n\n`
}

async function importPdfFile(args: { fs: WorkspaceFs; file: File; parentPath: WorkspacePath }): Promise<WorkspacePath> {
  const outputDirRel = readPdfWorkspaceOutputDirRel()
  const imported = await importPdfToWorkspace({ file: args.file, outputDirRel })
  if (!imported) throw new Error('PDF import failed')
  if (imported.ok !== true) throw new Error(imported.error || 'PDF import failed')
  const fetched = await fetchPdfWorkspaceDoc({ docId: imported.docId, outputDirRel })
  if (!fetched) throw new Error('PDF import failed')
  if (fetched.ok !== true) throw new Error(fetched.error || 'PDF import failed')
  const markdownRaw = String(fetched.markdown || '')
  const stripped = stripEmbeddedBase64ImageSrc(markdownRaw)
  const notice = stripped.changed ? `> Embedded base64 image data omitted for editor readability.\n\n` : ''
  const text = `${buildPdfWorkspaceFrontmatter({ docId: imported.docId, outputDirRel })}${notice}${stripped.text}`
  const name = deriveMarkdownNameFromPdfFilename(String(imported.name || 'document.md'))
  return args.fs.createFile({ parentPath: args.parentPath, name, text })
}

function shouldDeferLargeLocalFileImport(file: File, nameRaw: string): boolean {
  if (isPdfFile(file)) return false
  if (isCorpusMediaImportFile(file)) return false
  if (isWorkspaceJsonLdName(nameRaw)) return false
  const size = Math.max(0, Number(file?.size || 0))
  if (getModelAssetFormat(file)) return size >= WORKSPACE_IMPORT_DEFER_LOCAL_MODEL_BYTES
  return size >= WORKSPACE_IMPORT_DEFER_LOCAL_FILE_BYTES
}

async function ensureFolderRel(fs: WorkspaceFs, parentPath: WorkspacePath, relDir: string): Promise<WorkspacePath> {
  const raw = String(relDir || '').replace(/\\/g, '/').replace(/^\/+/, '').trim()
  if (!raw) return parentPath
  const segments = raw.split('/').filter(Boolean)
  let parent = parentPath
  for (const seg of segments) {
    const name = String(seg || '').trim()
    if (!name) continue
    try {
      await fs.createFolder({ parentPath: parent, name })
    } catch {
      void 0
    }
    parent = normalizeWorkspacePath(`${parent}/${name}`)
  }
  return parent
}

function shouldMaterializeFolderTextForCorpus(nameRaw: string, mimeHint?: string | null): boolean {
  const mediaKind = inferCorpusMediaKind(nameRaw, mimeHint)
  return mediaKind === 'code' || mediaKind === 'sql' || mediaKind === 'script' || mediaKind === 'data'
}

export async function importWorkspaceLocalFiles(args: {
  fs: WorkspaceFs
  files: FileList | ReadonlyArray<File> | null
  parentPath?: WorkspacePath
  onProgress?: (p: {
    label?: string
    current: number
    total: number
    name?: string
    bytesCurrent?: number
    bytesTotal?: number
  }) => void
}): Promise<WorkspaceImportResult> {
  const files = toFileArray(args.files)
  if (files.length === 0) return { createdPaths: [], sources: [], skipped: [], failed: [] }
  const parentPath = args.parentPath || WORKSPACE_ROOT_PATH
  const createdPaths: WorkspacePath[] = []
  const sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }> = []
  const skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }> = []
  const failed: Array<{ name: string; error: string }> = []
  const sourceUnits: CorpusSourceUnit[] = []
  const recordSourceUnit = createCorpusSourceUnitRecorder({ sourceUnits, importMode: 'file' })

  const bytesTotal = files.reduce((sum, f) => sum + Math.max(0, Number(f?.size || 0)), 0)
  let bytesCurrent = 0

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const nameRaw = String(file?.name || '').trim()
    const name = nameRaw || 'file'
    try {
      bytesCurrent += Math.max(0, Number(file?.size || 0))
      args.onProgress?.({
        label: isPdfFile(file) ? 'Converting PDF' : 'Importing',
        current: index + 1,
        total: files.length,
        name,
        bytesCurrent,
        bytesTotal,
      })
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    } catch {
      void 0
    }

    if (!nameRaw) {
      skipped.push({ name: '', reason: 'missing-name' })
      continue
    }
    if (!isSupportedWorkspaceImportFile(file)) {
      skipped.push({ name: nameRaw, reason: 'unsupported' })
      continue
    }
    try {
      const modelFormat = getModelAssetFormat(file)
      const mediaMetadata = isCorpusMediaImportFile(file)
      const importName = mediaMetadata
        ? buildCorpusMediaWorkspaceDocumentName(nameRaw)
        : modelFormat ? deriveModelWorkspaceDocumentName(nameRaw, modelFormat) : nameRaw
      const desiredPath = normalizeWorkspacePath(`${parentPath}/${importName}`)
      const lowerName = nameRaw.toLowerCase()
      const looksLikeWorkspaceFile = lowerName.endsWith('.jsonld') || lowerName.endsWith('.json-ld')
      if (
        desiredPath
        && !looksLikeWorkspaceFile
        && !isPdfFile(file)
      ) {
        const existingText = await args.fs.readFileText(desiredPath)
        if (typeof existingText === 'string' && !isPendingLocalImportStubText(existingText)) {
          const nextText = shouldDeferLargeLocalFileImport(file, nameRaw)
            ? buildPendingLocalImportStub({
                kind: modelFormat || 'text',
                originalName: nameRaw,
                source: 'file',
                ...(modelFormat ? { pendingPath: desiredPath } : {}),
                bytes: Math.max(0, Number(file?.size || 0)),
              })
            : mediaMetadata
              ? buildCorpusMediaMetadataMarkdown({
                  originalName: nameRaw,
                  mimeHint: file.type,
                  byteSize: file.size,
                  importMode: 'file',
                  relativePath: nameRaw,
                })
              : modelFormat ? await buildModelAssetMarkdownFromFile(file, modelFormat) : await file.text()
          if (existingText === nextText) {
            createdPaths.push(desiredPath)
            sources.push({ path: desiredPath, source: { kind: 'local', originalName: file.name } })
            recordCorpusSourceUnit(recordSourceUnit, { path: desiredPath, relativePath: nameRaw, originalName: nameRaw, text: existingText, file, status: 'cached' })
            continue
          }
        }
        if (typeof existingText === 'string' && isPendingLocalImportStubText(existingText)) {
          if (shouldDeferLargeLocalFileImport(file, nameRaw)) {
            const kind = modelFormat || 'text'
            await args.fs.writeFileText(desiredPath, buildPendingLocalImportStub({
              kind,
              originalName: nameRaw,
              source: 'file',
              ...(modelFormat ? { pendingPath: desiredPath } : {}),
              bytes: Math.max(0, Number(file?.size || 0)),
            }))
            setPendingLocalImport(desiredPath, { kind, file, originalName: nameRaw })
            createdPaths.push(desiredPath)
            sources.push({ path: desiredPath, source: { kind: 'local', originalName: file.name } })
            recordCorpusSourceUnit(recordSourceUnit, { path: desiredPath, relativePath: nameRaw, originalName: nameRaw, text: await args.fs.readFileText(desiredPath) || '', file, status: 'pending' })
            continue
          }
          if (mediaMetadata) {
            const metadataText = buildCorpusMediaMetadataMarkdown({
              originalName: nameRaw,
              mimeHint: file.type,
              byteSize: file.size,
              importMode: 'file',
              relativePath: nameRaw,
            })
            await args.fs.writeFileText(desiredPath, metadataText)
            clearPendingLocalImport(desiredPath)
            createdPaths.push(desiredPath)
            sources.push({ path: desiredPath, source: { kind: 'local', originalName: file.name } })
            recordCorpusSourceUnit(recordSourceUnit, { path: desiredPath, relativePath: nameRaw, originalName: nameRaw, text: metadataText, file, status: 'unsupported' })
            continue
          }
          const rawText = modelFormat ? await buildModelAssetMarkdownFromFile(file, modelFormat) : await file.text()
          await args.fs.writeFileText(desiredPath, rawText)
          clearPendingLocalImport(desiredPath)
          createdPaths.push(desiredPath)
          sources.push({ path: desiredPath, source: { kind: 'local', originalName: file.name } })
          recordCorpusSourceUnit(recordSourceUnit, { path: desiredPath, relativePath: nameRaw, originalName: nameRaw, text: rawText, file, status: 'parsed' })
          continue
        }
      }

      let unitText = ''
      let unitStatus: CorpusSourceUnit['status'] = 'parsed'
      const createdPath = shouldDeferLargeLocalFileImport(file, nameRaw)
        ? await (async () => {
            const stubText = buildPendingLocalImportStub({
              kind: modelFormat || 'text',
              originalName: nameRaw,
              source: 'file',
              bytes: Math.max(0, Number(file?.size || 0)),
            })
            const created = await args.fs.createFile({
              parentPath,
              name: importName,
              text: stubText,
            })
            setPendingLocalImport(created, { kind: modelFormat || 'text', file, originalName: nameRaw })
            if (modelFormat) {
              unitText = buildPendingLocalImportStub({
                kind: modelFormat,
                originalName: nameRaw,
                source: 'file',
                pendingPath: created,
                bytes: Math.max(0, Number(file?.size || 0)),
              })
              await args.fs.writeFileText(created, unitText)
            } else {
              unitText = stubText
            }
            unitStatus = 'pending'
            return created
          })()
        : mediaMetadata
          ? await args.fs.createFile({
              parentPath,
              name: importName,
              text: (unitText = buildCorpusMediaMetadataMarkdown({
                originalName: nameRaw,
                mimeHint: file.type,
                byteSize: file.size,
                importMode: 'file',
                relativePath: nameRaw,
              })),
            })
        : isPdfFile(file)
          ? await importPdfFile({ fs: args.fs, file, parentPath })
          : modelFormat
            ? await args.fs.createFile({
                parentPath,
                name: importName,
                text: (unitText = await buildModelAssetMarkdownFromFile(file, modelFormat)),
              })
          : await importTextFileOrWorkspaceJsonLd({
              file,
              onText: async ({ name, text }) => {
                unitText = text
                return await args.fs.createFile({ parentPath, name, text })
              },
            })
      const normalized = normalizeWorkspacePath(createdPath)
      if (mediaMetadata) unitStatus = 'unsupported'
      if (isPdfFile(file) && !unitText) {
        unitText = String((await args.fs.readFileText(normalized).catch(() => '')) || '')
        unitStatus = 'pending'
      }
      createdPaths.push(normalized)
      sources.push({ path: normalized, source: { kind: 'local', originalName: file.name } })
      recordCorpusSourceUnit(recordSourceUnit, { path: normalized, relativePath: nameRaw, originalName: nameRaw, text: unitText || String((await args.fs.readFileText(normalized).catch(() => '')) || ''), file, status: unitStatus })
    } catch (e) {
      failed.push({ name: nameRaw, error: String((e as { message?: unknown })?.message ?? e) })
    }
  }

  return buildCorpusWorkspaceImportResult({ createdPaths, sources, skipped, failed, sourceUnits })
}

export async function importWorkspaceLocalFolder(args: {
  fs: WorkspaceFs
  files: FileList | ReadonlyArray<File> | null
  onProgress?: (p: {
    current: number
    total: number
    name?: string
    bytesCurrent?: number
    bytesTotal?: number
  }) => void
}): Promise<WorkspaceImportResult> {
  const files = toFileArray(args.files)
  if (files.length === 0) return { createdPaths: [], sources: [], skipped: [], failed: [] }
  const createdPaths: WorkspacePath[] = []
  const sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }> = []
  const skipped: Array<{ name: string; reason: 'unsupported' | 'missing-name' }> = []
  const failed: Array<{ name: string; error: string }> = []
  const sourceUnits: CorpusSourceUnit[] = []
  const recordSourceUnit = createCorpusSourceUnitRecorder({ sourceUnits, importMode: 'folder' })

  const bytesTotal = files.reduce((sum, f) => sum + Math.max(0, Number(f?.size || 0)), 0)
  let bytesCurrent = 0

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const nameRaw = String(file?.name || '').trim()
    try {
      bytesCurrent += Math.max(0, Number(file?.size || 0))
      args.onProgress?.({ current: index + 1, total: files.length, name: nameRaw, bytesCurrent, bytesTotal })
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    } catch {
      void 0
    }

    if (!nameRaw) {
      skipped.push({ name: '', reason: 'missing-name' })
      continue
    }
    if (!isSupportedWorkspaceImportFile(file)) {
      skipped.push({ name: nameRaw, reason: 'unsupported' })
      continue
    }

    const relRaw = (() => {
      const anyFile = file as unknown as { webkitRelativePath?: unknown }
      return typeof anyFile.webkitRelativePath === 'string' ? anyFile.webkitRelativePath : ''
    })()
    const rel = parseWebkitRelativePath(relRaw, nameRaw)
    const relPath = [String(rel.folderName || '').trim(), String(rel.rawRelativePath || '').trim()]
      .filter(Boolean)
      .join('/')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
    const parts = relPath.split('/').filter(Boolean)
    const modelFormat = getModelAssetFormat(file)
    const mediaMetadata = isCorpusMediaImportFile(file)
    const rawRelName = String(parts[parts.length - 1] || nameRaw).trim() || nameRaw
    const relName = mediaMetadata
      ? buildCorpusMediaWorkspaceDocumentName(rawRelName)
      : modelFormat ? deriveModelWorkspaceDocumentName(rawRelName, modelFormat) : rawRelName
    const relDir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''

    try {
      const parentPath = relDir ? await ensureFolderRel(args.fs, WORKSPACE_ROOT_PATH, relDir) : WORKSPACE_ROOT_PATH
      const desiredPath = normalizeWorkspacePath(`${parentPath}/${relName}`)
      let unitText = ''
      let unitStatus: CorpusSourceUnit['status'] = 'pending'
      const deferLocalImport = shouldDeferLargeLocalFileImport(file, rawRelName)
      const importAsImmediateCorpusText = !mediaMetadata
        && !modelFormat
        && !isPdfFile(file)
        && !deferLocalImport
        && isLocalTextWorkspaceImportName(rawRelName)
        && shouldMaterializeFolderTextForCorpus(rawRelName, file.type)
      if (mediaMetadata) {
        unitText = buildCorpusMediaMetadataMarkdown({
          originalName: rawRelName,
          mimeHint: file.type,
          byteSize: file.size,
          importMode: 'folder',
          relativePath: relPath || rawRelName,
        })
        unitStatus = 'unsupported'
      } else if (importAsImmediateCorpusText) {
        unitText = await file.text()
        unitStatus = 'parsed'
      } else if (!isPdfFile(file)) {
        unitText = buildPendingLocalImportStub({
          kind: modelFormat || 'text',
          originalName: rawRelName,
          source: 'folder',
          ...(modelFormat ? { pendingPath: desiredPath } : {}),
          bytes: Math.max(0, Number(file?.size || 0)),
        })
      }
      if (unitText) {
        const existingText = await args.fs.readFileText(desiredPath).catch(() => null)
        if (existingText === unitText) {
          createdPaths.push(desiredPath)
          sources.push({ path: desiredPath, source: { kind: 'local', originalName: file.name } })
          recordCorpusSourceUnit(recordSourceUnit, { path: desiredPath, relativePath: relPath || rawRelName, originalName: rawRelName, text: existingText, file, status: 'cached' })
          continue
        }
      }
      const createdPath = mediaMetadata
        ? await args.fs.createFile({
            parentPath,
            name: relName,
            text: unitText,
          })
        : importAsImmediateCorpusText
        ? await args.fs.createFile({
            parentPath,
            name: relName,
            text: unitText,
          })
        : isPdfFile(file)
        ? await (async () => {
            const baseName = deriveMarkdownNameFromPdfFilename(relName)
            unitText = buildPendingLocalImportStub({ kind: 'pdf', originalName: rawRelName, source: 'folder' })
            const created = await args.fs.createFile({
              parentPath,
              name: baseName,
              text: unitText,
            })
            setPendingLocalImport(created, { kind: 'pdf', file, originalName: rawRelName })
            return created
          })()
        : await (async () => {
            const created = await args.fs.createFile({
              parentPath,
              name: relName,
              text: unitText,
            })
            setPendingLocalImport(created, { kind: modelFormat || 'text', file, originalName: rawRelName })
            if (modelFormat) {
              unitText = buildPendingLocalImportStub({
                kind: modelFormat,
                originalName: rawRelName,
                source: 'folder',
                pendingPath: created,
                bytes: Math.max(0, Number(file?.size || 0)),
              })
              await args.fs.writeFileText(created, unitText)
            }
            return created
          })()

      const normalized = normalizeWorkspacePath(createdPath)
      createdPaths.push(normalized)
      sources.push({ path: normalized, source: { kind: 'local', originalName: file.name } })
      recordCorpusSourceUnit(recordSourceUnit, { path: normalized, relativePath: relPath || rawRelName, originalName: rawRelName, text: unitText || String((await args.fs.readFileText(normalized).catch(() => '')) || ''), file, status: unitStatus })
    } catch (e) {
      failed.push({ name: nameRaw, error: String((e as { message?: unknown })?.message ?? e) })
      try {
        const failPath = normalizeWorkspacePath(`${WORKSPACE_ROOT_PATH}/${relDir}/${relName}`)
        clearPendingLocalImport(failPath)
      } catch {
        void 0
      }
    }
  }

  return buildCorpusWorkspaceImportResult({ createdPaths, sources, skipped, failed, sourceUnits })
}
