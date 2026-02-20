import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath, WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { describeFetchRemoteTextFailure } from '@/lib/net/fetchRemoteTextFailure'
import { mapLimit } from '@/lib/async/mapLimit'
import { pipelinePerfEnd, pipelinePerfStart } from '@/lib/pipelinePerf'
import type { GitHubRepoRef, WorkspaceImportProgress, WorkspaceImportResult } from './githubRepoTypes'
import { buildGitHubRawFileUrl, fetchGitHubRepoMeta, listGitHubRepoTreeFiles, resolveGitHubDefaultBranch } from './githubRepoApi'
import { buildGitHubRepoSitemapMarkdown, buildGitHubRepoUserJourneyMarkdown } from './githubRepoDocs'

export async function importGitHubFolder(args: {
  fs: WorkspaceFs
  repoRef: GitHubRepoRef
  parentPath: WorkspacePath
  onProgress?: (p: WorkspaceImportProgress) => void
  maxFiles?: number
}): Promise<WorkspaceImportResult> {
  const tAll = pipelinePerfStart()
  const maxFiles = typeof args.maxFiles === 'number' && Number.isFinite(args.maxFiles) && args.maxFiles > 0 ? Math.floor(args.maxFiles) : 60
  const parentPath = args.parentPath || WORKSPACE_ROOT_PATH
  const ref = args.repoRef.ref || (await resolveGitHubDefaultBranch({ owner: args.repoRef.owner, repo: args.repoRef.repo }))

  args.onProgress?.({ phase: 'listing', current: 0, label: 'Listing repo' })
  const tListing = pipelinePerfStart()
  const tree = await listGitHubRepoTreeFiles({
    owner: args.repoRef.owner,
    repo: args.repoRef.repo,
    ref,
    subdirPath: args.repoRef.subdirPath,
    maxFiles,
  })
  pipelinePerfEnd({ name: 'import', stage: 'github:list', t0: tListing, detail: { count: tree.files.length, maxFiles } })
  const filesToFetch = tree.files
  const repoMeta = await fetchGitHubRepoMeta({ owner: args.repoRef.owner, repo: args.repoRef.repo })

  const rootFolderName = String(args.repoRef.repo || 'repo').replace(/\.git$/i, '') || 'repo'
  const rootFolderPath = await args.fs.createFolder({ parentPath, name: rootFolderName })

  const createdPaths: WorkspacePath[] = []
  const sources: Array<{ path: WorkspacePath; source: WorkspaceEntrySource }> = []
  const failed: Array<{ name: string; error: string }> = []
  if (tree.totalEligible > maxFiles) {
    failed.push({ name: 'GitHub repo import', error: `Truncated to ${maxFiles} text files (found ${tree.totalEligible})` })
  }
  if (tree.treeTruncated === true) {
    failed.push({ name: 'GitHub repo import', error: 'GitHub tree response truncated; directory structure may be incomplete' })
  }
  const folderMap = new Map<string, WorkspacePath>()

  const allTreePaths = tree.allPaths
  const readmeUrl = buildGitHubRawFileUrl({ owner: args.repoRef.owner, repo: args.repoRef.repo, ref, relPath: 'README.md' })
  const readmeFetched = await fetchRemoteTextDetailed(readmeUrl, { preferProxy: true, preflightHead: true, maxBytes: 350_000 })
  const readmeMarkdown = readmeFetched.ok ? readmeFetched.text : ''

  const sitemapText = await buildGitHubRepoSitemapMarkdown({
    owner: args.repoRef.owner,
    repo: args.repoRef.repo,
    ref,
    repoMeta,
    allTreePaths,
    readmeMarkdown,
  })
  const sitemapPath = await args.fs.createFile({ parentPath: rootFolderPath, name: 'repo.sitemap.md', text: sitemapText })
  createdPaths.push(normalizeWorkspacePath(sitemapPath))
  sources.push({ path: normalizeWorkspacePath(sitemapPath), source: { kind: 'url', url: `https://github.com/${args.repoRef.owner}/${args.repoRef.repo}` } })

  const userJourneyText = buildGitHubRepoUserJourneyMarkdown({
    owner: args.repoRef.owner,
    repo: args.repoRef.repo,
    repoMeta,
    ref,
    allTreePaths,
    readmeMarkdown,
  })
  const userJourneyPath = await args.fs.createFile({ parentPath: rootFolderPath, name: 'repo.user-journey.md', text: userJourneyText })
  createdPaths.push(normalizeWorkspacePath(userJourneyPath))
  sources.push({ path: normalizeWorkspacePath(userJourneyPath), source: { kind: 'url', url: `https://github.com/${args.repoRef.owner}/${args.repoRef.repo}` } })

  const ensureFolder = async (parent: WorkspacePath, name: string, key: string) => {
    const existing = folderMap.get(key)
    if (existing) return existing
    const created = await args.fs.createFolder({ parentPath: parent, name })
    folderMap.set(key, created)
    return created
  }

  const totalFiles = filesToFetch.length
  const tFetch = pipelinePerfStart()
  let progressDone = 0
  const fetchedFiles = await mapLimit(
    filesToFetch,
    Math.max(2, Math.min(10, Math.ceil(totalFiles / 12))),
    async (file, index) => {
      const fetched = await fetchRemoteTextDetailed(file.rawUrl, { preflightHead: true, preferProxy: true })
      return { file, fetched, index }
    },
    {
      onProgress: ({ done }) => {
        progressDone = done
        const label = filesToFetch[done - 1]?.relPath ? `Fetching ${filesToFetch[done - 1]!.relPath}` : 'Fetching'
        args.onProgress?.({ phase: 'fetching', current: done, total: totalFiles, label })
      },
    },
  )
  pipelinePerfEnd({ name: 'import', stage: 'github:fetch', t0: tFetch, detail: { totalFiles, done: progressDone } })

  const tWrite = pipelinePerfStart()
  for (let i = 0; i < fetchedFiles.length; i += 1) {
    const item = fetchedFiles[i]
    const file = item.file
    const fetched = item.fetched
    if (!fetched.ok) {
      failed.push({
        name: file.relPath,
        error: describeFetchRemoteTextFailure(fetched as import('grph-shared/net/fetchRemoteText').FetchRemoteTextFailure),
      })
      continue
    }

    const segments = String(file.relPath || '').split('/').filter(Boolean)
    if (segments.length === 0) continue
    let parentFolder: WorkspacePath = rootFolderPath
    let relKey = ''
    for (let si = 0; si < segments.length - 1; si += 1) {
      const seg = String(segments[si] || '').trim()
      if (!seg) continue
      relKey = relKey ? `${relKey}/${seg}` : seg
      parentFolder = await ensureFolder(parentFolder, seg, relKey)
    }

    args.onProgress?.({ phase: 'writing', current: i + 1, total: totalFiles, label: `Writing ${file.relPath}` })
    try {
      const createdPath = await args.fs.createFile({ parentPath: parentFolder, name: segments[segments.length - 1] || 'file.txt', text: fetched.text })
      createdPaths.push(normalizeWorkspacePath(createdPath))
      sources.push({ path: normalizeWorkspacePath(createdPath), source: { kind: 'url', url: file.rawUrl } })
    } catch (e) {
      failed.push({ name: file.relPath, error: String((e as { message?: unknown })?.message ?? e) })
    }
  }
  pipelinePerfEnd({ name: 'import', stage: 'github:write', t0: tWrite, detail: { totalFiles } })
  pipelinePerfEnd({ name: 'import', stage: 'github:all', t0: tAll, detail: { totalFiles, failed: failed.length } })

  return { createdPaths, sources, skipped: [], failed }
}
