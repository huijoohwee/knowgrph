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
import type { UseWorkspaceFileActionsArgs } from './types'

export function useWorkspaceWebsiteImportAction(args: {
  core: {
    importJobRef: React.MutableRefObject<number>
    status: ReturnType<typeof import('./core').useWorkspaceStatusHelpers>
    focusAfterImport: (createdPath: WorkspacePath, opts?: { sourceUrl?: string | null; applyToGraph?: boolean; jobId?: number }) => Promise<void>
  }
  ctx: Pick<UseWorkspaceFileActionsArgs, 'getFs' | 'refresh'>
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
        const store = useGraphStore.getState()
        const outputDirRel = String(store.websiteImportOutputDirRel || '').trim()
        const discoverSitemap = store.websiteImportDiscoverSitemap !== false
        const maxPages = Number.isFinite(store.websiteImportMaxPages) ? Number(store.websiteImportMaxPages) : 50
        const concurrency = Number.isFinite(store.websiteImportConcurrency) ? Number(store.websiteImportConcurrency) : 4
        const includeImages = store.webpageImportIncludeImages ?? true
        const defaultView = store.webpageImportView
        const generateArtifactDocs = store.websiteImportGenerateWebpageArtifactDocs !== false

        const startRes = await fetch(`/__website_import/start?outputDirRel=${encodeURIComponent(outputDirRel)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              url,
              options: { discoverSitemap, maxPages, concurrency, includeImages, generateMarkdownArtifacts: generateArtifactDocs },
            }),
          },
        )
        const startJson = (await startRes.json()) as { ok?: unknown; importId?: unknown; error?: unknown }
        if (importJobRef.current !== jobId) return
        if (!startRes.ok || startJson.ok !== true || typeof startJson.importId !== 'string') {
          const err = typeof startJson.error === 'string' && startJson.error.trim() ? startJson.error.trim() : `HTTP ${startRes.status}`
          status.setStatusError(`Import failed: ${err}`)
          return
        }
        const importId = startJson.importId

        const pollUntilDone = async (): Promise<'done' | 'failed'> => {
          const startedAtMs = Date.now()
          let lastProcessed = -1
          let waitMs = 650
          while (true) {
            if (importJobRef.current !== jobId) throw new Error('cancelled')
            const statusRes = await fetch(`/__website_import/status?outputDirRel=${encodeURIComponent(outputDirRel)}&importId=${encodeURIComponent(importId)}`,
              { headers: { Accept: 'application/json' } },
            )
            const statusJson = (await statusRes.json()) as {
              ok?: unknown
              status?: unknown
              progress?:
                | {
                    stage?: unknown
                    total?: unknown
                    processed?: unknown
                    ok?: unknown
                    error?: unknown
                    queued?: unknown
                    lastUrl?: unknown
                    updatedAtMs?: unknown
                  }
                | null
            }
            const st = typeof statusJson.status === 'string' ? statusJson.status : ''
            if (st === 'done') return 'done'
            if (st === 'failed') return 'failed'
            if (Date.now() - startedAtMs > 10 * 60_000) return 'failed'

            const p = statusJson.progress
            const total = p && typeof p.total === 'number' && Number.isFinite(p.total) ? p.total : null
            const processed = p && typeof p.processed === 'number' && Number.isFinite(p.processed) ? p.processed : null
            const stage = p && typeof p.stage === 'string' ? p.stage : ''
            const label = stage === 'discovering' ? 'Discovering' : stage === 'crawling' ? 'Crawling' : stage === 'converting' ? 'Importing' : 'Importing website'
            if (typeof processed === 'number' && typeof total === 'number' && total > 0) {
              status.setStatusProgress(label, Math.min(total, Math.max(0, processed)), total)
              if (processed === lastProcessed) {
                waitMs = Math.min(1800, waitMs + 150)
              } else {
                waitMs = 650
                lastProcessed = processed
              }
            } else {
              status.setStatusProgress(label)
              waitMs = Math.min(1800, waitMs + 150)
            }

            await new Promise<void>(resolve => setTimeout(resolve, waitMs))
          }
        }

        const result = await pollUntilDone()
        if (importJobRef.current !== jobId) return
        if (result !== 'done') {
          status.setStatusError('Import failed')
          return
        }

        const manifestRes = await fetch(`/__website_import/manifest?outputDirRel=${encodeURIComponent(outputDirRel)}&importId=${encodeURIComponent(importId)}`,
          { headers: { Accept: 'application/json' } },
        )
        const manifestJson = (await manifestRes.json()) as { ok?: unknown; manifest?: unknown; error?: unknown }
        if (importJobRef.current !== jobId) return
        if (!manifestRes.ok || manifestJson.ok !== true || !manifestJson.manifest || typeof manifestJson.manifest !== 'object') {
          const err = typeof manifestJson.error === 'string' && manifestJson.error.trim() ? manifestJson.error.trim() : `HTTP ${manifestRes.status}`
          status.setStatusError(`Import failed: ${err}`)
          return
        }

        const manifest = manifestJson.manifest as { rootUrl?: unknown; nodes?: unknown }
        const rootUrl = typeof manifest.rootUrl === 'string' ? manifest.rootUrl : url
        const nodes = Array.isArray(manifest.nodes) ? (manifest.nodes as Array<Record<string, unknown>>) : []

        const host = (() => {
          try {
            return new URL(rootUrl).host
          } catch {
            const normalized = String(rootUrl || '').replace(/\\/g, '/').replace(/\/+$/, '')
            const last = normalized.split('/').filter(Boolean).pop() || ''
            return last || 'website'
          }
        })()

        const ensureFolderPath = async (fs: WorkspaceFs, absPath: string) => {
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

        const coerceWebpageView = (raw: unknown): 'markdown' | 'json' | 'html' => (raw === 'html' ? 'html' : raw === 'json' ? 'json' : 'markdown')

        const localSiteRootRel = (() => {
          if (/^https?:\/\//i.test(url)) return ''
          const normalized = url.replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\.+\//, '').replace(/^\/+/, '')
          if (!normalized || normalized.includes('..')) return ''
          const parts = normalized.split('/').filter(Boolean)
          if (parts.length === 0) return ''
          const leaf = parts[parts.length - 1] || ''
          if (/\.(xml|html|htm)$/i.test(leaf) && parts.length > 1) return parts.slice(0, -1).join('/')
          return normalized
        })()

        const stubForNode = (nodeUrl: string, nodeId: string) => {
          const v = coerceWebpageView(defaultView)
          const lines = [
            '---',
            `kgWebpageUrl: "${nodeUrl}"`,
            `kgWebpageView: "${v}"`,
            !/^https?:\/\//i.test(nodeUrl) && localSiteRootRel ? `kgWebpageSiteRootRel: "${localSiteRootRel}"` : null,
            `kgWebsiteImportId: "${importId}"`,
            `kgWebsiteNodeId: "${nodeId}"`,
          ]
          if (outputDirRel && outputDirRel.trim()) {
            lines.push(`kgWebsiteOutputDirRel: "${outputDirRel.trim()}"`)
          }
          lines.push('---', '')
          return lines.filter(Boolean).join('\n')
        }

        const shouldGenerateArtifactDocs = generateArtifactDocs

        const fs = await getFs()
        await fs.ensureSeed()

        const created = await runWorkspaceFsChangedBatch(async () => {
          suppressNextWorkspaceFsChangedEvent()
          const rootFolder = await ensureFolderPath(fs, `/websites/${safeWebsitePathSegment(host)}/${safeWebsitePathSegment(importId)}`)
          const createdPaths: WorkspacePath[] = []
          const sources: Array<{ path: WorkspacePath; source: { kind: 'url'; url: string; path: string } }> = []
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
            const created = await ensureFolderPath(fs, normalized)
            folderCache.set(normalized, created)
            folderCache.set(normalizeWorkspacePath(created), created)
            return created
          }

          const totalWrites = nodeRows.length
          let lastUiAtMs = 0
          const writeConcurrency = shouldGenerateArtifactDocs ? Math.max(1, Math.min(2, concurrency)) : Math.max(1, Math.min(6, concurrency))

          await mapLimit(
            nodeRows,
            writeConcurrency,
            async row => {
              if (importJobRef.current !== jobId) throw new Error('cancelled')
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

              const base = leaf || 'index'
              const nameBase = base.endsWith('.md') ? base.replace(/\.md$/i, '') : base
              const primaryName = `${nameBase}.md`

              const text = await (async () => {
                if (!shouldGenerateArtifactDocs) return stubForNode(row.nodeUrl, row.nodeId)
                try {
                  const serverMarkdown = await (async () => {
                    try {
                      const t = await fetchWebsiteImportArtifact({
                        importId,
                        nodeId: row.nodeId,
                        outputDirRel: outputDirRel || undefined,
                        kind: 'markdown',
                        signal: ctrl.signal,
                      })
                      if (t && t.trim()) return t
                    } catch {
                      void 0
                    }
                    return ''
                  })()

                  if (serverMarkdown) {
                    return buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
                      upstreamMarkdown: serverMarkdown,
                      url: row.nodeUrl,
                      view: coerceWebpageView(defaultView),
                      title: row.nodeTitle,
                      websiteImportMeta: { importId, nodeId: row.nodeId, outputDirRel: outputDirRel || undefined },
                    })
                  }

                  const rawHtml = await fetchWebsiteImportArtifact({
                    importId,
                    nodeId: row.nodeId,
                    outputDirRel: outputDirRel || undefined,
                    kind: 'rawHtml',
                    signal: ctrl.signal,
                  })
                  const boundedHtml = rawHtml.length > 5_000_000 ? rawHtml.slice(0, 5_000_000) : rawHtml
                  const markdown = await convertWebpageHtmlToMarkdownArtifactAsync({ html: boundedHtml, url: row.nodeUrl, includeImages: true, fidelityLevel: 4 })
                  return buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
                    upstreamMarkdown: markdown,
                    url: row.nodeUrl,
                    view: coerceWebpageView(defaultView),
                    title: row.nodeTitle,
                    websiteImportMeta: { importId, nodeId: row.nodeId, outputDirRel: outputDirRel || undefined },
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
              yieldEvery: shouldGenerateArtifactDocs ? 1 : 12,
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
              outputDirRel: outputDirRel || undefined,
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

        if (importJobRef.current !== jobId) return
        bulkSetWorkspaceEntrySources(created.sources)
        await refresh()
        const first = created.createdPaths[0]
        if (first) {
          await focusAfterImport(first, { sourceUrl: null, applyToGraph: false, jobId })
        }
        status.setStatusInfo(`Imported website: ${host}`)
      } catch (e) {
        if (importJobRef.current !== jobId) return
        const msg = String((e as { message?: unknown })?.message ?? e)
        if (/cancelled/i.test(msg)) return
        status.setStatusError(`Import failed: ${msg}`)
      }
    },
    [focusAfterImport, getFs, importJobRef, refresh, status],
  )

  return { handleImportWebsite }
}
