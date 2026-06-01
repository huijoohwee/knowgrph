import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { describeFetchRemoteTextFailure } from '@/lib/net/fetchRemoteTextFailure'
import { SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import type { GitHubRepoMeta, GitHubRepoRef } from './githubRepoTypes'

type GitHubRefResponse = { object?: { sha?: unknown } }
type GitHubCommitResponse = { tree?: { sha?: unknown } }
type GitHubTreeEntry = { path?: unknown; type?: unknown; size?: unknown }
type GitHubTreeResponse = { tree?: unknown; truncated?: unknown }

const WORKSPACE_GITHUB_IMPORT_TEXT_EXTS = (() => {
  const exts = new Set<string>()
  for (const ext of SOURCE_FILES_FORMATS.importLocalText) exts.add(String(ext || '').toLowerCase())
  exts.add('.mdx')
  return exts
})()

const normalizeAllowedGitHubTreeExtensions = (
  allowedExtensions?: ReadonlyArray<string>,
): ReadonlySet<string> => {
  if (!allowedExtensions) return WORKSPACE_GITHUB_IMPORT_TEXT_EXTS
  const exts = new Set<string>()
  for (const ext of allowedExtensions) {
    const raw = String(ext || '').trim().toLowerCase()
    if (!raw) continue
    exts.add(raw.startsWith('.') ? raw : `.${raw}`)
  }
  return exts.size > 0 ? exts : WORKSPACE_GITHUB_IMPORT_TEXT_EXTS
}

const normalizeRepoRelPathPrefix = (raw: string): string => {
  const s = String(raw || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  return s
}

const isProbablyTextFile = (path: string, allowedExts: ReadonlySet<string>) => {
  const lower = String(path || '').toLowerCase().trim()
  const basename = lower.split('/').filter(Boolean).pop() || lower
  const dot = basename.lastIndexOf('.')
  const ext = dot > 0 ? basename.slice(dot) : basename ? `.${basename}` : ''
  if (!ext) return false
  return allowedExts.has(ext)
}

export const parseGitHubRepoUrl = (urlRaw: string): GitHubRepoRef | null => {
  try {
    const url = new URL(urlRaw)
    if (url.hostname !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    const owner = String(parts[0] || '').trim()
    const repo = String(parts[1] || '').trim()
    if (!owner || !repo) return null
    if (parts[2] === 'tree') {
      const ref = String(parts[3] || '').trim()
      if (!ref) return null
      const subdirPath = parts.slice(4).join('/')
      return { owner, repo, ref, subdirPath }
    }
    if (parts.length === 2) {
      return { owner, repo, ref: null, subdirPath: '' }
    }
    return null
  } catch {
    return null
  }
}

const fetchJson = async <T,>(url: string): Promise<T> => {
  const res = await fetchRemoteTextDetailed(url, { preferProxy: true, preflightHead: false, maxBytes: 2_000_000 })
  if (!res.ok) {
    throw new Error(describeFetchRemoteTextFailure(res as import('grph-shared/net/fetchRemoteText').FetchRemoteTextFailure))
  }
  try {
    return JSON.parse(res.text) as T
  } catch {
    throw new Error('Invalid JSON response')
  }
}

export const resolveGitHubDefaultBranch = async (args: { owner: string; repo: string }): Promise<string> => {
  const url = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`
  const json = await fetchJson<{ default_branch?: unknown }>(url)
  const branch = typeof json.default_branch === 'string' ? json.default_branch.trim() : ''
  return branch || 'main'
}

export const fetchGitHubRepoMeta = async (args: { owner: string; repo: string }): Promise<GitHubRepoMeta> => {
  const url = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`
  const json = await fetchJson<GitHubRepoMeta>(url)
  return json && typeof json === 'object' ? json : {}
}

export const buildGitHubRawFileUrl = (args: { owner: string; repo: string; ref: string; relPath: string }): string => {
  const owner = encodeURIComponent(args.owner)
  const repo = encodeURIComponent(args.repo)
  const ref = encodeURIComponent(args.ref)
  const rel = normalizeRepoRelPathPrefix(args.relPath)
    .split('/')
    .filter(Boolean)
    .map(seg => encodeURIComponent(seg))
    .join('/')
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rel}`
}

const resolveGitHubTreeSha = async (args: { owner: string; repo: string; ref: string }): Promise<string> => {
  const base = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`
  const refJson = await fetchJson<GitHubRefResponse>(`${base}/git/refs/heads/${encodeURIComponent(args.ref)}`)
  const commitSha = typeof refJson.object?.sha === 'string' ? refJson.object.sha.trim() : ''
  if (!commitSha) throw new Error('GitHub ref sha missing')
  const commitJson = await fetchJson<GitHubCommitResponse>(`${base}/git/commits/${encodeURIComponent(commitSha)}`)
  const treeSha = typeof commitJson.tree?.sha === 'string' ? commitJson.tree.sha.trim() : ''
  if (!treeSha) throw new Error('GitHub tree sha missing')
  return treeSha
}

export const listGitHubRepoTreeFiles = async (args: {
  owner: string
  repo: string
  ref: string
  subdirPath: string
  maxFiles: number
  allowedExtensions?: ReadonlyArray<string>
}): Promise<{ files: Array<{ relPath: string; rawUrl: string }>; totalEligible: number; allPaths: string[]; treeTruncated: boolean }> => {
  const base = `https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`
  const treeSha = await resolveGitHubTreeSha({ owner: args.owner, repo: args.repo, ref: args.ref })
  const treeJson = await fetchJson<GitHubTreeResponse>(`${base}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`)
  const entries = Array.isArray(treeJson.tree) ? (treeJson.tree as GitHubTreeEntry[]) : []
  const treeTruncated = treeJson.truncated === true
  const allowedExts = normalizeAllowedGitHubTreeExtensions(args.allowedExtensions)

  const prefix = normalizeRepoRelPathPrefix(args.subdirPath)
  const prefixWithSlash = prefix ? `${prefix}/` : ''
  const files: Array<{ relPath: string; rawUrl: string }> = []
  let totalEligible = 0

  const allPaths: string[] = []
  for (const e of entries) {
    const relPath = typeof e.path === 'string' ? String(e.path) : ''
    if (!relPath) continue
    if (prefix && relPath !== prefix && !relPath.startsWith(prefixWithSlash)) continue
    allPaths.push(relPath)
    if (allPaths.length >= 6_000) break
  }

  for (const e of entries) {
    const type = String(e.type || '').trim()
    if (type !== 'blob') continue
    const relPath = typeof e.path === 'string' ? String(e.path) : ''
    if (!relPath) continue
    if (prefix && relPath !== prefix && !relPath.startsWith(prefixWithSlash)) continue
    if (!isProbablyTextFile(relPath, allowedExts)) continue
    totalEligible += 1
    const rawUrl = buildGitHubRawFileUrl({ owner: args.owner, repo: args.repo, ref: args.ref, relPath })
    if (files.length < args.maxFiles) files.push({ relPath, rawUrl })
  }

  return { files, totalEligible, allPaths, treeTruncated }
}
