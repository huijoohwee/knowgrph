import React from 'react'
import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureWorkspaceFolderTreeIfMissing } from '@/features/workspace-fs/ensureFolderTreeIfMissing'
import { upsertWorkspaceTextDocument } from '@/features/workspace-fs/upsertWorkspaceTextDocument'
import { runWorkspaceFsChangedBatch, suppressNextWorkspaceFsChangedEvent } from '@/features/workspace-fs/workspaceFsEvents'
import { useGraphStore } from '@/hooks/useGraphStore'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { mapLimit } from '@/lib/async/mapLimit'
import { resolveWebsiteImportNodeRelativeDocumentPath, safeWebsitePathSegment } from '@/lib/websites/websitePathUtils'
import { fetchWebsiteImportArtifact } from '@/lib/websites/webpageIframeSrcdoc'
import { convertWebpageHtmlToMarkdownArtifactAsync } from '@/lib/websites/webpageHtmlToMarkdownArtifact'
import { convertWebpageUrlToMarkdownViaBrowser, looksLowFidelityWebpageMarkdown } from '@/lib/websites/webpageClientConvert'
import { buildWebsiteSitemapMarkdown } from '@/lib/websites/websiteSitemapMarkdown'
import { buildWebsiteCrawlCanvasMarkdown } from '@/lib/websites/websiteCrawlCanvasMarkdown'
import { buildWebsiteImportManifestSummary } from '@/lib/websites/websiteImportManifestSummary'
import type { WebsiteImportManifestV1 } from '@/lib/websites/server/websiteImportTypes'
import { bulkSetWorkspaceEntrySources } from '@/features/workspace-fs/sourceIndex'
import { buildWebpageWorkspaceEntryTextFromUpstreamMarkdown } from '../workspaceImport'
import type { WorkspaceImportWebsiteOpts, WorkspaceWebsiteImportProgress, WorkspaceWebsiteImportSummary } from '@/features/markdown-explorer/workspaceActionBridge'
export { importWebsiteViaWorkspaceRuntime, useWorkspaceWebsiteImportAction } from './websiteImportRuntimeFacade'

type WebsiteImportSettings = {
  outputDirRel: string
  discoverSitemap: boolean
  maxPages: number
  concurrency: number
  includeImages: boolean
  defaultView: unknown
  generateArtifactDocs: boolean
  browserEnhance: boolean
  headless: boolean
  proxyRotation: boolean
  downloadAssets: boolean
  applyToCanvas: boolean
  preserveActiveDocument: boolean
  maxDownloads: number
  maxDownloadBytes: number
  generationToken?: string
  onProgress?: (progress: WorkspaceWebsiteImportProgress) => void
}

type WebsiteImportManifest = WebsiteImportManifestV1

type WebsiteImportCreated = {
  createdPaths: WorkspacePath[]
  sources: Array<{ path: WorkspacePath; source: { kind: 'url'; url: string; path: string } }>
}

function isWebsiteImportJobCurrent(importJobRef: React.MutableRefObject<number>, jobId: number): boolean {
  return importJobRef.current === jobId
}

function clampWebsiteImportMaxPages(raw: number, minPages?: number): number {
  const min = Number.isFinite(minPages) ? Math.max(1, Math.min(500, Math.floor(Number(minPages)))) : 1
  const n = Number.isFinite(raw) ? Math.floor(Number(raw)) : 100
  return Math.max(min, Math.min(500, Math.max(1, n)))
}

function resolveWebsiteImportSettings(opts?: WorkspaceImportWebsiteOpts): WebsiteImportSettings {
  const store = useGraphStore.getState()
  const configuredMaxPages = Number.isFinite(store.websiteImportMaxPages) ? Number(store.websiteImportMaxPages) : 100
  const requestedMaxPages = Number.isFinite(opts?.maxPages) ? Number(opts?.maxPages) : configuredMaxPages
  return {
    outputDirRel: String(store.websiteImportOutputDirRel || '').trim(),
    discoverSitemap: store.websiteImportDiscoverSitemap !== false,
    maxPages: clampWebsiteImportMaxPages(requestedMaxPages, opts?.minPages),
    concurrency: Number.isFinite(store.websiteImportConcurrency) ? Number(store.websiteImportConcurrency) : 4,
    includeImages: store.webpageImportIncludeImages ?? true,
    defaultView: store.webpageImportView,
    generateArtifactDocs: typeof opts?.generateArtifactDocs === 'boolean'
      ? opts.generateArtifactDocs
      : store.websiteImportGenerateWebpageArtifactDocs !== false,
    browserEnhance: opts?.browserEnhance === true,
    headless: opts?.headless === true,
    proxyRotation: opts?.proxyRotation === true,
    downloadAssets: opts?.downloadAssets === true,
    applyToCanvas: opts?.applyToCanvas === true,
    preserveActiveDocument: opts?.preserveActiveDocument === true,
    maxDownloads: Number.isFinite(opts?.maxDownloads) ? Math.max(1, Math.min(500, Math.floor(Number(opts?.maxDownloads)))) : 120,
    maxDownloadBytes: Number.isFinite(opts?.maxDownloadBytes) ? Math.max(1024 * 1024, Math.min(1024 * 1024 * 1024, Math.floor(Number(opts?.maxDownloadBytes)))) : 250 * 1024 * 1024,
    generationToken: typeof opts?.generationToken === 'string' ? opts.generationToken : undefined,
    onProgress: typeof opts?.onProgress === 'function' ? opts.onProgress : undefined,
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
          browserMode: settings.headless ? 'headless' : 'http',
          proxyRotation: settings.proxyRotation,
          downloadAssets: settings.downloadAssets,
          maxDownloads: settings.maxDownloads,
          maxDownloadBytes: settings.maxDownloadBytes,
          generationToken: settings.generationToken,
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
            ok?: unknown
            error?: unknown
          }
        | null
      running?: unknown
    }>({
      url: `/__website_import/status?outputDirRel=${encodeURIComponent(settings.outputDirRel)}&importId=${encodeURIComponent(importId)}`,
      init: { headers: { Accept: 'application/json' } },
    })
    const state = typeof statusJson.status === 'string' ? statusJson.status : ''
    const progress = statusJson.progress
    const total = progress && typeof progress.total === 'number' && Number.isFinite(progress.total) ? progress.total : null
    const processed = progress && typeof progress.processed === 'number' && Number.isFinite(progress.processed) ? progress.processed : null
    const stage = progress && typeof progress.stage === 'string' ? progress.stage : ''
    settings.onProgress?.({
      stage,
      total,
      processed,
      ok: progress && typeof progress.ok === 'number' && Number.isFinite(progress.ok) ? progress.ok : null,
      error: progress && typeof progress.error === 'number' && Number.isFinite(progress.error) ? progress.error : null,
      running: statusJson.running === true,
    })
    if (state === 'done') break
    if (state === 'failed') throw new Error('Import failed')
    if (Date.now() - startedAtMs > 30 * 60_000) throw new Error('Import failed')

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
  const manifestRaw = manifestJson.manifest as WebsiteImportManifestV1
  return {
    importId,
    manifest: manifestRaw,
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

function shouldEnhanceWebsiteMarkdownViaBrowser(settings: WebsiteImportSettings, url: string, markdown: string): boolean {
  if (!settings.browserEnhance) return false
  if (!/^https?:\/\//i.test(String(url || '').trim())) return false
  const text = String(markdown || '').trim()
  return !text || text.length < 1400 || looksLowFidelityWebpageMarkdown(text)
}

async function getBrowserEnhancedWebsiteMarkdown(url: string): Promise<{ markdown: string; title: string } | null> {
  const res = await convertWebpageUrlToMarkdownViaBrowser({ url })
  if (res.ok !== true || !String(res.markdown || '').trim()) return null
  return { markdown: res.markdown.trim(), title: String(res.title || '').trim() }
}

async function ensureWebsiteFolderPath(fs: WorkspaceFs, absPath: string): Promise<WorkspacePath> {
  const normalized = normalizeWorkspacePath(absPath)
  await ensureWorkspaceFolderTreeIfMissing({ folderPath: normalized, fs })
  return normalized
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
}): Promise<{ created: WebsiteImportCreated; host: string; canvasPath: WorkspacePath | null }> {
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
        const node = n
        const nodeUrl = typeof node.url === 'string' ? node.url : ''
        const nodeId = typeof node.nodeId === 'string' ? node.nodeId : hashStringToHex(nodeUrl).slice(0, 16)
        const nodeTreePath = typeof node.path === 'string' ? node.path : ''
        const nodeStatus = typeof node.status === 'string' ? node.status : 'ok'
        if (!nodeUrl || nodeStatus !== 'ok') return null
        const artifacts = node.artifacts && typeof node.artifacts === 'object' ? (node.artifacts as Record<string, unknown>) : {}
        const artifactText = (key: string): string | undefined => {
          const text = typeof artifacts[key] === 'string' ? String(artifacts[key]).trim() : ''
          return text || undefined
        }
        const row = {
          nodeUrl,
          nodeId,
          nodeTreePath,
          websiteImportMeta: {
            importId,
            nodeId,
            outputDirRel: settings.outputDirRel || undefined,
            rawHtmlRelPath: artifactText('rawHtmlRelPath'),
            markdownRelPath: artifactText('markdownRelPath'),
            conversionJsonRelPath: artifactText('conversionJsonRelPath'),
            rawHtmlSha256: artifactText('rawHtmlSha256'),
            markdownSha256: artifactText('markdownSha256'),
            conversionJsonSha256: artifactText('conversionJsonSha256'),
          },
        } as { nodeUrl: string; nodeId: string; nodeTreePath: string; nodeTitle?: string; websiteImportMeta: NonNullable<Parameters<typeof buildWebpageWorkspaceEntryTextFromUpstreamMarkdown>[0]['websiteImportMeta']> }
        const title = typeof node.title === 'string' ? node.title : ''
        if (title) row.nodeTitle = title
        return row
      })
      .filter((v): v is { nodeUrl: string; nodeId: string; nodeTreePath: string; nodeTitle?: string; websiteImportMeta: NonNullable<Parameters<typeof buildWebpageWorkspaceEntryTextFromUpstreamMarkdown>[0]['websiteImportMeta']> } => !!v)

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
        const relativeDocumentPath = resolveWebsiteImportNodeRelativeDocumentPath({
          nodeUrl: row.nodeUrl,
          nodePath: row.nodeTreePath,
        })
        const documentParts = relativeDocumentPath.split('/').filter(Boolean)
        const primaryName = documentParts[documentParts.length - 1] || 'index.md'
        const folderParts = documentParts.slice(0, Math.max(0, documentParts.length - 1))
        const folderPath = folderParts.length ? await ensureFolderCached(`${rootFolder}/${folderParts.join('/')}`) : rootFolder
        const nameBase = primaryName.replace(/\.md$/i, '') || 'index'

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

            const browserMarkdown = shouldEnhanceWebsiteMarkdownViaBrowser(settings, row.nodeUrl, serverMarkdown)
              ? await getBrowserEnhancedWebsiteMarkdown(row.nodeUrl).catch(() => null)
              : null
            const selectedMarkdown = browserMarkdown?.markdown || serverMarkdown
            const selectedTitle = row.nodeTitle || browserMarkdown?.title

            if (selectedMarkdown) {
              return buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
                upstreamMarkdown: selectedMarkdown,
                url: row.nodeUrl,
                view,
                title: selectedTitle,
                fidelityLevel: 4,
                includeImages: true,
                preserveBodyFidelity: true,
                websiteImportMeta: row.websiteImportMeta,
              })
            }

            const rawHtml = await fetchWebsiteImportArtifact({
              importId,
              nodeId: row.nodeId,
              outputDirRel: settings.outputDirRel || undefined,
              kind: 'rawHtml',
              signal: ctrl.signal,
            })
            const markdown = await convertWebpageHtmlToMarkdownArtifactAsync({
              html: rawHtml,
              url: row.nodeUrl,
              includeImages: true,
              fidelityLevel: 4,
              includeHeadSection: true,
              includeHtmlSnapshot: true,
              mode: 'debug',
            })
            return buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
              upstreamMarkdown: markdown,
              url: row.nodeUrl,
              view,
              title: row.nodeTitle,
              fidelityLevel: 4,
              includeImages: true,
              preserveBodyFidelity: true,
              websiteImportMeta: row.websiteImportMeta,
            })
          } catch {
            return stubForNode(row.nodeUrl, row.nodeId)
          }
        })()

        const tryCreate = async (name: string) => {
          const createdPath = await upsertWorkspaceTextDocument({ fs, parentPath: folderPath, name, text })
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
      const sitemapPath = await upsertWorkspaceTextDocument({ fs, parentPath: rootFolder, name: 'website.sitemap.md', text: sitemapText })
      createdPaths.unshift(sitemapPath)
      sources.unshift({ path: sitemapPath, source: { kind: 'url', url: rootUrl, path: `workspace:${sitemapPath}` } })
    } catch {
      void 0
    }

    let canvasPath: WorkspacePath | null = null
    try {
      const canvasText = buildWebsiteCrawlCanvasMarkdown({
        rootUrl,
        importId,
        outputDirRel: settings.outputDirRel,
        runtime: manifest.runtime,
        nodes,
      })
      canvasPath = await upsertWorkspaceTextDocument({ fs, parentPath: rootFolder, name: 'website.crawl.canvas.md', text: canvasText })
      createdPaths.unshift(canvasPath)
      sources.unshift({ path: canvasPath, source: { kind: 'url', url: rootUrl, path: `workspace:${canvasPath}` } })
    } catch {
      void 0
    }

    status.setStatusProgress('Writing', totalWrites, totalWrites)
    return { createdPaths, sources, canvasPath }
  })

  return { created, host, canvasPath: created.canvasPath }
}

type WebsiteImportRuntimeStatus = {
  setStatusProgress: (label: string, current?: number | null, total?: number | null) => void
}

export async function runWorkspaceWebsiteImport(args: {
  url: string
  opts?: WorkspaceImportWebsiteOpts
  importJobRef: { current: number }
  jobId: number
  status: WebsiteImportRuntimeStatus
  getFs: () => Promise<WorkspaceFs>
  refresh?: () => Promise<{ entries: import('@/features/workspace-fs/types').WorkspaceEntry[]; sourcesByPath: import('@/features/workspace-fs/sourceIndex').WorkspaceSourceIndex }>
  focusAfterImport?: (createdPath: WorkspacePath, opts?: { sourceUrl?: string | null; applyToGraph?: boolean; jobId?: number }) => Promise<void>
}): Promise<{ createdPaths: WorkspacePath[]; host: string; websiteImportManifest: WebsiteImportManifestV1; websiteImportSummary: WorkspaceWebsiteImportSummary }> {
  const settings = resolveWebsiteImportSettings(args.opts)
  const { importId, manifest } = await runWebsiteImportServerJob({
    url: args.url,
    settings,
    importJobRef: args.importJobRef,
    jobId: args.jobId,
    status: args.status as ReturnType<typeof import('./core').useWorkspaceStatusHelpers>,
  })
  if (!isWebsiteImportJobCurrent(args.importJobRef, args.jobId)) throw new Error('cancelled')
  const fs = await args.getFs()
  await fs.ensureSeed()
  const { created, host, canvasPath } = await materializeWebsiteImportWorkspace({
    fs,
    url: args.url,
    importId,
    manifest,
    settings,
    importJobRef: args.importJobRef,
    jobId: args.jobId,
    status: args.status as ReturnType<typeof import('./core').useWorkspaceStatusHelpers>,
  })

  if (!isWebsiteImportJobCurrent(args.importJobRef, args.jobId)) throw new Error('cancelled')
  bulkSetWorkspaceEntrySources(created.sources)
  const refreshed = args.refresh ? await args.refresh() : null
  if (settings.applyToCanvas && canvasPath) {
    const { applyWorkspaceImportToCanvasBestEffort } = await import('./importRuntimeActions')
    await applyWorkspaceImportToCanvasBestEffort({
      fs,
      createdPaths: [canvasPath],
      opts: {
        applyToGraph: true,
        ...(refreshed ? { workspaceEntries: refreshed.entries, sourcesByPath: refreshed.sourcesByPath } : {}),
      },
    })
  }
  const first = settings.preserveActiveDocument ? null : (canvasPath || created.createdPaths[0])
  if (first) {
    if (args.focusAfterImport) {
      await args.focusAfterImport(first, { sourceUrl: null, applyToGraph: false, jobId: args.jobId })
    } else {
      const { activateFirstImportedWorkspaceFile } = await import('./importRuntimeActions')
      await activateFirstImportedWorkspaceFile({ fs, createdPaths: [first], applyToGraph: false })
    }
  }
  return { createdPaths: created.createdPaths, host, websiteImportManifest: manifest, websiteImportSummary: buildWebsiteImportManifestSummary(manifest) }
}
