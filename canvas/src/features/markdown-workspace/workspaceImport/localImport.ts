import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { parseWebkitRelativePath } from '@/features/source-files/webkitRelativePath'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { WORKSPACE_IMPORT_DEFER_LOCAL_FILE_BYTES, WORKSPACE_IMPORT_DEFER_LOCAL_MODEL_BYTES } from '@/lib/config'
import { SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
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
  inferModelAssetFormatFromName,
  isGlbAssetName,
  isGltfAssetName,
} from './glbAsset'
import type { WorkspaceModelAssetFormat } from './glbAsset'
import { importTextFileOrWorkspaceJsonLd } from './workspaceFileJsonLd'
import type { WorkspaceImportResult } from './types'

function toFileArray(files: FileList | ReadonlyArray<File> | null): File[] {
  if (!files) return []
  try {
    return Array.from(files as ArrayLike<File>)
  } catch {
    return []
  }
}

function isPdfFile(file: File): boolean {
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

function getModelAssetFormat(file: File): WorkspaceModelAssetFormat | null {
  if (isGltfFile(file)) return 'gltf'
  if (isGlbFile(file)) return 'glb'
  return null
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

const WORKSPACE_IMPORT_EXTS = (() => {
  const exts = new Set<string>()
  for (const ext of SOURCE_FILES_FORMATS.import) exts.add(String(ext || '').toLowerCase())
  exts.add('.mdx')
  return exts
})()

function isSupportedWorkspaceImportFile(file: File): boolean {
  const name = String(file.name || '').trim()
  if (!name) return false
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.slice(dot) : ''
  if (!ext || !ext.startsWith('.')) return false
  return WORKSPACE_IMPORT_EXTS.has(ext)
}

function isWorkspaceJsonLdName(nameRaw: string): boolean {
  const lower = String(nameRaw || '').trim().toLowerCase()
  return lower.endsWith('.jsonld') || lower.endsWith('.json-ld')
}

function shouldDeferLargeLocalFileImport(file: File, nameRaw: string): boolean {
  if (isPdfFile(file)) return false
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
      const importName = modelFormat ? deriveModelWorkspaceDocumentName(nameRaw, modelFormat) : nameRaw
      const desiredPath = normalizeWorkspacePath(`${parentPath}/${importName}`)
      const lowerName = nameRaw.toLowerCase()
      const looksLikeWorkspaceFile = lowerName.endsWith('.jsonld') || lowerName.endsWith('.json-ld')
      if (
        desiredPath
        && !looksLikeWorkspaceFile
        && !isPdfFile(file)
      ) {
        const existingText = await args.fs.readFileText(desiredPath)
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
            continue
          }
          const rawText = modelFormat ? await buildModelAssetMarkdownFromFile(file, modelFormat) : await file.text()
          await args.fs.writeFileText(desiredPath, rawText)
          clearPendingLocalImport(desiredPath)
          createdPaths.push(desiredPath)
          sources.push({ path: desiredPath, source: { kind: 'local', originalName: file.name } })
          continue
        }
      }

      const createdPath = shouldDeferLargeLocalFileImport(file, nameRaw)
        ? await (async () => {
            const created = await args.fs.createFile({
              parentPath,
              name: importName,
              text: buildPendingLocalImportStub({
                kind: modelFormat || 'text',
                originalName: nameRaw,
                source: 'file',
                bytes: Math.max(0, Number(file?.size || 0)),
              }),
            })
            setPendingLocalImport(created, { kind: modelFormat || 'text', file, originalName: nameRaw })
            if (modelFormat) {
              await args.fs.writeFileText(created, buildPendingLocalImportStub({
                kind: modelFormat,
                originalName: nameRaw,
                source: 'file',
                pendingPath: created,
                bytes: Math.max(0, Number(file?.size || 0)),
              }))
            }
            return created
          })()
        : isPdfFile(file)
          ? await importPdfFile({ fs: args.fs, file, parentPath })
          : modelFormat
            ? await args.fs.createFile({
                parentPath,
                name: importName,
                text: await buildModelAssetMarkdownFromFile(file, modelFormat),
              })
          : await importTextFileOrWorkspaceJsonLd({
              file,
              onText: async ({ name, text }) => await args.fs.createFile({ parentPath, name, text }),
            })
      const normalized = normalizeWorkspacePath(createdPath)
      createdPaths.push(normalized)
      sources.push({ path: normalized, source: { kind: 'local', originalName: file.name } })
    } catch (e) {
      failed.push({ name: nameRaw, error: String((e as { message?: unknown })?.message ?? e) })
    }
  }

  return { createdPaths, sources, skipped, failed }
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
    const rawRelName = String(parts[parts.length - 1] || nameRaw).trim() || nameRaw
    const relName = modelFormat ? deriveModelWorkspaceDocumentName(rawRelName, modelFormat) : rawRelName
    const relDir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''

    try {
      const parentPath = relDir ? await ensureFolderRel(args.fs, WORKSPACE_ROOT_PATH, relDir) : WORKSPACE_ROOT_PATH
      const createdPath = isPdfFile(file)
        ? await (async () => {
            const baseName = deriveMarkdownNameFromPdfFilename(relName)
            const created = await args.fs.createFile({
              parentPath,
              name: baseName,
              text: buildPendingLocalImportStub({ kind: 'pdf', originalName: rawRelName, source: 'folder' }),
            })
            setPendingLocalImport(created, { kind: 'pdf', file, originalName: rawRelName })
            return created
          })()
        : await (async () => {
            const created = await args.fs.createFile({
              parentPath,
              name: relName,
              text: buildPendingLocalImportStub({
                kind: modelFormat || 'text',
                originalName: rawRelName,
                source: 'folder',
                bytes: Math.max(0, Number(file?.size || 0)),
              }),
            })
            setPendingLocalImport(created, { kind: modelFormat || 'text', file, originalName: rawRelName })
            if (modelFormat) {
              await args.fs.writeFileText(created, buildPendingLocalImportStub({
                kind: modelFormat,
                originalName: rawRelName,
                source: 'folder',
                pendingPath: created,
                bytes: Math.max(0, Number(file?.size || 0)),
              }))
            }
            return created
          })()

      const normalized = normalizeWorkspacePath(createdPath)
      createdPaths.push(normalized)
      sources.push({ path: normalized, source: { kind: 'local', originalName: file.name } })
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

  return { createdPaths, sources, skipped, failed }
}
