import { useGraphStore } from '@/hooks/useGraphStore'
import type { SourceFile } from '@/hooks/store/types'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { findNextSourceFileIndex, normalizeParentPath } from './sourceFileNaming'
import { parseWebkitRelativePath } from './webkitRelativePath'
import { isMarkdownLikeFileName } from 'grph-shared/markdown/mermaidInput'
import { buildSourceFileRecord } from '@/features/source-files/sourceFileParsedState'
import {
  cacheMarkdownFolderFromFileInput,
  getMostRecentCachedMarkdownFolderId,
  listCachedMarkdownPaths,
  readCachedMarkdownText,
} from './markdownFsCache'

const toLogicalPath = (raw: string): string => {
  const p = String(raw || '').trim().replace(/\\/g, '/')
  return p.replace(/^\/+/, '').replace(/\/+$/, '')
}

const isHiddenName = (name: string): boolean => {
  const trimmed = String(name || '').trim()
  return trimmed.startsWith('.')
}

const looksLikeUrl = (raw: string): boolean => {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return false
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(s)) return true
  if (s.startsWith('www.')) return true
  return false
}

const getLocalMarkdownPathCandidate = (file: SourceFile): string | null => {
  if (!file) return null
  if (file.source && file.source.kind !== 'local') return null

  const rawPath =
    file.source?.kind === 'local'
      ? String(file.source.path || file.name || '')
      : String(file.name || '')
  const path = toLogicalPath(rawPath)
  if (!path) return null
  if (looksLikeUrl(path)) return null
  if (!isMarkdownLikeFileName(path)) return null
  return path
}

const buildLocalSourceFileId = (relativePath: string): string => {
  const key = `local-md:${String(relativePath || '').trim().toLowerCase()}`
  return `sf_local_${hashStringToHex(key)}`
}

const buildLocalMarkdownSourceFile = (args: {
  path: string
  previous?: SourceFile | null
}): SourceFile =>
  buildSourceFileRecord({
    id: buildLocalSourceFileId(args.path),
    name: args.path,
    text: args.previous?.text || '',
    enabled: args.previous ? !!args.previous.enabled : true,
    geoLayerEnabled: args.previous?.geoLayerEnabled,
    status: args.previous?.status ?? 'idle',
    error: args.previous?.error,
    previousState: args.previous,
    preserveParsedState: true,
    source: { kind: 'local', path: args.path },
  })

const iterDirectoryEntries = (handle: FileSystemDirectoryHandle): AsyncIterable<[string, FileSystemHandle]> => {
  const h = handle as unknown as { entries?: () => AsyncIterable<[string, FileSystemHandle]> }
  if (typeof h.entries === 'function') return h.entries()
  const v = handle as unknown as { values?: () => AsyncIterable<FileSystemHandle> }
  if (typeof v.values === 'function') {
    const values = v.values()
    return (async function* () {
      for await (const entry of values) {
        const name = String((entry as unknown as { name?: unknown }).name || '')
        yield [name, entry]
      }
    })()
  }
  return (async function* () {})()
}

const getDirHandleByPath = async (
  root: FileSystemDirectoryHandle,
  relativeDirPath: string,
  opts?: { create?: boolean },
): Promise<FileSystemDirectoryHandle> => {
  const path = toLogicalPath(relativeDirPath)
  const create = !!opts?.create
  if (!path) return root
  const parts = path.split('/').filter(Boolean)
  let cur = root
  for (const part of parts) {
    cur = await cur.getDirectoryHandle(part, { create })
  }
  return cur
}

const getFileHandleByPath = async (
  root: FileSystemDirectoryHandle,
  relativeFilePath: string,
  opts?: { create?: boolean },
): Promise<FileSystemFileHandle> => {
  const path = toLogicalPath(relativeFilePath)
  const create = !!opts?.create
  const parts = path.split('/').filter(Boolean)
  const fileName = parts.pop()
  if (!fileName) throw new Error('Missing file name')
  const parent = await getDirHandleByPath(root, parts.join('/'), { create })
  return parent.getFileHandle(fileName, { create })
}

const isOpfsSupported = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const storage = (navigator as unknown as { storage?: unknown }).storage as unknown
  if (!storage || typeof storage !== 'object') return false
  return typeof (storage as { getDirectory?: unknown }).getDirectory === 'function'
}

const getOpfsRootDirectory = async (): Promise<FileSystemDirectoryHandle> => {
  const storage = (navigator as unknown as { storage: { getDirectory: () => Promise<FileSystemDirectoryHandle> } }).storage
  return storage.getDirectory()
}

const sanitizeFolderName = (raw: string | null | undefined): string => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return cleaned || 'local-folder'
}

const createUniqueOpfsProjectDirectory = async (baseName: string): Promise<FileSystemDirectoryHandle> => {
  const root = await getOpfsRootDirectory()
  const base = sanitizeFolderName(baseName)
  const exists = async (name: string): Promise<boolean> => {
    try {
      await root.getDirectoryHandle(name)
      return true
    } catch {
      return false
    }
  }
  if (!(await exists(base))) return root.getDirectoryHandle(base, { create: true })
  let n = 2
  while (n < 1000) {
    const candidate = `${base}-${n}`
    if (!(await exists(candidate))) return root.getDirectoryHandle(candidate, { create: true })
    n += 1
  }
  return root.getDirectoryHandle(`${base}-${Date.now()}`, { create: true })
}

export const isLocalMarkdownFolderSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  const hasDirectoryPicker = typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  if (hasDirectoryPicker) return true
  if (typeof document === 'undefined') return false
  try {
    const input = document.createElement('input')
    const anyInput = input as unknown as Record<string, unknown>
    return 'webkitdirectory' in anyInput || 'mozdirectory' in anyInput || 'directory' in anyInput
  } catch {
    return false
  }
}

export const isLocalMarkdownFolderWriteSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
}

const openLocalFolderViaFileInput = async (): Promise<{ folderName: string | null; filesByPath: Map<string, File> } | null> => {
  if (typeof document === 'undefined') return null
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.setAttribute('webkitdirectory', '')
  input.setAttribute('directory', '')
  input.setAttribute('mozdirectory', '')
  input.setAttribute('aria-hidden', 'true')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  input.style.top = '0'

  const pickFiles = () =>
    new Promise<FileList | null>((resolve) => {
      const cleanup = () => {
        try {
          input.removeEventListener('change', onChange)
        } catch {
          void 0
        }
        try {
          input.parentElement?.removeChild(input)
        } catch {
          void 0
        }
      }
      const onChange = () => {
        const files = input.files
        cleanup()
        resolve(files)
      }
      try {
        input.addEventListener('change', onChange, { once: true })
        document.body.appendChild(input)
        input.click()
      } catch {
        cleanup()
        resolve(null)
      }
    })

  const files = await pickFiles()
  const list = files ? Array.from(files) : []
  if (list.length === 0) return null

  const filesByPath = new Map<string, File>()
  let folderName: string | null = null
  for (const f of list) {
    const rel = String((f as unknown as { webkitRelativePath?: unknown }).webkitRelativePath || '').trim().replace(/\\/g, '/')
    const parsed = parseWebkitRelativePath(rel, String(f.name || '').trim())
    if (!folderName && parsed.folderName) folderName = parsed.folderName
    const rawPath = parsed.rawRelativePath
    const logicalPath = toLogicalPath(rawPath)
    if (!logicalPath) continue
    if (!isMarkdownLikeFileName(logicalPath)) continue
    filesByPath.set(logicalPath, f)
  }

  return { folderName, filesByPath }
}

export const syncLocalMarkdownFolderToSourceFiles = async (args?: {
  rootHandle?: FileSystemDirectoryHandle
}): Promise<void> => {
  const store = useGraphStore.getState()
  const root = args?.rootHandle || store.localMarkdownFolderHandle
  if (!root) {
    const cacheId = String(store.localMarkdownFolderCacheId || '').trim() || (await getMostRecentCachedMarkdownFolderId())
    if (!cacheId) return

    const paths = await listCachedMarkdownPaths(cacheId)
    const found: Array<{ path: string }> = paths
      .map(p => ({ path: toLogicalPath(p) }))
      .filter(x => !!x.path && isMarkdownLikeFileName(x.path))
      .sort((a, b) => a.path.localeCompare(b.path))

    const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
    const existingLocalByPath = new Map<string, SourceFile>()
    for (const f of existing) {
      const p = getLocalMarkdownPathCandidate(f)
      if (!p) continue
      existingLocalByPath.set(p, f)
    }
    const nextLocal: SourceFile[] = found.map(({ path }) => {
      const prev = existingLocalByPath.get(path)
      return buildLocalMarkdownSourceFile({ path, previous: prev })
    })
    const nonLocal = existing.filter(f => !getLocalMarkdownPathCandidate(f))
    store.setSourceFiles([...nextLocal, ...nonLocal])
    return
  }

  const stack: Array<{ handle: FileSystemDirectoryHandle; basePath: string }> = [{ handle: root, basePath: '' }]
  const found: Array<{ path: string }> = []
  while (stack.length > 0) {
    const next = stack.pop()
    if (!next) break
    const { handle, basePath } = next
    for await (const [name, entry] of iterDirectoryEntries(handle)) {
      if (isHiddenName(name)) continue
      if (entry.kind === 'directory') {
        const dirPath = basePath ? `${basePath}/${name}` : name
        stack.push({ handle: entry as FileSystemDirectoryHandle, basePath: dirPath })
        continue
      }
      if (!isMarkdownLikeFileName(name)) continue
      const filePath = basePath ? `${basePath}/${name}` : name
      found.push({ path: filePath })
    }
  }

  found.sort((a, b) => a.path.localeCompare(b.path))

  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const existingLocalByPath = new Map<string, SourceFile>()
  for (const f of existing) {
    const p = getLocalMarkdownPathCandidate(f)
    if (!p) continue
    existingLocalByPath.set(p, f)
  }
  const nextLocal: SourceFile[] = found.map(({ path }) => {
    const prev = existingLocalByPath.get(path)
    return buildLocalMarkdownSourceFile({ path, previous: prev })
  })
  const nonLocal = existing.filter(f => !getLocalMarkdownPathCandidate(f))
  store.setSourceFiles([...nextLocal, ...nonLocal])
}

export const openLocalMarkdownFolder = async (): Promise<boolean> => {
  const store = useGraphStore.getState()

  if (!isLocalMarkdownFolderSupported()) {
    store.pushUiToast({
      id: 'local-folder-unsupported',
      kind: 'warning',
      message: 'Local folder access is not supported in this browser.',
    })
    return false
  }

  if (isLocalMarkdownFolderWriteSupported()) {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts?: unknown) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
        mode: 'readwrite',
      })
      store.setLocalMarkdownFolderHandle(handle)
      await syncLocalMarkdownFolderToSourceFiles({ rootHandle: handle })
      store.pushUiToast({
        id: 'local-folder-opened',
        kind: 'success',
        message: `Opened folder: ${String(handle.name || '').trim() || 'Local folder'}`,
      })
      return true
    } catch {
      return false
    }
  }

  try {
    const picked = await openLocalFolderViaFileInput()
    if (!picked) return false
    if (isOpfsSupported()) {
      try {
        const opfsProject = await createUniqueOpfsProjectDirectory(picked.folderName || 'local-folder')
        for (const [path, file] of picked.filesByPath.entries()) {
          const parentPath = String(path || '').split('/').slice(0, -1).join('/')
          const fileName = String(path || '').split('/').slice(-1)[0] || ''
          if (!fileName) continue
          const parent = await getDirHandleByPath(opfsProject, parentPath, { create: true })
          const handle = await parent.getFileHandle(fileName, { create: true })
          const writable = await handle.createWritable()
          await writable.write(await file.text())
          await writable.close()
        }
        store.setLocalMarkdownFolderHandle(opfsProject, { accessMode: 'opfs' })
        await syncLocalMarkdownFolderToSourceFiles({ rootHandle: opfsProject })
        store.pushUiToast({
          id: 'local-folder-opened-opfs',
          kind: 'success',
          message: `Opened folder (writable copy): ${picked.folderName || 'Local folder'}`,
        })
        return true
      } catch {
        void 0
      }
    }

    const inputEntries: Array<{ path: string; text: string }> = []
    for (const [path, file] of picked.filesByPath.entries()) {
      const logicalPath = toLogicalPath(path)
      if (!logicalPath) continue
      if (!isMarkdownLikeFileName(logicalPath)) continue
      inputEntries.push({ path: logicalPath, text: await file.text() })
    }
    const cached = await cacheMarkdownFolderFromFileInput({
      folderName: picked.folderName,
      entries: inputEntries,
    })
    store.setLocalMarkdownFolderCacheId(cached.folderId, picked.folderName)
    await syncLocalMarkdownFolderToSourceFiles()
    store.pushUiToast({
      id: 'local-folder-opened-readonly',
      kind: 'warning',
      message: `Opened folder (read-only): ${picked.folderName || 'Local folder'}`,
    })
    return true
  } catch {
    return false
  }
}

export const readLocalMarkdownFileText = async (relativePath: string): Promise<string> => {
  const store = useGraphStore.getState()
  const root = store.localMarkdownFolderHandle
  if (root) {
    const fileHandle = await getFileHandleByPath(root, relativePath)
    const file = await fileHandle.getFile()
    return file.text()
  }

  const cacheId = String(store.localMarkdownFolderCacheId || '').trim() || (await getMostRecentCachedMarkdownFolderId())
  if (!cacheId) throw new Error('No local folder opened')
  const key = toLogicalPath(relativePath)
  const cached = await readCachedMarkdownText(cacheId, key)
  if (cached == null) throw new Error('Missing file in selected folder')
  return cached
}

export const writeLocalMarkdownFileText = async (relativePath: string, text: string): Promise<void> => {
  const store = useGraphStore.getState()
  const root = store.localMarkdownFolderHandle
  if (!root) throw new Error('Local folder is read-only in this browser')
  const fileHandle = await getFileHandleByPath(root, relativePath, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(text)
  await writable.close()
}

export const deleteLocalMarkdownEntry = async (relativePath: string): Promise<void> => {
  const store = useGraphStore.getState()
  const root = store.localMarkdownFolderHandle
  if (!root) throw new Error('Local folder is read-only in this browser')
  const path = toLogicalPath(relativePath)
  const parts = path.split('/').filter(Boolean)
  const name = parts.pop()
  if (!name) throw new Error('Missing entry name')
  const parent = await getDirHandleByPath(root, parts.join('/'))
  await parent.removeEntry(name)
  await syncLocalMarkdownFolderToSourceFiles({ rootHandle: root })
}

export const createLocalMarkdownFolder = async (args?: { parentPath?: string | null; baseName?: string }): Promise<string | null> => {
  const store = useGraphStore.getState()
  const root = store.localMarkdownFolderHandle
  if (!root) {
    store.pushUiToast({ id: 'local-folder-readonly', kind: 'warning', message: 'Local folder is read-only in this browser.' })
    return null
  }
  const parentPath = normalizeParentPath(args?.parentPath ?? null)
  const parent = await getDirHandleByPath(root, parentPath)

  const base = String(args?.baseName || 'folder').trim() || 'folder'
  let n = 1
  let candidate = `${base}-${n}`
  const existingNames = new Set<string>()
  for await (const [name] of iterDirectoryEntries(parent)) existingNames.add(String(name || '').toLowerCase())
  while (existingNames.has(candidate.toLowerCase())) {
    n += 1
    candidate = `${base}-${n}`
  }
  await parent.getDirectoryHandle(candidate, { create: true })
  await syncLocalMarkdownFolderToSourceFiles({ rootHandle: root })
  return parentPath ? `${parentPath}/${candidate}` : candidate
}

export const createLocalMarkdownFile = async (args?: { parentPath?: string | null }): Promise<string | null> => {
  const store = useGraphStore.getState()
  const root = store.localMarkdownFolderHandle
  if (!root) {
    store.pushUiToast({ id: 'local-folder-readonly', kind: 'warning', message: 'Local folder is read-only in this browser.' })
    return null
  }

  const parentPath = normalizeParentPath(args?.parentPath ?? null)
  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const nextIndex = findNextSourceFileIndex(existing.map(f => String(f.name || '')), parentPath)
  const baseName = `source-${nextIndex}.md`
  const name = parentPath ? `${parentPath}/${baseName}` : baseName

  await getFileHandleByPath(root, name, { create: true })
  await writeLocalMarkdownFileText(name, '')
  await syncLocalMarkdownFolderToSourceFiles({ rootHandle: root })
  return name
}

export const createLocalMarkdownFileFromText = async (args: {
  parentPath?: string | null
  text: string
}): Promise<string | null> => {
  const store = useGraphStore.getState()
  const root = store.localMarkdownFolderHandle
  if (!root) {
    store.pushUiToast({ id: 'local-folder-readonly', kind: 'warning', message: 'Local folder is read-only in this browser.' })
    return null
  }
  const parentPath = normalizeParentPath(args.parentPath ?? null)
  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const nextIndex = findNextSourceFileIndex(existing.map(f => String(f.name || '')), parentPath)
  const baseName = `source-${nextIndex}.md`
  const name = parentPath ? `${parentPath}/${baseName}` : baseName
  const fileHandle = await getFileHandleByPath(root, name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(String(args.text || ''))
  await writable.close()
  await syncLocalMarkdownFolderToSourceFiles({ rootHandle: root })
  return name
}
