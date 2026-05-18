import {
  buildLocalFsFetchPath,
  buildCodebaseFilePath,
  deriveFilenameFromUrl,
  isYouTubeUrl,
  normalizeGitHubBlobLikeUrl,
  unwrapUserProvidedText,
} from '@/lib/url'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { describeFetchRemoteTextFailure } from '@/lib/net/fetchRemoteTextFailure'
import { convertPdfUrlToMarkdown, fetchWebpageMarkdown, fetchYouTubeTranscriptMarkdown } from '@/lib/net/remoteMarkdownConversions'
import { useGraphStore } from '@/hooks/useGraphStore'
import { fetchWebpageHtmlAuto } from '@/lib/websites/webpageIframeSrcdoc'
import { exportWebpageDomViaHiddenIframe } from '@/lib/websites/webpageDomExport'
import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'
import { plainTextToMarkdown } from '@/lib/markdown/plainTextToMarkdown'
import { createProgressSession } from '@/lib/progress/progressTicker'
import { runInIdle } from '@/features/panels/utils/idle'
import { isFrontmatterOnlyDoc } from '@/lib/markdown/frontmatter'
import { htmlFallbackToMarkdownAllText, normalizeWebpageCardAndListBlocks } from './htmlTextFallback'
import { buildYouTubeWorkspaceEntryText } from './youtubeEntryText'
import type { Canvas2dRendererId } from '@/lib/config.render'
import { getWorkspaceUrlImportCanvasPreset, normalizeWorkspaceUrlImportCanvas2dRenderer, normalizeWorkspaceUrlImportDocumentMode } from './canvasPresets'
import { buildWebpageWorkspaceEntryStubText, buildWebpageWorkspaceEntryTextFromUpstreamMarkdown } from './webpageEntryText'
import { tryFetchApiNativeMarkdown } from './apiNative'
import type { WorkspaceUrlContent } from './types'
import { clearInflightWorkspaceUrlContent, getCachedWorkspaceUrlContent, getInflightWorkspaceUrlContent, setCachedWorkspaceUrlContent, setInflightWorkspaceUrlContent } from './urlContentCache'
import { buildWorkspaceUrlContentCacheKey } from './urlContentKey'
import { resolveBinaryDownloadProxyUrl } from '@/lib/chatEndpoint'
import { WORKSPACE_WEBPAGE_MARKDOWN_IMPORT_MAX_CHARS, WORKSPACE_WEBPAGE_MARKDOWN_REFRESH_MAX_CHARS, chooseWebpageMarkdownByContentCoverage, clipLargeWebpageMarkdown } from './webpageMarkdownFidelity'
import {
  GLB_ASSET_MIME_TYPE,
  GLTF_ASSET_MIME_TYPE,
  buildGlbAssetMarkdown,
  buildGltfAssetMarkdown,
  deriveModelWorkspaceDocumentNameFromUrl,
} from './glbAsset'
import {
  autoTuneFromHtml,
  deriveFallbackExtFromNormalizedLower,
  isWeChatArticleUrl,
  looksLikeJsShellText,
  shouldSkipUnifiedMarkdownConversion,
  shouldTreatAsSubstackUrl,
  type FetchMode,
  type WebpageViewMode,
} from './urlContentHeuristics'

type FetchWorkspaceUrlContentOpts = { mode?: FetchMode; onProgress?: (percentage: number) => void; viewHint?: WebpageViewMode; canvas2dRenderer?: Canvas2dRendererId | null; documentSemanticMode?: 'document' | 'keyword' | null }

async function fetchWorkspaceUrlContentImpl(rawUrl: string, opts?: FetchWorkspaceUrlContentOpts): Promise<WorkspaceUrlContent> {
  const cleaned = unwrapUserProvidedText(String(rawUrl || '').trim()) || String(rawUrl || '').trim()
  if (!cleaned) throw new Error('Invalid URL')

  const normalizedUrl = normalizeGitHubBlobLikeUrl(cleaned) ?? cleaned
  const normalizedLower = normalizedUrl.toLowerCase()
  const canvas2dRenderer = normalizeWorkspaceUrlImportCanvas2dRenderer(opts?.canvas2dRenderer)
  const documentSemanticMode = normalizeWorkspaceUrlImportDocumentMode(opts?.documentSemanticMode)
  const canvasPreset = getWorkspaceUrlImportCanvasPreset(canvas2dRenderer, documentSemanticMode)

  const isHttpUrl = /^https?:\/\//i.test(normalizedUrl)
  const isFileUrl = /^file:\/\//i.test(normalizedUrl)
  const isLocalRepoPath = (!isHttpUrl && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalizedUrl)) || isFileUrl
  const localFsFetchPath =
    buildLocalFsFetchPath(normalizedUrl)
    || (isFileUrl ? buildLocalFsFetchPath(normalizedUrl.replace(/^file:\/\//i, '')) : null)
  const localRepoPath = isLocalRepoPath
    ? normalizedUrl
        .replace(/^file:\/\//i, '')
        .replace(/\\/g, '/')
        .replace(/^\.+\//, '')
        .replace(/^\/+/, '')
    : ''
  const localSiteRootRel = isLocalRepoPath
    ? (() => {
        const parts = localRepoPath.split('/').filter(Boolean)
        if (parts.length <= 1) return ''
        return parts.slice(0, -1).join('/')
      })()
    : ''

  const isYouTube = isYouTubeUrl(normalizedUrl)
  const isPdf = /\.pdf(\?|#|$)/i.test(normalizedUrl)
  const isGlb = /\.glb(\?|#|$)/i.test(normalizedLower)
  const isGltf = /\.gltf(\?|#|$)/i.test(normalizedLower)
  const isWeChat = isWeChatArticleUrl(normalizedUrl)

  if (isYouTube) {
    opts?.onProgress?.(10)
    const converted = await fetchYouTubeTranscriptMarkdown(normalizedUrl)
    opts?.onProgress?.(100)
    if (!converted) throw new Error('YouTube import failed')
    if (converted.ok === false) throw new Error(converted.error || 'YouTube import failed')
    return {
      normalizedUrl,
      name: String(converted.name || 'youtube-transcript.md'),
      text: buildYouTubeWorkspaceEntryText({ normalizedUrl, converted, viewHint: opts?.viewHint }),
    }
  }

  if (isPdf) {
    opts?.onProgress?.(10)
    const converted = await convertPdfUrlToMarkdown(normalizedUrl)
    opts?.onProgress?.(100)
    if (!converted) throw new Error('PDF import failed')
    if (converted.ok === false) throw new Error(converted.error || 'PDF import failed')
    return {
      normalizedUrl,
      name: String(converted.name || 'document.md'),
      text: String(converted.markdown || ''),
    }
  }

  if (isGlb || isGltf) {
    opts?.onProgress?.(10)
    const fetchPath =
      localFsFetchPath ||
      (isLocalRepoPath ? buildCodebaseFilePath(localRepoPath) : resolveBinaryDownloadProxyUrl(normalizedUrl))
    const accept = isGltf
      ? `${GLTF_ASSET_MIME_TYPE},application/json,text/plain,*/*`
      : `${GLB_ASSET_MIME_TYPE},application/octet-stream,*/*`
    const res = await fetch(fetchPath, { headers: { Accept: accept } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const payload = isGltf ? await res.text() : await res.arrayBuffer()
    opts?.onProgress?.(100)
    const sourceUrl = localFsFetchPath && isFileUrl ? normalizedUrl.replace(/^file:\/\//i, '') : normalizedUrl
    const name = deriveFilenameFromUrl(normalizedUrl, isGltf ? 'model.gltf' : 'model.glb')
    return {
      normalizedUrl: sourceUrl,
      name: deriveModelWorkspaceDocumentNameFromUrl(normalizedUrl),
      text: isGltf
        ? buildGltfAssetMarkdown({
            name,
            sourceKind: 'url',
            sourceUrl,
            text: String(payload || ''),
          })
        : buildGlbAssetMarkdown({
            name,
            sourceKind: 'url',
            sourceUrl,
            buffer: payload as ArrayBuffer,
          }),
    }
  }

  const twitterStatus = (() => {
    try {
      const u = new URL(normalizedUrl)
      const host = u.hostname.toLowerCase()
      const isX = host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')
      if (!isX) return null
      const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)(?:\/|$)/i) || u.pathname.match(/\/status\/(\d+)(?:\/|$)/i)
      const handle = m && m[1] && typeof m[1] === 'string' && /^\d+$/.test(m[1]) === false ? String(m[1]).trim() : ''
      const id = m && m[2] ? String(m[2]).trim() : m && m[1] && /^\d+$/.test(String(m[1])) ? String(m[1]).trim() : ''
      if (!id) return null
      const safeHandle = handle ? handle.replace(/[^a-z0-9_]+/gi, '-') : 'tweet'
      const canonical = handle ? `https://x.com/${handle}/status/${id}` : `https://x.com/i/web/status/${id}`
      return { id, safeHandle, canonical }
    } catch {
      return null
    }
  })()
  if (twitterStatus) {
    return {
      normalizedUrl: twitterStatus.canonical,
      name: `${twitterStatus.safeHandle}-${twitterStatus.id}.md`,
      text: ['# X', '', `[](${twitterStatus.canonical})`, '', ''].join('\n'),
    }
  }

  const looksLikeImage = /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(normalizedLower)
  if (looksLikeImage) {
    const base = deriveFilenameFromUrl(normalizedUrl, 'image')
    const baseNoExt = base.replace(/\.[a-z0-9]+$/i, '') || 'image'
    const name = `${baseNoExt}.md`
    return {
      normalizedUrl,
      name,
      text: ['# Image', '', `![](${normalizedUrl})`, '', `[](${normalizedUrl})`, ''].join('\n'),
    }
  }

  const modeForApiNative: FetchMode = opts?.mode === 'refresh' ? 'refresh' : 'import'
  const viewHintForApiNative: WebpageViewMode | '' =
    opts?.viewHint === 'json' ? 'json' : opts?.viewHint === 'html' ? 'html' : opts?.viewHint === 'markdown' ? 'markdown' : ''
  if (modeForApiNative === 'refresh' || viewHintForApiNative === 'json') {
    const apiNative = await tryFetchApiNativeMarkdown({
      url: normalizedUrl,
      mode: modeForApiNative,
      viewHint: viewHintForApiNative,
      onProgress: opts?.onProgress,
    })
    if (apiNative) {
      const text = buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
        upstreamMarkdown: apiNative.upstreamMarkdown,
        url: apiNative.normalizedUrl,
        view: viewHintForApiNative || 'markdown',
        diag: apiNative.diagnostics,
        canvasPreset,
      })
      return {
        normalizedUrl: apiNative.normalizedUrl,
        name: apiNative.name,
        text,
      }
    }
  }

  const looksLikeLocalHtml = isLocalRepoPath && /\.(html|htm)(\?|#|$)/i.test(normalizedLower)
  const looksLikeCodeOrData =
    /\.(json|jsonld|geojson|csv|yaml|yml|txt|js|ts|py|md|markdown|mdx|svg)(\?|#|$)/i.test(normalizedLower) ||
    looksLikeLocalHtml
  if (!looksLikeCodeOrData) {
    const base = deriveFilenameFromUrl(normalizedUrl, 'webpage')
    const baseNoExt = base.replace(/\.[a-z0-9]+$/i, '') || 'webpage'
    const name = `${baseNoExt}.md`

    const mode: FetchMode = opts?.mode === 'refresh' ? 'refresh' : 'import'
    const viewHint: WebpageViewMode | '' =
      opts?.viewHint === 'markdown' ? 'markdown' : opts?.viewHint === 'json' ? 'json' : opts?.viewHint === 'html' ? 'html' : ''
    const looksLikeSubstackUrl = shouldTreatAsSubstackUrl(normalizedUrl)

    const ctrl = new AbortController()
    const progressSession = opts?.onProgress
      ? createProgressSession({ onProgress: opts.onProgress, intervalMs: 300, maxPercentage: 90, maxStepPercentage: 15 })
      : null

    let includeImages = true
    let defaultView: WebpageViewMode = opts?.viewHint === 'markdown' ? 'markdown' : 'html'
    let fidelityLevel: 1 | 2 | 3 | 4 = 4
    let lastFetchedHtml = ''
    let lastDomDiag = ''
    let lastDomTitle = ''
    let shouldConvertToMarkdown = false
    let shouldFallbackToPlainText = false
    let preserveUpstreamBodyFidelity = false
    try {
      progressSession?.start()

      const store = useGraphStore.getState()
      includeImages = canvasPreset ? true : store.webpageImportIncludeImages !== false
      defaultView = (
        opts?.viewHint === 'markdown'
          ? 'markdown'
          : opts?.viewHint === 'json'
            ? 'json'
            : opts?.viewHint === 'html'
              ? 'html'
              : mode === 'refresh'
                ? 'html'
                : store.webpageImportView
      ) as WebpageViewMode
      fidelityLevel = (() => {
        if (canvasPreset) return 4
        const raw = store.webpageArtifactFidelityMaxLevel
        const n = Number.isFinite(raw) ? Math.floor(Number(raw)) : 4
        return n <= 1 ? 1 : n >= 4 ? 4 : (n as 1 | 2 | 3)
      })()

      if (looksLikeSubstackUrl) {
        defaultView = 'markdown'
        includeImages = true
        fidelityLevel = 4
      }

      const forceConvertToMarkdown = opts?.viewHint === 'markdown'
      shouldConvertToMarkdown = forceConvertToMarkdown || mode !== 'refresh' || looksLikeSubstackUrl || isWeChat
      shouldFallbackToPlainText = forceConvertToMarkdown

      const upstreamMarkdown = await (async () => {
        try {
          if (shouldConvertToMarkdown && mode === 'refresh') {
            const converted = await fetchWebpageMarkdown(normalizedUrl, { includeImages })
            if (converted && converted.ok === true && typeof converted.markdown === 'string') return String(converted.markdown || '')
          }
        } catch {
          void 0
        }

        if (mode === 'refresh' && !looksLikeSubstackUrl) {
          try {
            const [textDom, htmlDom] = await Promise.all([
              exportWebpageDomViaHiddenIframe({
                url: normalizedUrl,
                mode: 'text',
                timeoutMs: 45_000,
                maxChars: 12_000_000,
                scrollCrawl: true,
                expandFaq: true,
                minWaitAfterLoadMs: 650,
                signal: ctrl.signal,
              }),
              exportWebpageDomViaHiddenIframe({
                url: normalizedUrl,
                mode: 'html',
                timeoutMs: 45_000,
                maxChars: 12_000_000,
                scrollCrawl: true,
                expandFaq: true,
                minWaitAfterLoadMs: 650,
                signal: ctrl.signal,
              }),
            ])
            const domDiag = String(htmlDom?.diag || textDom?.diag || '').trim()
            if (domDiag) lastDomDiag = domDiag
            const domTitle = String(htmlDom?.title || textDom?.title || '').trim()
            if (domTitle) lastDomTitle = domTitle

            const htmlText = String(htmlDom?.text || '')
            if (htmlText.trim()) {
              lastFetchedHtml = htmlText
              const tuned = autoTuneFromHtml({
                html: lastFetchedHtml,
                includeImages,
                fidelityLevel,
                defaultView,
                mode,
                forceConvertToMarkdown,
                isWeChat,
              })
              includeImages = tuned.includeImages
              fidelityLevel = tuned.fidelityLevel
              defaultView = tuned.defaultView
              opts?.onProgress?.(55)
              const converted = await runInIdle(
                async () =>
                  await convertHtmlToMarkdownUnified({
                    html: htmlText,
                    baseUrl: normalizedUrl,
                    maxInputChars: 12_000_000,
                    includeImages,
                    fidelityLevel,
                    includeHeadSection: false,
                  }),
                { timeoutMs: 1200 },
              )
              if (converted.ok === true && converted.markdown.trim()) {
                const processed = normalizeWebpageCardAndListBlocks(converted.markdown)
                const trimmed = processed.trim()
                const title = String(htmlDom?.title || textDom?.title || '').trim()
                if (trimmed.length >= 400) return trimmed
                if (title && trimmed && trimmed.length <= 120 && trimmed.replace(/\s+/g, ' ').trim() === title.replace(/\s+/g, ' ').trim()) {
                  void 0
                } else if (trimmed.length >= 220) {
                  return trimmed
                }
              }
            }

            const textOnly = String(textDom?.text || '').trim()
            const title = String(htmlDom?.title || textDom?.title || '').trim() || undefined
            if (textOnly.length >= 400) {
              if (!looksLikeJsShellText(textOnly)) return plainTextToMarkdown(textOnly, title)
            }
          } catch {
            void 0
          }
        }

        const fetchImpl = (globalThis as unknown as { fetch?: unknown }).fetch
        const rawHtml = await fetchWebpageHtmlAuto({
          url: normalizedUrl,
          signal: ctrl.signal,
          bypassCache: mode === 'refresh',
          fetchImpl: typeof fetchImpl === 'function' ? (fetchImpl as typeof fetch) : undefined,
        })
        const boundedHtml = rawHtml.length > 5_000_000 ? rawHtml.slice(0, 5_000_000) : rawHtml
        lastFetchedHtml = boundedHtml
        const tuned = autoTuneFromHtml({
          html: lastFetchedHtml,
          includeImages,
          fidelityLevel,
          defaultView,
          mode,
          forceConvertToMarkdown,
          isWeChat,
        })
        includeImages = tuned.includeImages
        fidelityLevel = tuned.fidelityLevel
        defaultView = tuned.defaultView
        shouldConvertToMarkdown = tuned.shouldConvertToMarkdown
        shouldFallbackToPlainText = tuned.shouldFallbackToPlainText
        opts?.onProgress?.(65)

        if (!tuned.shouldConvertToMarkdown) {
          const recovered = normalizeWebpageCardAndListBlocks(htmlFallbackToMarkdownAllText(boundedHtml))
          return recovered.trim()
        }

        const markdownSelection = await (async () => {
          let convertedMarkdown = ''
          let fallbackMarkdown = ''
          if (forceConvertToMarkdown && shouldSkipUnifiedMarkdownConversion(boundedHtml)) {
            try {
              const clipped = boundedHtml.length > 1_500_000 ? boundedHtml.slice(0, 1_500_000) : boundedHtml
              fallbackMarkdown = htmlFallbackToMarkdownAllText(clipped)
            } catch {
              fallbackMarkdown = ''
            }
          } else {
            try {
              const converted = await runInIdle(
                async () =>
                  await convertHtmlToMarkdownUnified({
                    html: boundedHtml,
                    baseUrl: normalizedUrl,
                    maxInputChars: 5_000_000,
                    includeImages,
                    fidelityLevel,
                    includeHeadSection: false,
                  }),
                { timeoutMs: 1200 },
              )
              if (converted.ok === true && converted.markdown.trim()) {
                convertedMarkdown = normalizeWebpageCardAndListBlocks(converted.markdown)
              }
            } catch {
              void 0
            }
            if (mode === 'import') {
              try {
                fallbackMarkdown = await runInIdle(async () => htmlFallbackToMarkdownAllText(boundedHtml), { timeoutMs: 900 })
              } catch {
                fallbackMarkdown = ''
              }
            }
          }
          return chooseWebpageMarkdownByContentCoverage({
            mode,
            convertedMarkdown,
            fallbackMarkdown,
          })
        })()
        opts?.onProgress?.(85)
        if (markdownSelection.markdown.trim()) {
          if (markdownSelection.source === 'fallback') preserveUpstreamBodyFidelity = true
          return markdownSelection.markdown.trim()
        }

        if (!tuned.shouldFallbackToPlainText) return ''

        const fallbackMarkdown = await runInIdle(async () => htmlFallbackToMarkdownAllText(boundedHtml), { timeoutMs: 900 })
        if (fallbackMarkdown.trim()) preserveUpstreamBodyFidelity = true
        return fallbackMarkdown
      })()

      progressSession?.finish(100)
      opts?.onProgress?.(95)

      const maxMarkdownChars = mode === 'import' ? WORKSPACE_WEBPAGE_MARKDOWN_IMPORT_MAX_CHARS : WORKSPACE_WEBPAGE_MARKDOWN_REFRESH_MAX_CHARS
      const clipped = clipLargeWebpageMarkdown(upstreamMarkdown, maxMarkdownChars)
      const text = await runInIdle(
        () =>
          buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
            upstreamMarkdown: clipped.text,
            url: normalizedUrl,
            view: defaultView,
            title: lastDomTitle,
            diag: clipped.clipped ? [String(lastDomDiag || '').trim(), `clipped: ${maxMarkdownChars}`].filter(Boolean).join('\n') : lastDomDiag,
            fidelityLevel: mode === 'import' && !canvasPreset ? undefined : fidelityLevel,
            includeImages: mode === 'import' && !canvasPreset ? undefined : includeImages,
            canvasPreset,
            preserveBodyFidelity: preserveUpstreamBodyFidelity,
          }),
        { timeoutMs: 120 },
      )
      opts?.onProgress?.(100)
      if (text && text.trim() && !isFrontmatterOnlyDoc(text)) return { normalizedUrl, name, text }

      const minimal = buildWebpageWorkspaceEntryStubText({
        url: normalizedUrl,
        view: defaultView,
        body: String(upstreamMarkdown || '').trim(),
        canvasPreset,
        fidelityLevel: canvasPreset ? 4 : undefined,
        includeImages: canvasPreset ? true : undefined,
      })
      if (minimal.trim() && !isFrontmatterOnlyDoc(minimal)) return { normalizedUrl, name, text: minimal }
    } catch {
      if (mode === 'refresh') {
        const recoveredBody = lastFetchedHtml && shouldFallbackToPlainText ? htmlFallbackToMarkdownAllText(lastFetchedHtml) : ''
        const recovered = buildWebpageWorkspaceEntryStubText({
          url: normalizedUrl,
          view: defaultView,
          body: recoveredBody.trim(),
          canvasPreset,
          fidelityLevel: canvasPreset ? 4 : undefined,
          includeImages: canvasPreset ? true : undefined,
        })
        if (recovered.trim() && !isFrontmatterOnlyDoc(recovered)) return { normalizedUrl, name, text: recovered }
      }
    } finally {
      progressSession?.cleanup()
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }

    const fallbackView: WebpageViewMode =
      opts?.viewHint === 'markdown' ? 'markdown' : opts?.viewHint === 'json' ? 'json' : opts?.viewHint === 'html' ? 'html' : 'html'
    const text = buildWebpageWorkspaceEntryStubText({
      url: normalizedUrl,
      view: fallbackView,
      body: `[](${normalizedUrl})\n`,
      hydrate: false,
      canvasPreset,
      fidelityLevel: canvasPreset ? 4 : undefined,
      includeImages: canvasPreset ? true : undefined,
    })
    return { normalizedUrl, name, text }
  }

  if (isLocalRepoPath) {
    if (localRepoPath.includes('..')) throw new Error('Invalid local path')
    const localSourceUrl = localFsFetchPath
      ? (isFileUrl ? normalizedUrl.replace(/^file:\/\//i, '') : normalizedUrl)
      : localRepoPath
    if (looksLikeLocalHtml) {
      const base = localRepoPath.split('/').pop() || 'webpage'
      const baseNoExt = base.replace(/\.[a-z0-9]+$/i, '') || 'webpage'
      const name = `${baseNoExt}.md`
      const text = buildWebpageWorkspaceEntryStubText({
        url: localRepoPath,
        view: 'html',
        body: '',
        siteRootRel: localSiteRootRel || '',
        canvasPreset,
        fidelityLevel: canvasPreset ? 4 : undefined,
        includeImages: canvasPreset ? true : undefined,
      })
      return { normalizedUrl: localSourceUrl, name, text }
    }

    opts?.onProgress?.(10)
    const fetchPath = localFsFetchPath || buildCodebaseFilePath(localRepoPath)
    const res = await fetch(fetchPath, { headers: { Accept: '*/*' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    opts?.onProgress?.(100)

    const fallbackExt = deriveFallbackExtFromNormalizedLower(normalizedLower)

    const base = localRepoPath.split('/').pop() || `import${fallbackExt}`
    const name = base.includes('.') ? base : `${base}${fallbackExt}`
    return { normalizedUrl: localSourceUrl, name, text }
  }

  opts?.onProgress?.(10)
  const res = await fetchRemoteTextDetailed(normalizedUrl, { preflightHead: true, preferProxy: true })
  opts?.onProgress?.(100)
  if (!res.ok) throw new Error(describeFetchRemoteTextFailure(res as import('grph-shared/net/fetchRemoteText').FetchRemoteTextFailure))
  const text = res.text

  const fallbackExt = deriveFallbackExtFromNormalizedLower(normalizedLower)

  const fallback = `import${fallbackExt}`
  const derived = deriveFilenameFromUrl(normalizedUrl, fallback)
  const name = derived.includes('.') ? derived : `${derived}${fallbackExt}`
  return { normalizedUrl, name, text }
}

export async function fetchWorkspaceUrlContent(rawUrl: string, opts?: FetchWorkspaceUrlContentOpts): Promise<WorkspaceUrlContent> {
  const cleaned = unwrapUserProvidedText(String(rawUrl || '').trim()) || String(rawUrl || '').trim()
  if (!cleaned) throw new Error('Invalid URL')
  const normalizedUrl = normalizeGitHubBlobLikeUrl(cleaned) ?? cleaned
  const mode: FetchMode = opts?.mode === 'refresh' ? 'refresh' : 'import'
  const viewHint = opts?.viewHint === 'markdown' ? 'markdown' : opts?.viewHint === 'json' ? 'json' : opts?.viewHint === 'html' ? 'html' : ''
  const canvas2dRenderer = normalizeWorkspaceUrlImportCanvas2dRenderer(opts?.canvas2dRenderer)
  const documentSemanticMode = normalizeWorkspaceUrlImportDocumentMode(opts?.documentSemanticMode)
  const storeSnapshot = canvas2dRenderer ? null : useGraphStore.getState()
  const key = buildWorkspaceUrlContentCacheKey({
    normalizedUrl,
    mode,
    viewHint,
    canvas2dRenderer,
    documentSemanticMode,
    storeSnapshot,
  })

  const cached = getCachedWorkspaceUrlContent(key)
  if (cached) return cached

  const inflight = getInflightWorkspaceUrlContent(key)
  if (inflight) return await inflight

  const p = (async () => {
    const res = await fetchWorkspaceUrlContentImpl(cleaned, opts)
    setCachedWorkspaceUrlContent(key, res)
    return res
  })()
  setInflightWorkspaceUrlContent(key, p)
  try {
    return await p
  } finally {
    clearInflightWorkspaceUrlContent(key)
  }
}
