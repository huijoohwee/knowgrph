import React from 'react'
import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { runWorkspaceFsChangedBatch, suppressNextWorkspaceFsChangedEvent } from '@/features/workspace-fs/workspaceFsEvents'
import { useGraphStore } from '@/hooks/useGraphStore'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { mapLimit } from '@/lib/async/mapLimit'
import { safeWebsitePathSegment } from '@/lib/websites/websitePathUtils'
import { fetchWebsiteImportArtifact } from '@/lib/websites/webpageIframeSrcdoc'
import { convertWebpageHtmlToMarkdownArtifactAsync } from '@/lib/websites/webpageHtmlToMarkdownArtifact'
import { buildWebsiteSitemapMarkdown } from '@/lib/websites/websiteSitemapMarkdown'
import { bulkSetWorkspaceEntrySources } from '@/features/workspace-fs/sourceIndex'
import { buildWebpageWorkspaceEntryTextFromUpstreamMarkdown } from '../workspaceImport'
import type { WorkspaceWebsiteImportCtx } from './types'

type WebsiteImportSettings = {
  outputDirRel: string
  discoverSitemap: boolean
  maxPages: number
  concurrency: number
  includeImages: boolean
  defaultView: unknown
  generateArtifactDocs: boolean
}

type WebsiteImportManifestNode = Record<string, unknown>

type WebsiteImportManifest = {
  rootUrl: string
  nodes: WebsiteImportManifestNode[]
}

type WebsiteImportCreated = {
  createdPaths: WorkspacePath[]
  sources: Array<{ path: WorkspacePath; source: { kind: 'url'; url: string; path: string } }>
}

function isWebsiteImportJobCurrent(importJobRef: React.MutableRefObject<number>, jobId: number): boolean {
  return importJobRef.current === jobId
}

function resolveWebsiteImportSettings(): WebsiteImportSettings {
  const store = useGraphStore.getState()
  return {
    outputDirRel: String(store.websiteImportOutputDirRel || '').trim(),
    discoverSitemap: store.websiteImportDiscoverSitemap !== false,
    maxPages: Number.isFinite(store.websiteImportMaxPages) ? Number(store.websiteImportMaxPages) : 50,
    concurrency: Number.isFinite(store.websiteImportConcurrency) ? Number(store.websiteImportConcurrency) : 4,
    includeImages: store.webpageImportIncludeImages ?? true,
    defaultView: store.webpageImportView,
    generateArtifactDocs: store.websiteImportGenerateWebpageArtifactDocs !== false,
  }
}

async function fetchWebsiteImportJson<T>(args: {
  url: string
  init?: RequestInit
}): Promise<{ response: Response; json: T }> {
  const response = await fetch(args.url, args.init)
  const json = (await response.json()) as T
  return { response, json }
}

async function runWebsiteImportServerJob(args: {
  url: string
  settings: WebsiteImportSettings
  importJobRef: React.MutableRefObject<number>
  jobId: number
  status: ReturnType<typeof import('./core').useWorkspaceStatusHelpers>
}): Promise<{ importId: string; manifest: WebsiteImportManifest }> {
  const { url, settings, importJobRef, jobId, status } = args
  const { response: startRes, json: startJson } = await fetchWebsiteImportJson<{ ok?: unknown; importId?: unknown; error?: unknown }>({
    url: `/__website_import/start?outputDirRel=${encodeURIComponent(settings.outputDirRel)}`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        url,
        options: {
          discoverSitemap: settings.discoverSitemap,
          maxPages: settings.maxPages,
          concurrency: settings.concurrency,
          includeImages: settings.includeImages,
          generateMarkdownArtifacts: settings.generateArtifactDocs,
        },
      }),
    },
  })
  if (!isWebsiteImportJobCurrent(importJobRef, jobId)) throw new Error('cancelled')
  if (!startRes.ok || startJson.ok !== true || typeof startJson.importId !== 'string') {
    const err = typeof startJson.error === 'string' && startJson.error.trim() ? startJson.error.trim() : `HTTP ${startRes.status}`
    throw new Error(err)
  }
  const importId = startJson.importId

  const startedAtMs = Date.now()
  let lastProcessed = -1
  let waitMs = 650
  while (true) {
    if (!isWebsiteImportJobCurrent(importJobRef, jobId)) throw new Error('cancelled')
    const { json: statusJson } = await fetchWebsiteImportJson<{
      ok?: unknown
      status?: unknown
      progress?:
        | {
            stage?: unknown
            total?: unknown
            processed?: unknown
          }
        | null
    }>({
      url: `/__website_import/status?outputDirRel=${encodeURIComponent(settings.outputDirRel)}&importId=${encodeURIComponent(importId)}`,
      init: { headers: { Accept: 'application/json' } },
    })
    const state = typeof statusJson.status === 'string' ? statusJson.status : ''
    if (state === 'done') break
    if (state === 'failed') throw new Error('Import failed')
    if (Date.now() - startedAtMs > 10 * 60_000) throw new Error('Import failed')

    const progress = statusJson.progress
    const total = progress && typeof progress.total === 'number' && Number.isFinite(progress.total) ? progress.total : null
    const processed = progress && typeof progress.processed === 'number' && Number.isFinite(progress.processed) ? progress.processed : null
    const stage = progress && typeof progress.stage === 'string' ? progress.stage : ''
    const label = stage === 'discovering' ? 'Discovering' : stage === 'crawling' ? 'Crawling' : stage === 'converting' ? 'Importing' : 'Importing website'
    if (typeof processed === 'number' && typeof total === 'number' && total > 0) {
      status.setStatusProgress(label, Math.min(total, Math.max(0, processed)), total)
      if (processed === lastProcessed) waitMs = Math.min(1800, waitMs + 150)
      else {
        waitMs = 650
        lastProcessed = processed
      }
    } else {
      status.setStatusProgress(label)
      waitMs = Math.min(1800, waitMs + 150)
    }
    await new Promise<void>(resolve => setTimeout(resolve, waitMs))
  }

  const { response: manifestRes, json: manifestJson } = await fetchWebsiteImportJson<{
    ok?: unknown
    manifest?: unknown
    error?: unknown
  }>({
    url: `/__website_import/manifest?outputDirRel=${encodeURIComponent(settings.outputDirRel)}&importId=${encodeURIComponent(importId)}`,
    init: { headers: { Accept: 'application/json' } },
  })
  if (!isWebsiteImportJobCurrent(importJobRef, jobId)) throw new Error('cancelled')
  if (!manifestRes.ok || manifestJson.ok !== true || !manifestJson.manifest || typeof manifestJson.manifest !== 'object') {
    const err = typeof manifestJson.error === 'string' && manifestJson.error.trim() ? manifestJson.error.trim() : `HTTP ${manifestRes.status}`
    throw new Error(err)
  }
  const manifestRaw = manifestJson.manifest as { rootUrl?: unknown; nodes?: unknown }
  return {
    importId,
    manifest: {
      rootUrl: typeof manifestRaw.rootUrl === 'string' ? manifestRaw.rootUrl : url,
      nodes: Array.isArray(manifestRaw.nodes) ? (manifestRaw.nodes as WebsiteImportManifestNode[]) : [],
    },
  }
}

function resolveWebsiteImportHost(rootUrl: string): string {
  try {
    return new URL(rootUrl).host
  } catch {
    const normalized = String(rootUrl || '').replace(/\\/g, '/').replace(/\/+$/, '')
    const last = normalized.split('/').filter(Boolean).pop() || ''
    return last || 'website'
  }
}

function resolveWebsiteImportLocalSiteRootRel(url: string): string {
  if (/^https?:\/\//i.test(url)) return ''
  const normalized = url.replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\.+\//, '').replace(/^\/+/, '')
  if (!normalized || normalized.includes('..')) return ''
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return ''
  const leaf = parts[parts.length - 1] || ''
  if (/\.(xml|html|htm)$/i.test(leaf) && parts.length > 1) return parts.slice(0, -1).join('/')
  return normalized
}

function coerceWebsiteImportWebpageView(raw: unknown): 'markdown' | 'json' | 'html' {
  return raw === 'html' ? 'html' : raw === 'json' ? 'json' : 'markdown'
}

async function ensureWebsiteFolderPath(fs: WorkspaceFs, absPath: string): Promise<WorkspacePath> {
  const normalized = normalizeWorkspacePath(absPath)
  const segments = normalized.split('/').filter(Boolean)
  let parent = WORKSPACE_ROOT_PATH
  for (const seg of segments) {
    const name = safeWebsitePathSegment(seg)
    const nextPath = normalizeWorkspacePath(`${parent}/${name}`)
    try {
      await fs.createFolder({ parentPath: parent, name })
    } catch {
      void 0
    }
    parent = nextPath
  }
  return parent
}

async function materializeWebsiteImportWorkspace(args: {
  fs: WorkspaceFs
  url: string
  importId: string
  manifest: WebsiteImportManifest
  settings: WebsiteImportSettings
  importJobRef: React.MutableRefObject<number>
  jobId: number
  status: ReturnType<typeof import('./core').useWorkspaceStatusHelpers>
}): Promise<{ created: WebsiteImportCreated; host: string }> {
  const { fs, url, importId, manifest, settings, importJobRef, jobId, status } = args
  const rootUrl = manifest.rootUrl
  const nodes = manifest.nodes
  const host = resolveWebsiteImportHost(rootUrl)
  const localSiteRootRel = resolveWebsiteImportLocalSiteRootRel(url)
  const view = coerceWebsiteImportWebpageView(settings.defaultView)
  const generateArtifactDocs = settings.generateArtifactDocs

  const stubForNode = (nodeUrl: string, nodeId: string) => {
    const lines = [
      '---',
      `kgWebpageUrl: "${nodeUrl}"`,
      `kgWebpageView: "${view}"`,
      !/^https?:\/\//i.test(nodeUrl) && localSiteRootRel ? `kgWebpageSiteRootRel: "${localSiteRootRel}"` : null,
      `kgWebsiteImportId: "${importId}"`,
      `kgWebsiteNodeId: "${nodeId}"`,
    ]
    if (settings.outputDirRel) lines.push(`kgWebsiteOutputDirRel: "${settings.outputDirRel}"`)
    lines.push('---', '')
    return lines.filter(Boolean).join('\n')
  }

  const created = await runWorkspaceFsChangedBatch(async () => {
    suppressNextWorkspaceFsChangedEvent()
    const rootFolder = await ensureWebsiteFolderPath(fs, `/websites/${safeWebsitePathSegment(host)}/${safeWebsitePathSegment(importId)}`)
    const createdPaths: WorkspacePath[] = []
    const sources: WebsiteImportCreated['sources'] = []
    const docLinkByNodeId: Record<string, string> = {}
    const ctrl = new AbortController()
    const nodeRows = nodes
      .map(n => {
        const node = n || {}
        const nodeUrl = typeof node.url === 'string' ? node.url : ''
        const nodeId = typeof node.nodeId === 'string' ? node.nodeId : hashStringToHex(nodeUrl).slice(0, 16)
        const nodeTreePath = typeof node.path === 'string' ? node.path : ''
        const nodeStatus = typeof node.status === 'string' ? node.status : 'ok'
        if (!nodeUrl || nodeStatus !== 'ok') return null
        const row = { nodeUrl, nodeId, nodeTreePath } as { nodeUrl: string; nodeId: string; nodeTreePath: string; nodeTitle?: string }
        const title = typeof node.title === 'string' ? node.title : ''
        if (title) row.nodeTitle = title
        return row
      })
      .filter((v): v is { nodeUrl: string; nodeId: string; nodeTreePath: string; nodeTitle?: string } => !!v)

    const folderCache = new Map<string, WorkspacePath>()
    folderCache.set(rootFolder, rootFolder)
    const ensureFolderCached = async (absPath: string) => {
      const normalized = normalizeWorkspacePath(absPath)
      const cached = folderCache.get(normalized)
      if (cached) return cached
      const createdFolder = await ensureWebsiteFolderPath(fs, normalized)
      folderCache.set(normalized, createdFolder)
      folderCache.set(normalizeWorkspacePath(createdFolder), createdFolder)
      return createdFolder
    }

    const totalWrites = nodeRows.length
    let lastUiAtMs = 0
    const writeConcurrency = generateArtifactDocs ? Math.max(1, Math.min(2, settings.concurrency)) : Math.max(1, Math.min(6, settings.concurrency))

    await mapLimit(
      nodeRows,
      writeConcurrency,
      async row => {
        if (!isWebsiteImportJobCurrent(importJobRef, jobId)) throw new Error('cancelled')
        const nodePath = (() => {
          try {
            const raw = row.nodeTreePath && row.nodeTreePath.trim() ? row.nodeTreePath : new URL(row.nodeUrl).pathname
            const parts = String(raw || '').split('/').filter(Boolean)
            return parts.map(safeWebsitePathSegment)
          } catch {
            return []
          }
        })()
        const leaf = nodePath[nodePath.length - 1] || 'index'
        const folderParts = nodePath.slice(0, Math.max(0, nodePath.length - 1))
        const folderPath = folderParts.length ? await ensureFolderCached(`${rootFolder}/${folderParts.join('/')}`) : rootFolder
        const nameBase = (leaf || 'index').replace(/\.md$/i, '')
        const primaryName = `${nameBase}.md`

        const text = await (async () => {
          if (!generateArtifactDocs) return stubForNode(row.nodeUrl, row.nodeId)
          try {
            const serverMarkdown = await (async () => {
              try {
                const markdown = await fetchWebsiteImportArtifact({
                  importId,
                  nodeId: row.nodeId,
                  outputDirRel: settings.outputDirRel || undefined,
                  kind: 'markdown',
                  signal: ctrl.signal,
                })
                if (markdown && markdown.trim()) return markdown
              } catch {
                void 0
              }
              return ''
            })()

            if (serverMarkdown) {
              return buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
                upstreamMarkdown: serverMarkdown,
                url: row.nodeUrl,
                view,
                title: row.nodeTitle,
                websiteImportMeta: { importId, nodeId: row.nodeId, outputDirRel: settings.outputDirRel || undefined },
              })
            }

            const rawHtml = await fetchWebsiteImportArtifact({
              importId,
              nodeId: row.nodeId,
              outputDirRel: settings.outputDirRel || undefined,
              kind: 'rawHtml',
              signal: ctrl.signal,
            })
            const boundedHtml = rawHtml.length > 5_000_000 ? rawHtml.slice(0, 5_000_000) : rawHtml
            const markdown = await convertWebpageHtmlToMarkdownArtifactAsync({ html: boundedHtml, url: row.nodeUrl, includeImages: true, fidelityLevel: 4 })
            return buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
              upstreamMarkdown: markdown,
              url: row.nodeUrl,
              view,
              title: row.nodeTitle,
              websiteImportMeta: { importId, nodeId: row.nodeId, outputDirRel: settings.outputDirRel || undefined },
            })
          } catch {
            return stubForNode(row.nodeUrl, row.nodeId)
          }
        })()

        const tryCreate = async (name: string) => {
          const createdPath = await fs.createFile({ parentPath: folderPath, name, text })
          createdPaths.push(createdPath)
          sources.push({ path: createdPath, source: { kind: 'url', url: row.nodeUrl, path: `workspace:${createdPath}` } })
          try {
            const normalizedRoot = normalizeWorkspacePath(rootFolder)
            const normalizedCreated = normalizeWorkspacePath(createdPath)
            const rel = normalizedCreated.startsWith(normalizedRoot + '/')
              ? normalizedCreated.slice(normalizedRoot.length + 1)
              : normalizedCreated.replace(/^\/+/, '')
            if (rel) docLinkByNodeId[row.nodeId] = `./${rel}`
          } catch {
            void 0
          }
          return createdPath
        }

        try {
          await tryCreate(primaryName)
        } catch {
          const alt = `${nameBase}-${hashStringToHex(row.nodeUrl).slice(0, 6)}.md`
          try {
            await tryCreate(alt)
          } catch {
            void 0
          }
        }
      },
      {
        signal: ctrl.signal,
        yieldEvery: generateArtifactDocs ? 1 : 12,
        onProgress: ({ done, total }) => {
          const now = Date.now()
          if (now - lastUiAtMs < 150 && done !== total) return
          lastUiAtMs = now
          status.setStatusProgress('Writing', done, total)
        },
      },
    )

    try {
      const sitemapText = buildWebsiteSitemapMarkdown({
        rootUrl,
        importId,
        outputDirRel: settings.outputDirRel || undefined,
        docLinkByNodeId,
        nodes: nodes
          .map(node => {
            const nodeUrl = typeof node.url === 'string' ? node.url : ''
            const nodeId = typeof node.nodeId === 'string' ? node.nodeId : ''
            const nodeTreePath = typeof node.path === 'string' ? node.path : ''
            const title = typeof node.title === 'string' ? node.title : null
            return { nodeId, url: nodeUrl, path: nodeTreePath, title }
          })
          .filter(n => n.url),
      })
      const sitemapPath = await fs.createFile({ parentPath: rootFolder, name: 'website.sitemap.md', text: sitemapText })
      createdPaths.unshift(sitemapPath)
      sources.unshift({ path: sitemapPath, source: { kind: 'url', url: rootUrl, path: `workspace:${sitemapPath}` } })
    } catch {
      void 0
    }

    status.setStatusProgress('Writing', totalWrites, totalWrites)
    return { createdPaths, sources }
  })

  return { created, host }
}

export function useWorkspaceWebsiteImportAction(args: {
  core: {
    importJobRef: React.MutableRefObject<number>
    status: ReturnType<typeof import('./core').useWorkspaceStatusHelpers>
    focusAfterImport: (createdPath: WorkspacePath, opts?: { sourceUrl?: string | null; applyToGraph?: boolean; jobId?: number }) => Promise<void>
  }
  ctx: WorkspaceWebsiteImportCtx
}) {
  const { importJobRef, status, focusAfterImport } = args.core
  const { getFs, refresh } = args.ctx

  const handleImportWebsite = React.useCallback(
    async (urlRaw: string) => {
      const url = String(urlRaw || '').trim()
      if (!url) return
      const jobId = (importJobRef.current += 1)
      status.setStatusProgress('Importing website')
      try {
        const settings = resolveWebsiteImportSettings()
        const { importId, manifest } = await runWebsiteImportServerJob({
          url,
          settings,
          importJobRef,
          jobId,
          status,
        })
        if (!isWebsiteImportJobCurrent(importJobRef, jobId)) return
        const fs = await getFs()
        await fs.ensureSeed()
        const { created, host } = await materializeWebsiteImportWorkspace({
          fs,
          url,
          importId,
          manifest,
          settings,
          importJobRef,
          jobId,
          status,
        })

        if (!isWebsiteImportJobCurrent(importJobRef, jobId)) return
        bulkSetWorkspaceEntrySources(created.sources)
        await refresh()
        const first = created.createdPaths[0]
        if (first) {
          await focusAfterImport(first, { sourceUrl: null, applyToGraph: false, jobId })
        }
        status.setStatusInfo(`Imported website: ${host}`)
      } catch (e) {
        if (!isWebsiteImportJobCurrent(importJobRef, jobId)) return
        const msg = String((e as { message?: unknown })?.message ?? e)
        if (/cancelled/i.test(msg)) return
        status.setStatusError(`Import failed: ${msg}`)
      }
    },
    [focusAfterImport, getFs, importJobRef, refresh, status],
  )

  return { handleImportWebsite }
}
