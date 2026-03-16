import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { readPdfWorkspaceOutputDirRel } from '@/lib/pdf/pdfWorkspacePreferences'
import { fetchPdfWorkspaceDoc, importPdfToWorkspace } from '@/lib/pdf/pdfWorkspaceClient'

type PendingLocalImportItem =
  | { kind: 'text'; file: File; originalName: string }
  | { kind: 'pdf'; file: File; originalName: string }

const pendingLocalImportsByPath = new Map<string, PendingLocalImportItem>()

const PENDING_LOCAL_IMPORT_MARKER = 'kg:pending-local-import'

function buildPdfWorkspaceFrontmatter(args: { docId: string; outputDirRel: string }): string {
  return `---\nkgPdfWorkspaceDocId: "${String(args.docId || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\nkgPdfWorkspaceOutputDirRel: "${String(args.outputDirRel || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n---\n\n`
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

export function buildPendingLocalImportStub(args: { kind: PendingLocalImportItem['kind']; originalName: string }): string {
  const name = String(args.originalName || '').trim() || 'file'
  const kindLabel = args.kind === 'pdf' ? 'PDF' : 'file'
  return [
    `<!--${PENDING_LOCAL_IMPORT_MARKER}-->`,
    `> Pending local folder import (${kindLabel}).`,
    `> Re-import the folder if you reload before opening this ${kindLabel}.`,
    `> Original: ${name}`,
    '',
  ].join('\n')
}

export function setPendingLocalImport(path: WorkspacePath, item: PendingLocalImportItem): void {
  const key = normalizeWorkspacePath(path)
  pendingLocalImportsByPath.set(key, item)
}

export function clearPendingLocalImport(path: WorkspacePath): void {
  const key = normalizeWorkspacePath(path)
  pendingLocalImportsByPath.delete(key)
}

export function peekPendingWorkspaceLocalImport(path: WorkspacePath): PendingLocalImportItem | null {
  const key = normalizeWorkspacePath(path)
  return pendingLocalImportsByPath.get(key) || null
}

export function isPendingLocalImportStubText(text: string): boolean {
  return String(text || '').includes(PENDING_LOCAL_IMPORT_MARKER)
}

export async function hydrateWorkspaceFileFromPendingLocalImport(args: {
  fs: WorkspaceFs
  path: WorkspacePath
}): Promise<{ kind: PendingLocalImportItem['kind']; text: string } | null> {
  const key = normalizeWorkspacePath(args.path)
  const pending = pendingLocalImportsByPath.get(key)
  if (!pending) return null
  try {
    if (pending.kind === 'pdf') {
      const outputDirRel = readPdfWorkspaceOutputDirRel()
      const imported = await importPdfToWorkspace({ file: pending.file, outputDirRel })
      if (!imported) throw new Error('PDF import failed')
      if (imported.ok !== true) throw new Error(imported.error || 'PDF import failed')
      const fetched = await fetchPdfWorkspaceDoc({ docId: imported.docId, outputDirRel })
      if (!fetched) throw new Error('PDF import failed')
      if (fetched.ok !== true) throw new Error(fetched.error || 'PDF import failed')
      const markdownRaw = String(fetched.markdown || '')
      const stripped = stripEmbeddedBase64ImageSrc(markdownRaw)
      const notice = stripped.changed ? `> Embedded base64 image data omitted for editor readability.\n\n` : ''
      const text = `${buildPdfWorkspaceFrontmatter({ docId: imported.docId, outputDirRel })}${notice}${stripped.text}`
      await args.fs.writeFileText(key, text)
      pendingLocalImportsByPath.delete(key)
      return { kind: 'pdf', text }
    }

    const text = await pending.file.text()
    await args.fs.writeFileText(key, text)
    pendingLocalImportsByPath.delete(key)
    return { kind: 'text', text }
  } catch {
    return null
  }
}

