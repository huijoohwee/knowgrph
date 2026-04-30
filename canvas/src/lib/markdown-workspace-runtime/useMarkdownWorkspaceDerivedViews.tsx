import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { createProgressTicker } from '@/lib/progress/progressTicker'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import { fetchPdfWorkspaceDoc } from '@/lib/pdf/pdfWorkspaceClient'
import { fetchWebpageMarkdown, fetchYouTubeTranscriptMarkdown } from '@/lib/net/remoteMarkdownConversions'
import { parsePdfWorkspaceFrontmatter } from '@/lib/pdf/pdfWorkspaceFrontmatter'
import {
  isFrontmatterOnlyDoc,
  parseWebpageFrontmatterMeta,
  parseWebsiteImportFrontmatterMeta,
  upsertWebpageFrontmatterMeta,
  type WebpageViewMode,
} from '@/lib/markdown/frontmatter'
import { fetchWebpageConversionJsonViaConvert, fetchWebsiteImportArtifact } from '@/lib/websites/webpageIframeSrcdoc'
import { websiteImportArtifactKindForWebpageView } from '@/lib/websites/websiteImportArtifactKind'
import { workspaceDocumentKey } from '@/features/workspace-fs/path'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { inferYoutubeVideoIdFromPath, parseYoutubeWorkspaceFrontmatter } from './markdownWorkspaceRuntime.shared'
import { resolveAuthoritativeWorkspaceText } from './markdownWorkspaceRuntime.io'
import type { MarkdownWorkspaceRuntimeGetFs, MarkdownWorkspaceRuntimeSetActiveDocument } from './markdownWorkspaceRuntime.types'

export function useMarkdownWorkspaceDerivedViews(args: {
  activePath: WorkspacePath | null
  activeText: string
  layoutMode: string
  getFs: MarkdownWorkspaceRuntimeGetFs
  sourcesByPath: WorkspaceSourceIndex
  lastLoadedRef: React.MutableRefObject<{ path: WorkspacePath; text: string } | null>
  activeTextRef: React.MutableRefObject<string>
  userEditedActiveTextRef: React.MutableRefObject<boolean>
  patchWorkspaceEntryInlineText: (path: WorkspacePath, text: string) => void
  setActiveTextProgrammatic: (next: string) => void
  setActiveMarkdownDocument: MarkdownWorkspaceRuntimeSetActiveDocument
  setStatusError: (label: string) => void
  setStatusProgress: (
    label: string,
    value?: number,
    max?: number,
    bytesDone?: number,
    bytesTotal?: number,
    opts?: { ttlMs?: number },
  ) => void
  setStatusWithAutoClear: (label: string, ttlMs?: number) => void
}) {
  const pdfWorkspaceMeta = React.useMemo(() => {
    if (!args.activePath) return null
    if (!args.activePath.endsWith('.md') && !args.activePath.endsWith('.markdown')) return null
    const t = String(args.activeText || '')
    if (!t.startsWith('---')) return null
    return parsePdfWorkspaceFrontmatter(t)
  }, [args.activePath, args.activeText])

  const youtubeWorkspaceMeta = React.useMemo(() => {
    if (!args.activePath) return null
    const ext = args.activePath.split('.').pop()?.toLowerCase() || ''
    const allowed = ['md', 'markdown', 'txt', 'json']
    if (!allowed.includes(ext)) return null

    const t = String(args.activeText || '')
    if (t.startsWith('---')) {
      const parsed = parseYoutubeWorkspaceFrontmatter(t)
      if (parsed) return parsed
    }
    const inferredId = inferYoutubeVideoIdFromPath(args.activePath)
    if (inferredId) return { videoId: inferredId, format: 'markdown' as const }
    return null
  }, [args.activePath, args.activeText])

  const webpageWorkspaceMeta = React.useMemo(() => {
    if (!args.activePath) return null
    if (!args.activePath.endsWith('.md') && !args.activePath.endsWith('.markdown')) return null
    const t = String(args.activeText || '')
    if (!t.startsWith('---')) return null
    return parseWebpageFrontmatterMeta(t)
  }, [args.activePath, args.activeText])

  const websiteImportMeta = React.useMemo(() => {
    if (!args.activePath) return null
    if (!args.activePath.endsWith('.md') && !args.activePath.endsWith('.markdown')) return null
    const t = String(args.activeText || '')
    if (!t.startsWith('---')) return null
    return parseWebsiteImportFrontmatterMeta(t)
  }, [args.activePath, args.activeText])

  const [pdfWorkspaceViewerTextOverride, setPdfWorkspaceViewerTextOverride] = React.useState<string | null>(null)
  const [webpageWorkspaceEditorTextOverride, setWebpageWorkspaceEditorTextOverride] = React.useState<string | null>(null)
  const [webpageWorkspaceViewerTextOverride, setWebpageWorkspaceViewerTextOverride] = React.useState<string | null>(null)

  const pdfWorkspaceFetchArgs = React.useMemo(() => {
    const docId = pdfWorkspaceMeta ? String(pdfWorkspaceMeta.docId || '').trim() : ''
    const outputDirRel = pdfWorkspaceMeta ? String(pdfWorkspaceMeta.outputDirRel || '').trim() : ''
    if (!docId) return null
    return { docId, outputDirRel }
  }, [pdfWorkspaceMeta?.docId, pdfWorkspaceMeta?.outputDirRel])
  const pdfWorkspaceFetchKey = pdfWorkspaceFetchArgs ? `${pdfWorkspaceFetchArgs.docId}:${pdfWorkspaceFetchArgs.outputDirRel}` : ''

  React.useEffect(() => {
    if (args.layoutMode !== 'viewer' && args.layoutMode !== 'split') {
      setPdfWorkspaceViewerTextOverride(null)
      return
    }
    if (!pdfWorkspaceFetchKey || !pdfWorkspaceFetchArgs) {
      setPdfWorkspaceViewerTextOverride(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 60_000)
    void (async () => {
      try {
        const res = await fetchPdfWorkspaceDoc({
          docId: pdfWorkspaceFetchArgs.docId,
          outputDirRel: pdfWorkspaceFetchArgs.outputDirRel,
          signal: controller.signal,
        })
        if (cancelled) return
        if (res.ok !== true) {
          setPdfWorkspaceViewerTextOverride(null)
          return
        }
        setPdfWorkspaceViewerTextOverride(String(res.markdown || ''))
      } catch {
        if (!cancelled) setPdfWorkspaceViewerTextOverride(null)
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(t)
      try {
        controller.abort()
      } catch {
        void 0
      }
    }
  }, [args.layoutMode, pdfWorkspaceFetchArgs, pdfWorkspaceFetchKey])

  const webpageUrl = webpageWorkspaceMeta?.url ? String(webpageWorkspaceMeta.url || '').trim() : ''
  const webpageView = webpageWorkspaceMeta?.view
  const websiteImportKey = (() => {
    const importId = String(websiteImportMeta?.importId || '').trim()
    const nodeId = String(websiteImportMeta?.nodeId || '').trim()
    const outputDirRel = String(websiteImportMeta?.outputDirRel || '').trim()
    if (!importId || !nodeId) return ''
    return `${importId}:${nodeId}:${outputDirRel}`
  })()

  React.useEffect(() => {
    const url = webpageUrl
    const view = webpageView
    if (!url || !view || view === 'markdown' || view === 'html') {
      setWebpageWorkspaceEditorTextOverride(null)
      setWebpageWorkspaceViewerTextOverride(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const ticker = createProgressTicker({
      onProgress: p => args.setStatusProgress(view === 'json' ? 'Loading JSON' : 'Loading view', p, 100),
      intervalMs: 280,
      maxPercentage: 92,
      maxStepPercentage: 12,
    })
    void (async () => {
      try {
        ticker.start()
        args.setStatusProgress(view === 'json' ? 'Loading JSON' : 'Loading view')
        if (websiteImportKey) {
          const [importId, nodeId, outputDirRelRaw] = websiteImportKey.split(':')
          const outputDirRel = String(outputDirRelRaw || useGraphStore.getState().websiteImportOutputDirRel || '').trim()
          const kind = websiteImportArtifactKindForWebpageView(view)
          try {
            const effective = await fetchWebsiteImportArtifact({
              importId: String(importId || ''),
              nodeId: String(nodeId || ''),
              outputDirRel,
              kind,
              signal: controller.signal,
            })
            if (cancelled) return
            const clipped = effective.length > 200_000 ? `${effective.slice(0, 200_000)}\n\n(clipped)\n` : effective
            setWebpageWorkspaceEditorTextOverride(clipped)
            setWebpageWorkspaceViewerTextOverride(view === 'json' ? `\`\`\`json\n${clipped}\n\`\`\`\n` : null)
            ticker.stop(100)
            args.setStatusWithAutoClear('Loaded', UI_TOAST_TTL_MS.statusAutoCloseFast)
          } catch (err) {
            if (cancelled) return
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : ''
            const errorText =
              view === 'json'
                ? JSON.stringify({ ok: false, error: msg || 'Load failed' }, null, 2)
                : `Load failed: ${msg || 'Request failed'}\n`
            setWebpageWorkspaceEditorTextOverride(errorText)
            setWebpageWorkspaceViewerTextOverride(view === 'json' ? `\`\`\`json\n${errorText}\n\`\`\`\n` : null)
            ticker.stop()
            args.setStatusError(`Load failed: ${msg || 'Request failed'}`)
          }
          return
        }

        if (view === 'json') {
          const includeImages = useGraphStore.getState().webpageImportIncludeImages ?? true
          try {
            const rawJson = await fetchWebpageConversionJsonViaConvert({ url, includeImages, signal: controller.signal })
            if (cancelled) return
            const pretty = (() => {
              const t = String(rawJson || '')
              try {
                return JSON.stringify(JSON.parse(t) as unknown, null, 2)
              } catch {
                return t
              }
            })()
            setWebpageWorkspaceEditorTextOverride(pretty)
            setWebpageWorkspaceViewerTextOverride(`\`\`\`json\n${pretty}\n\`\`\`\n`)
            ticker.stop(100)
            args.setStatusWithAutoClear('Loaded', UI_TOAST_TTL_MS.statusAutoCloseFast)
          } catch (err) {
            if (cancelled) return
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : ''
            const errorText = JSON.stringify({ ok: false, error: msg || 'Request failed' }, null, 2)
            setWebpageWorkspaceEditorTextOverride(errorText)
            setWebpageWorkspaceViewerTextOverride(`\`\`\`json\n${errorText}\n\`\`\`\n`)
            ticker.stop()
            args.setStatusError(`Load failed: ${msg || 'Request failed'}`)
          }
          return
        }

        setWebpageWorkspaceEditorTextOverride(null)
        setWebpageWorkspaceViewerTextOverride(null)
        ticker.stop(100)
      } catch {
        if (cancelled) return
        ticker.stop()
        setWebpageWorkspaceEditorTextOverride(JSON.stringify({ ok: false, error: 'Request failed' }, null, 2))
        setWebpageWorkspaceViewerTextOverride(null)
        args.setStatusError('Load failed')
      }
    })()

    return () => {
      cancelled = true
      try {
        ticker.stop()
      } catch {
        void 0
      }
      try {
        controller.abort()
      } catch {
        void 0
      }
    }
  }, [args.setStatusError, args.setStatusProgress, args.setStatusWithAutoClear, webpageUrl, webpageView, websiteImportKey])

  const switchActiveYoutubeWorkspaceFormat = React.useCallback(
    async (format: 'markdown' | 'json') => {
      if (!args.activePath || !youtubeWorkspaceMeta) return
      args.setStatusProgress('Loading YouTube transcript')
      try {
        setPdfWorkspaceViewerTextOverride(null)
        const res = await fetchYouTubeTranscriptMarkdown(`https://youtu.be/${youtubeWorkspaceMeta.videoId}`)
        if (!res) {
          args.setStatusError('Request failed')
          return
        }
        if (res.ok !== true) {
          args.setStatusError(res.error)
          return
        }

        const frontmatter = `---\nkgYoutubeVideoId: "${youtubeWorkspaceMeta.videoId}"\nkgYoutubeFormat: "${format}"\n---\n\n`
        const nextText =
          format === 'json' && res.transcriptJsonText
            ? `${frontmatter}\`\`\`json\n${res.transcriptJsonText}\n\`\`\`\n`
            : `${frontmatter}${res.markdown}`

        const fs = await args.getFs()
        await fs.writeFileText(args.activePath, nextText)
        args.lastLoadedRef.current = { path: args.activePath, text: nextText }
        args.patchWorkspaceEntryInlineText(args.activePath, nextText)
        args.setActiveTextProgrammatic(nextText)
        const docKey = workspaceDocumentKey(args.activePath)
        if (docKey) {
          const source = args.sourcesByPath[args.activePath]
          const sourceUrl = source && source.kind === 'url' ? String(source.url || '').trim() : ''
          void args.setActiveMarkdownDocument({
            name: docKey,
            text: nextText,
            normalizeMermaidMmd: false,
            sourceUrl: sourceUrl ? sourceUrl : null,
          })
        }
        args.setStatusWithAutoClear('Loaded', UI_TOAST_TTL_MS.statusAutoCloseFast)
      } catch (e) {
        args.setStatusError(`Load failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [args, youtubeWorkspaceMeta],
  )

  const switchActiveWebpageWorkspaceView = React.useCallback(
    async (view: WebpageViewMode) => {
      if (!args.activePath || !webpageWorkspaceMeta) return
      if (webpageWorkspaceMeta.view === view) return
      const ticker = createProgressTicker({
        onProgress: p => args.setStatusProgress('Updating view', p, 100),
        intervalMs: 280,
        maxPercentage: 92,
        maxStepPercentage: 12,
      })
      try {
        args.setStatusProgress('Updating view')
        ticker.start()
        const fs = await args.getFs()

        if (view === 'markdown') {
          setWebpageWorkspaceEditorTextOverride(prev => (prev == null ? prev : null))
          setWebpageWorkspaceViewerTextOverride(prev => (prev == null ? prev : null))
        }

        const prevText = await resolveAuthoritativeWorkspaceText({
          path: args.activePath,
          getFs: args.getFs,
          lastLoadedRef: args.lastLoadedRef,
          activeTextRef: args.activeTextRef,
          userEditedActiveTextRef: args.userEditedActiveTextRef,
        })

        const nextText = await (async () => {
          if (view !== 'markdown') return upsertWebpageFrontmatterMeta(prevText, { url: webpageWorkspaceMeta.url, view })
          if (!isFrontmatterOnlyDoc(prevText)) return upsertWebpageFrontmatterMeta(prevText, { url: webpageWorkspaceMeta.url, view })

          const store = useGraphStore.getState()
          const includeImages = webpageWorkspaceMeta.includeImages ?? (store.webpageImportIncludeImages !== false)
          const isHttp = (() => {
            const u = String(webpageWorkspaceMeta.url || '').trim().toLowerCase()
            return u.startsWith('http://') || u.startsWith('https://')
          })()

          if (!isHttp && websiteImportMeta?.importId && websiteImportMeta?.nodeId) {
            const outputDirRel = String(
              websiteImportMeta.outputDirRel || useGraphStore.getState().websiteImportOutputDirRel || '',
            ).trim()
            const outputDirQuery = outputDirRel ? `outputDirRel=${encodeURIComponent(outputDirRel)}&` : ''
            const rawRes = await fetch(
              `/__website_import/artifact?${outputDirQuery}importId=${encodeURIComponent(
                websiteImportMeta.importId,
              )}&nodeId=${encodeURIComponent(websiteImportMeta.nodeId)}&kind=markdown`,
            )
            if (!rawRes.ok) return upsertWebpageFrontmatterMeta(prevText, { url: webpageWorkspaceMeta.url, view })
            const raw = String((await rawRes.text()) || '')
            return upsertWebpageFrontmatterMeta(raw, {
              url: webpageWorkspaceMeta.url,
              view: 'markdown',
              includeImages: webpageWorkspaceMeta.includeImages,
              fidelityLevel: webpageWorkspaceMeta.fidelityLevel,
            })
          }

          const res = await fetchWebpageMarkdown(webpageWorkspaceMeta.url, { includeImages })
          if (!res || res.ok !== true) return upsertWebpageFrontmatterMeta(prevText, { url: webpageWorkspaceMeta.url, view })
          return upsertWebpageFrontmatterMeta(String(res.markdown || ''), {
            url: webpageWorkspaceMeta.url,
            view: 'markdown',
            includeImages: webpageWorkspaceMeta.includeImages,
            fidelityLevel: webpageWorkspaceMeta.fidelityLevel,
          })
        })()

        await fs.writeFileText(args.activePath, nextText)
        args.lastLoadedRef.current = { path: args.activePath, text: nextText }
        args.patchWorkspaceEntryInlineText(args.activePath, nextText)
        args.setActiveTextProgrammatic(nextText)
        ticker.stop(100)
        args.setStatusWithAutoClear('Updated', UI_TOAST_TTL_MS.statusAutoCloseFast)
      } catch (e) {
        try {
          ticker.stop()
        } catch {
          void 0
        }
        args.setStatusError(`Update failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [args, webpageWorkspaceMeta, websiteImportMeta],
  )

  const updateActiveWebpageWorkspaceMeta = React.useCallback(
    async (patch: { fidelityLevel?: 1 | 2 | 3 | 4 }) => {
      if (!args.activePath || !webpageWorkspaceMeta) return
      try {
        args.setStatusProgress('Updating view')
        const fs = await args.getFs()
        const prevText = await resolveAuthoritativeWorkspaceText({
          path: args.activePath,
          getFs: args.getFs,
          lastLoadedRef: args.lastLoadedRef,
          activeTextRef: args.activeTextRef,
          userEditedActiveTextRef: args.userEditedActiveTextRef,
        })
        const meta = parseWebpageFrontmatterMeta(prevText) || webpageWorkspaceMeta
        const nextText = upsertWebpageFrontmatterMeta(prevText, {
          url: meta.url,
          view: meta.view,
          siteRootRel: meta.siteRootRel,
          fidelityLevel: patch.fidelityLevel,
        })
        await fs.writeFileText(args.activePath, nextText)
        args.lastLoadedRef.current = { path: args.activePath, text: nextText }
        args.patchWorkspaceEntryInlineText(args.activePath, nextText)
        args.setActiveTextProgrammatic(nextText)
        args.setStatusWithAutoClear('Updated', UI_TOAST_TTL_MS.statusAutoCloseFast)
      } catch (e) {
        args.setStatusError(`Update failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [args, webpageWorkspaceMeta],
  )

  return {
    pdfWorkspaceMeta,
    youtubeWorkspaceMeta,
    webpageWorkspaceMeta,
    websiteImportMeta,
    pdfWorkspaceViewerTextOverride,
    webpageWorkspaceEditorTextOverride,
    webpageWorkspaceViewerTextOverride,
    switchActiveYoutubeWorkspaceFormat,
    switchActiveWebpageWorkspaceView,
    updateActiveWebpageWorkspaceMeta,
  }
}
