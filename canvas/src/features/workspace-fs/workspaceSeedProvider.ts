import { readEnvString } from '@/lib/config.env'
import { buildCodebaseFilePath, buildLocalFsFetchPath } from '@/lib/url'

const KG_FS_WRITE_PATH = '/__kg_fs_write'
const KG_FS_LIST_PATH = '/__kg_fs_list'
const WORKSPACE_DOCS_MIRROR_MAX_FILES = 500
const WORKSPACE_DOCS_MIRROR_MAX_FILE_BYTES = 500 * 1024

const normalizeRelPath = (value: string): string => {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

const normalizeBasename = (value: string): string => {
  const normalized = normalizeRelPath(value)
  if (!normalized) return ''
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return ''
  return parts[parts.length - 1] || ''
}

const normalizeAbsRoot = (value: string): string => {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
}

const readWorkspaceInitializationDocsAbsRoot = (): string => {
  return normalizeAbsRoot(readEnvString('VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT', ''))
}

const buildWorkspaceSeedAbsolutePathCandidates = (args: {
  basename: string
  relPathCandidates: ReadonlyArray<string>
}): string[] => {
  const root = readWorkspaceInitializationDocsAbsRoot()
  if (!root) return []
  const basename = normalizeBasename(args.basename)
  const relPathCandidates = Array.from(
    new Set((args.relPathCandidates || []).map(path => normalizeRelPath(path)).filter(Boolean)),
  )
  const out = new Set<string>()
  if (basename) out.add(`${root}/${basename}`)
  for (let i = 0; i < relPathCandidates.length; i += 1) {
    const relPath = relPathCandidates[i]!
    out.add(`${root}/${relPath}`)
    if (relPath.startsWith('docs/')) {
      out.add(`${root}/${relPath.slice('docs/'.length)}`)
    }
  }
  return [...out]
}

const readTextViaFetch = async (url: string): Promise<string | null> => {
  if (typeof fetch !== 'function') return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const text = (await res.text()).trim()
    return text || null
  } catch {
    return null
  }
}

const readTextViaNodeFs = async (absolutePath: string): Promise<string | null> => {
  if (typeof window !== 'undefined') return null
  try {
    const fs = (await import('node:fs/promises')) as typeof import('node:fs/promises')
    const text = String(await fs.readFile(absolutePath, 'utf8')).trim()
    return text || null
  } catch {
    return null
  }
}

const writeTextViaLocalFsProxy = async (absolutePath: string, text: string): Promise<boolean> => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return false
  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      try {
        controller.abort()
      } catch {
        void 0
      }
    }, 5000)
    try {
      const response = await fetch(KG_FS_WRITE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: absolutePath,
          text: String(text ?? ''),
        }),
        signal: controller.signal,
      })
      return response.ok
    } finally {
      window.clearTimeout(timeoutId)
    }
  } catch {
    return false
  }
}

export async function readWorkspaceInitializationSeedText(args: {
  basename: string
  relPathCandidates: ReadonlyArray<string>
}): Promise<string | null> {
  const basename = normalizeBasename(args.basename)
  if (!basename) return null

  const absolutePathCandidates = buildWorkspaceSeedAbsolutePathCandidates({
    basename,
    relPathCandidates: args.relPathCandidates,
  })
  for (let i = 0; i < absolutePathCandidates.length; i += 1) {
    const absolutePath = absolutePathCandidates[i]!
    const absoluteViaFetch = buildLocalFsFetchPath(absolutePath)
    if (absoluteViaFetch) {
      const text = await readTextViaFetch(absoluteViaFetch)
      if (text) return text
    }
    const text = await readTextViaNodeFs(absolutePath)
    if (text) return text
  }

  const relCandidates = Array.from(
    new Set((args.relPathCandidates || []).map(path => normalizeRelPath(path)).filter(Boolean)),
  )
  for (let i = 0; i < relCandidates.length; i += 1) {
    const text = await readTextViaFetch(buildCodebaseFilePath(relCandidates[i]!))
    if (text) return text
  }
  return null
}

const normalizeMirrorRelPath = (value: string): string => {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

export type WorkspaceDocsMirrorEntry = {
  relPath: string
  text: string
  updatedAtMs: number
}

const readWorkspaceDocsMirrorEntriesViaProxy = async (
  docsAbsRoot: string,
): Promise<WorkspaceDocsMirrorEntry[]> => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return []
  try {
    const response = await fetch(KG_FS_LIST_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: docsAbsRoot,
        maxFiles: WORKSPACE_DOCS_MIRROR_MAX_FILES,
      }),
    })
    if (!response.ok) return []
    const json = (await response.json()) as {
      ok?: boolean
      files?: Array<{ relPath?: unknown; text?: unknown; updatedAtMs?: unknown }>
    }
    if (json.ok !== true || !Array.isArray(json.files)) return []
    const out: WorkspaceDocsMirrorEntry[] = []
    for (let i = 0; i < json.files.length; i += 1) {
      const item = json.files[i]
      const relPath = normalizeMirrorRelPath(String(item?.relPath || ''))
      if (!relPath) continue
      const text = typeof item?.text === 'string' ? item.text : ''
      if (!text.trim()) continue
      out.push({
        relPath,
        text,
        updatedAtMs: Number.isFinite(Number(item?.updatedAtMs)) ? Math.floor(Number(item?.updatedAtMs)) : Date.now(),
      })
    }
    return out
  } catch {
    return []
  }
}

const readWorkspaceDocsMirrorEntriesViaNodeFs = async (
  docsAbsRoot: string,
): Promise<WorkspaceDocsMirrorEntry[]> => {
  if (typeof window !== 'undefined') return []
  try {
    const fs = (await import('node:fs/promises')) as typeof import('node:fs/promises')
    const path = (await import('node:path')) as typeof import('node:path')
    const root = normalizeAbsRoot(docsAbsRoot)
    if (!root) return []
    const out: WorkspaceDocsMirrorEntry[] = []
    const queue = [root]
    const extSet = new Set(['.md', '.markdown', '.mdx', '.mmd'])
    while (queue.length > 0 && out.length < WORKSPACE_DOCS_MIRROR_MAX_FILES) {
      const dir = queue.shift()
      if (!dir) continue
      let entries: Array<import('node:fs').Dirent> = []
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        continue
      }
      entries.sort((a, b) => a.name.localeCompare(b.name))
      for (let i = 0; i < entries.length; i += 1) {
        if (out.length >= WORKSPACE_DOCS_MIRROR_MAX_FILES) break
        const entry = entries[i]
        if (!entry) continue
        const absPath = path.resolve(dir, entry.name)
        if (entry.isDirectory()) {
          queue.push(absPath)
          continue
        }
        if (!entry.isFile()) continue
        const ext = String(path.extname(entry.name) || '').toLowerCase()
        if (!extSet.has(ext)) continue
        try {
          const stat = await fs.stat(absPath)
          if (!stat.isFile() || stat.size > WORKSPACE_DOCS_MIRROR_MAX_FILE_BYTES) continue
          const text = String(await fs.readFile(absPath, 'utf8'))
          if (!text.trim()) continue
          const relPath = normalizeMirrorRelPath(path.relative(root, absPath))
          if (!relPath) continue
          out.push({
            relPath,
            text,
            updatedAtMs: Number.isFinite(stat.mtimeMs) ? Math.floor(stat.mtimeMs) : Date.now(),
          })
        } catch {
          void 0
        }
      }
    }
    return out
  } catch {
    return []
  }
}

export async function readWorkspaceInitializationDocsMirrorEntries(): Promise<WorkspaceDocsMirrorEntry[]> {
  const docsAbsRoot = readWorkspaceInitializationDocsAbsRoot()
  if (!docsAbsRoot) return []
  const viaProxy = await readWorkspaceDocsMirrorEntriesViaProxy(docsAbsRoot)
  if (viaProxy.length > 0) return viaProxy
  return readWorkspaceDocsMirrorEntriesViaNodeFs(docsAbsRoot)
}

export async function upsertWorkspaceInitializationSeedText(args: {
  basename: string
  text: string
}): Promise<boolean> {
  const absolutePath = buildWorkspaceSeedAbsolutePathCandidates({
    basename: args.basename,
    relPathCandidates: [],
  })[0] || null
  if (!absolutePath) return false
  if (typeof window !== 'undefined') {
    return writeTextViaLocalFsProxy(absolutePath, args.text)
  }
  try {
    const fs = (await import('node:fs/promises')) as typeof import('node:fs/promises')
    const path = (await import('node:path')) as typeof import('node:path')
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, String(args.text ?? ''), 'utf8')
    return true
  } catch {
    return false
  }
}

export async function deleteWorkspaceInitializationSeedText(args: {
  basename: string
}): Promise<boolean> {
  const absolutePath = buildWorkspaceSeedAbsolutePathCandidates({
    basename: args.basename,
    relPathCandidates: [],
  })[0] || null
  if (!absolutePath || typeof window !== 'undefined') return false
  try {
    const fs = (await import('node:fs/promises')) as typeof import('node:fs/promises')
    await fs.unlink(absolutePath)
    return true
  } catch {
    return false
  }
}
