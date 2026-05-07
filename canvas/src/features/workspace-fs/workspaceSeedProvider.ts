import { readEnvString } from '@/lib/config.env'
import { buildCodebaseFilePath, buildLocalFsFetchPath } from '@/lib/url'

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

const buildWorkspaceSeedAbsolutePath = (basename: string): string | null => {
  const root = readWorkspaceInitializationDocsAbsRoot()
  const file = normalizeBasename(basename)
  if (!root || !file) return null
  return `${root}/${file}`
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

export async function readWorkspaceInitializationSeedText(args: {
  basename: string
  relPathCandidates: ReadonlyArray<string>
}): Promise<string | null> {
  const basename = normalizeBasename(args.basename)
  if (!basename) return null

  const absolutePath = buildWorkspaceSeedAbsolutePath(basename)
  if (absolutePath) {
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

export async function upsertWorkspaceInitializationSeedText(args: {
  basename: string
  text: string
}): Promise<boolean> {
  const absolutePath = buildWorkspaceSeedAbsolutePath(args.basename)
  if (!absolutePath || typeof window !== 'undefined') return false
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
  const absolutePath = buildWorkspaceSeedAbsolutePath(args.basename)
  if (!absolutePath || typeof window !== 'undefined') return false
  try {
    const fs = (await import('node:fs/promises')) as typeof import('node:fs/promises')
    await fs.unlink(absolutePath)
    return true
  } catch {
    return false
  }
}
