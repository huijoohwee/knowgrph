const toLogicalPath = (raw: string): string => {
  const p = String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  const parts = p.split('/').filter(Boolean)
  if (parts.some(x => x === '..')) return ''
  return parts.join('/')
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

const ensureWritePermission = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
  const h = handle as unknown as {
    queryPermission?: (opts?: unknown) => Promise<PermissionState>
    requestPermission?: (opts?: unknown) => Promise<PermissionState>
  }
  try {
    if (typeof h.queryPermission === 'function') {
      const state = await h.queryPermission({ mode: 'readwrite' })
      if (state === 'granted') return true
    }
    if (typeof h.requestPermission === 'function') {
      const state = await h.requestPermission({ mode: 'readwrite' })
      return state === 'granted'
    }
    return true
  } catch {
    return false
  }
}

export const isDirectoryPickerWriteSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
}

export const pickDirectoryForWrite = async (): Promise<FileSystemDirectoryHandle | '' | null> => {
  try {
    if (!isDirectoryPickerWriteSupported()) return null
    const handle = await (window as unknown as { showDirectoryPicker: (opts?: unknown) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
      mode: 'readwrite',
    })
    return handle
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? (err as { name?: unknown }).name : null
    if (name === 'AbortError') return ''
    return null
  }
}

export const writeTextFileToDirectory = async (args: {
  rootHandle: FileSystemDirectoryHandle
  relativePath: string
  text: string
}): Promise<boolean> => {
  const res = await writeTextFileToDirectoryDetailed(args)
  return res.ok
}

export type WriteTextFileToDirectoryResult =
  | { ok: true }
  | { ok: false; reason: 'invalid-path' | 'permission-denied' | 'write-failed' }

export const writeTextFileToDirectoryDetailed = async (args: {
  rootHandle: FileSystemDirectoryHandle
  relativePath: string
  text: string
}): Promise<WriteTextFileToDirectoryResult> => {
  const rel = toLogicalPath(args.relativePath)
  if (!rel) return { ok: false, reason: 'invalid-path' }
  const ok = await ensureWritePermission(args.rootHandle)
  if (!ok) return { ok: false, reason: 'permission-denied' }
  try {
    const fileHandle = await getFileHandleByPath(args.rootHandle, rel, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(args.text)
    await writable.close()
    return { ok: true }
  } catch {
    return { ok: false, reason: 'write-failed' }
  }
}
