import {
  buildLocalFsFetchPath,
  buildRepoFilePath,
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
import { createProgressTicker } from '@/lib/progress/progressTicker'
import { runInIdle } from '@/features/panels/utils/idle'
import { isFrontmatterOnlyDoc } from '@/lib/markdown/frontmatter'
import { htmlFallbackToMarkdownAllText, normalizeWebpageCardAndListBlocks } from './htmlTextFallback'
import { yamlQuote } from './yaml'
import { buildWebpageWorkspaceEntryTextFromUpstreamMarkdown } from './webpageEntryText'
import { tryFetchApiNativeMarkdown } from './apiNative'
import type { WorkspaceUrlContent } from './types'
import { clearInflightWorkspaceUrlContent, getCachedWorkspaceUrlContent, getInflightWorkspaceUrlContent, setCachedWorkspaceUrlContent, setInflightWorkspaceUrlContent } from './urlContentCache'

type WebpageViewMode = 'markdown' | 'json' | 'html'
type FetchMode = 'import' | 'refresh'

type FetchWorkspaceUrlContentOpts = {
  mode?: FetchMode
  onProgress?: (percentage: number) => void
  viewHint?: WebpageViewMode
}
const WORKSPACE_WEBPAGE_MARKDOWN_MAX_CHARS = 220_000

function isWeChatArticleUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host === 'mp.weixin.qq.com' || host.endsWith('.mp.weixin.qq.com')) return true
  } catch {
    void 0
  }
  return false
}
function shouldTreatAsSubstackUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const p = String(u.pathname || '')
    return /^\/p\/[^/]+\/?$/i.test(p)
  } catch {
    return false
  }
}
function shouldSkipHydrationForMarkdownStub(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    const path = String(u.pathname || '')
    if ((host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) && /^\/home\/?$/i.test(path)) {
      return true
    }
    if ((host === 'linkedin.com' || host.endsWith('.linkedin.com')) && /^\/feed\/?$/i.test(path)) {
      return true
    }
  } catch {
    void 0
  }
  return false
}
function looksLikeJsShellText(text: string): boolean {
  const t = String(text || '')
  if (!t.trim()) return false
  if (/failed\s+to\s+load\s+posts/i.test(t)) return true
  if (/enable-javascript\.com/i.test(t)) return true
  if (/requires\s+java\s*script/i.test(t)) return true
  if (/page not foundlatesttopdiscussions/i.test(t.replace(/\s+/g, ''))) return true
  return false
}

function clipLargeWebpageMarkdown(text: string): { text: string; clipped: boolean } {
  const t = String(text || '')
  if (!t) return { text: t, clipped: false }
  if (t.length <= WORKSPACE_WEBPAGE_MARKDOWN_MAX_CHARS) return { text: t, clipped: false }
  const keep = t.slice(0, WORKSPACE_WEBPAGE_MARKDOWN_MAX_CHARS)
  const omitted = t.length - keep.length
  return {
    text: `${keep}\n\n…(clipped ${omitted} chars)…\n`,
    clipped: true,
  }
}

function shouldSkipUnifiedMarkdownConversion(html: string): boolean {
  const h = String(html || '')
  if (!h) return false
  if (h.length > 1_500_000) return true
  const scriptCount = (h.match(/<script\b/gi) || []).length
  if (scriptCount > 18) return true
  return false
}

function deriveFallbackExtFromNormalizedLower(normalizedLower: string): '.md' | '.json' | '.csv' | '.svg' | '.yaml' | '.html' | '.txt' {
  if (normalizedLower.endsWith('.md') || normalizedLower.endsWith('.markdown') || normalizedLower.endsWith('.mdx')) return '.md'
  if (normalizedLower.endsWith('.json') || normalizedLower.endsWith('.jsonld') || normalizedLower.endsWith('.geojson')) return '.json'
  if (normalizedLower.endsWith('.csv')) return '.csv'
  if (normalizedLower.endsWith('.svg')) return '.svg'
  if (normalizedLower.endsWith('.yaml') || normalizedLower.endsWith('.yml')) return '.yaml'
  if (normalizedLower.endsWith('.html') || normalizedLower.endsWith('.htm')) return '.html'
  return '.txt'
}

function autoTuneFromHtml(args: {
  html: string
  includeImages: boolean
  fidelityLevel: 1 | 2 | 3 | 4
  defaultView: WebpageViewMode
  mode: FetchMode
  forceConvertToMarkdown: boolean
  isWeChat: boolean
}): {
  isSubstackLike: boolean
  includeImages: boolean
  fidelityLevel: 1 | 2 | 3 | 4
  defaultView: WebpageViewMode
  shouldConvertToMarkdown: boolean
  shouldFallbackToPlainText: boolean
} {
  const h = String(args.html || '')
  const isSubstackLike =
    /substackcdn\.com/i.test(h) ||
    /\bdata-page\s*=\s*["'][^"']+/i.test(h) ||
    /failed\s+to\s+load\s+posts/i.test(h) ||
    /enable-javascript\.com/i.test(h) ||
    /requires\s+java\s*script/i.test(h)

  const looksHuge = h.length > 5_000_000
  const includeImages = isSubstackLike ? true : looksHuge ? false : args.includeImages
  const fidelityLevel = (isSubstackLike ? 4 : looksHuge ? 2 : args.fidelityLevel) as 1 | 2 | 3 | 4
  const defaultView = (isSubstackLike ? 'markdown' : args.defaultView) as WebpageViewMode

  const shouldConvertToMarkdown =
    args.forceConvertToMarkdown ||
    args.mode !== 'refresh' ||
    isSubstackLike ||
    args.isWeChat ||
    (defaultView === 'markdown' && args.mode === 'refresh')

  const shouldFallbackToPlainText = shouldConvertToMarkdown && defaultView === 'markdown'
  return { isSubstackLike, includeImages, fidelityLevel, defaultView, shouldConvertToMarkdown, shouldFallbackToPlainText }
}

async function fetchWorkspaceUrlContentImpl(rawUrl: string, opts?: FetchWorkspaceUrlContentOpts): Promise<WorkspaceUrlContent> {
  const cleaned = unwrapUserProvidedText(String(rawUrl || '').trim()) || String(rawUrl || '').trim()
  if (!cleaned) throw new Error('Invalid URL')

  const normalizedUrl = normalizeGitHubBlobLikeUrl(cleaned) ?? cleaned
  const normalizedLower = normalizedUrl.toLowerCase()

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
      text: String(converted.markdown || ''),
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
        view: 'markdown',
        diag: apiNative.diagnostics,
      })
      return {
        normalizedUrl: apiNative.normalizedUrl,
        name: apiNative.name,
        text,
      }
    }
  }

  const looksLikeCodeOrData = /\.(json|jsonld|geojson|csv|yaml|yml|txt|js|ts|py|md|markdown|mdx|svg)(\?|#|$)/i.test(normalizedLower)
  const looksLikeLocalHtml = isLocalRepoPath && /\.(html|htm)(\?|#|$)/i.test(normalizedLower)
  if (!looksLikeCodeOrData) {
    const base = deriveFilenameFromUrl(normalizedUrl, 'webpage')
    const baseNoExt = base.replace(/\.[a-z0-9]+$/i, '') || 'webpage'
    const name = `${baseNoExt}.md`

    const mode: FetchMode = opts?.mode === 'refresh' ? 'refresh' : 'import'
    const viewHint: WebpageViewMode | '' =
      opts?.viewHint === 'markdown' ? 'markdown' : opts?.viewHint === 'json' ? 'json' : opts?.viewHint === 'html' ? 'html' : ''
    const looksLikeSubstackUrl = shouldTreatAsSubstackUrl(normalizedUrl)

    if (mode === 'import' && !looksLikeSubstackUrl) {
      const view: WebpageViewMode = viewHint || 'html'
      const shouldSkipHydration = view === 'markdown' && shouldSkipHydrationForMarkdownStub(normalizedUrl)
      const body = (() => {
        if (view !== 'markdown') return `[](${normalizedUrl})\n`
        const hint = shouldSkipHydration
          ? 'This page likely requires a logged-in session. Import runs without your browser cookies, so content may be unavailable.'
          : 'Fetching content in background…'
        return [`[](${normalizedUrl})`, '', hint, ''].join('\n')
      })()
      return {
        normalizedUrl,
        name,
        text: [
          '---',
          `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`,
          `kgWebpageView: ${yamlQuote(view)}`,
          shouldSkipHydration ? `kgWebpageHydrate: ${yamlQuote('false')}` : null,
          '---',
          '',
          body.trimEnd(),
          '',
        ]
          .filter(Boolean)
          .join('\n'),
      }
    }

    const ctrl = new AbortController()
    const ticker = opts?.onProgress
      ? createProgressTicker({ onProgress: opts.onProgress, intervalMs: 300, maxPercentage: 90, maxStepPercentage: 15 })
      : null

    let includeImages = true
    let defaultView: WebpageViewMode = opts?.viewHint === 'markdown' ? 'markdown' : 'html'
    let fidelityLevel: 1 | 2 | 3 | 4 = 4
    let lastFetchedHtml = ''
    let lastDomDiag = ''
    let lastDomTitle = ''
    let shouldConvertToMarkdown = false
    let shouldFallbackToPlainText = false
    try {
      ticker?.start()

      const store = useGraphStore.getState()
      includeImages = store.webpageImportIncludeImages !== false
      defaultView = (opts?.viewHint === 'markdown' ? 'markdown' : opts?.viewHint === 'json' ? 'json' : mode === 'refresh' ? 'html' : store.webpageImportView) as WebpageViewMode
      fidelityLevel = (() => {
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
        if (mode !== 'refresh' && !looksLikeSubstackUrl) {
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

        try {
          if (shouldConvertToMarkdown) {
            const converted = await fetchWebpageMarkdown(normalizedUrl, { includeImages })
            if (converted && converted.ok === true && typeof converted.markdown === 'string') return String(converted.markdown || '')
          }
        } catch {
          void 0
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

        const markdown = await (async () => {
          if (forceConvertToMarkdown && shouldSkipUnifiedMarkdownConversion(boundedHtml)) {
            try {
              const clipped = boundedHtml.length > 1_500_000 ? boundedHtml.slice(0, 1_500_000) : boundedHtml
              return htmlFallbackToMarkdownAllText(clipped)
            } catch {
              return ''
            }
          }
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
            if (converted.ok === true && converted.markdown.trim()) return normalizeWebpageCardAndListBlocks(converted.markdown)
          } catch {
            void 0
          }
          return ''
        })()
        opts?.onProgress?.(85)
        if (markdown.trim()) return markdown.trim()

        if (!tuned.shouldFallbackToPlainText) return ''

        return await runInIdle(async () => htmlFallbackToMarkdownAllText(boundedHtml), { timeoutMs: 900 })
      })()

      ticker?.stop()
      opts?.onProgress?.(95)

      const clipped = clipLargeWebpageMarkdown(upstreamMarkdown)
      const text = await runInIdle(
        () =>
          buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
            upstreamMarkdown: clipped.text,
            url: normalizedUrl,
            view: defaultView,
            title: lastDomTitle,
            diag: clipped.clipped ? [String(lastDomDiag || '').trim(), `clipped: ${WORKSPACE_WEBPAGE_MARKDOWN_MAX_CHARS}`].filter(Boolean).join('\n') : lastDomDiag,
            fidelityLevel,
            includeImages,
          }),
        { timeoutMs: 120 },
      )
      opts?.onProgress?.(100)
      if (text && text.trim() && !isFrontmatterOnlyDoc(text)) return { normalizedUrl, name, text }

      const minimal = ['---', `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`, `kgWebpageView: ${yamlQuote(defaultView)}`, '---', '', String(upstreamMarkdown || '').trim(), ''].join('\n')
      if (minimal.trim() && !isFrontmatterOnlyDoc(minimal)) return { normalizedUrl, name, text: minimal }
    } catch {
      if (mode === 'refresh') {
        const recoveredBody = lastFetchedHtml && shouldFallbackToPlainText ? htmlFallbackToMarkdownAllText(lastFetchedHtml) : ''
        const recovered = ['---', `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`, `kgWebpageView: ${yamlQuote(defaultView)}`, '---', '', recoveredBody.trim(), ''].join('\n')
        if (recovered.trim() && !isFrontmatterOnlyDoc(recovered)) return { normalizedUrl, name, text: recovered }
      }
    } finally {
      ticker?.stop()
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }

    const text = ['---', `kgWebpageUrl: ${yamlQuote(normalizedUrl)}`, `kgWebpageView: ${yamlQuote('html')}`, '---', ''].join('\n')
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
      const text = ['---', `kgWebpageUrl: ${yamlQuote(localRepoPath)}`, `kgWebpageView: ${yamlQuote('html')}`, localSiteRootRel ? `kgWebpageSiteRootRel: ${yamlQuote(localSiteRootRel)}` : null, '---', '']
        .filter(Boolean)
        .join('\n')
      return { normalizedUrl: localSourceUrl, name, text }
    }

    opts?.onProgress?.(10)
    const fetchPath = localFsFetchPath || buildRepoFilePath(localRepoPath)
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
  const key = `${mode}:${viewHint}:${normalizedUrl}`

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
