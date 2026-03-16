import React from 'react'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { runInIdle } from '@/features/panels/utils/idle'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  buildCodeViewerSrcdoc,
  buildWebpageHtmlSrcdocAsync,
  fetchWebpageConversionJsonViaConvert,
  fetchWebpageHtmlAuto,
  fetchWebsiteImportArtifact,
} from '@/lib/websites/webpageIframeSrcdoc'
import { inferIframeScriptPolicyFromHtml, isHttpUrl } from '@/lib/url'
import { getOrCreateWebpageSandboxBlobUrl } from '@/lib/websites/webpageSandboxBlobUrlCache'

export function useWebpageIframeSrcdoc(args: {
  enabled: boolean
  url: string
  view: 'html' | 'json'
  websiteImportMeta: { importId: string; nodeId: string; outputDirRel?: string } | null
  includeImages?: boolean
  htmlOverride?: string | null
  siteRootRel?: string | null
  onStatusProgress?: (label: string, current?: number | null, total?: number | null, bytesCurrent?: number | null, bytesTotal?: number | null) => void
  onStatusWithAutoClear?: (label: string, ttlMs?: number) => void
}): { srcDoc: string | null; src: string | null; error: string | null } {
  const [state, setState] = React.useState<{ srcDoc: string | null; src: string | null; error: string | null }>({
    srcDoc: null,
    src: null,
    error: null,
  })

  const loopGuardRef = React.useRef<{ key: string; count: number; sinceMs: number }>({ key: '', count: 0, sinceMs: 0 })

  const onStatusProgressRef = React.useRef(args.onStatusProgress)
  const onStatusWithAutoClearRef = React.useRef(args.onStatusWithAutoClear)
  React.useEffect(() => {
    onStatusProgressRef.current = args.onStatusProgress
    onStatusWithAutoClearRef.current = args.onStatusWithAutoClear
  }, [args.onStatusProgress, args.onStatusWithAutoClear])

  const debouncedUrl = useDebouncedValue(args.url, 120, args.enabled)
  const debouncedHtmlOverride = useDebouncedValue(args.htmlOverride ?? null, 250, args.enabled)

  React.useEffect(() => {
    const loopKey = [
      args.enabled ? '1' : '0',
      String(args.view || ''),
      String(debouncedUrl || '').trim(),
      String(args.siteRootRel || ''),
      String(args.websiteImportMeta?.importId || ''),
      String(args.websiteImportMeta?.nodeId || ''),
      String(args.websiteImportMeta?.outputDirRel || ''),
      args.includeImages == null ? 'inherit' : (args.includeImages ? 'on' : 'off'),
      typeof debouncedHtmlOverride === 'string' ? String(debouncedHtmlOverride.length) : 'null',
    ].join('|')
    try {
      const now = Date.now()
      if (loopGuardRef.current.key === loopKey && now - loopGuardRef.current.sinceMs < 1500) {
        loopGuardRef.current.count += 1
      } else {
        loopGuardRef.current.key = loopKey
        loopGuardRef.current.count = 1
        loopGuardRef.current.sinceMs = now
      }
      if (loopGuardRef.current.count > 24) {
        return
      }
    } catch {
      void 0
    }

    if (!args.enabled) {
      setState(prev => (prev.srcDoc === null && prev.src === null && prev.error === null ? prev : { srcDoc: null, src: null, error: null }))
      return
    }
    const url = String(debouncedUrl || '').trim()
    if (!url) {
      setState(prev => (prev.srcDoc === null && prev.src === null && prev.error === null ? prev : { srcDoc: null, src: null, error: null }))
      return
    }

    let cancelled = false
    const ctrl = new AbortController()
    const includeImages = args.includeImages ?? (useGraphStore.getState().webpageImportIncludeImages !== false)
    const richMediaPanelMode = useGraphStore.getState().richMediaPanelMode
    const preferEmbed = richMediaPanelMode === 'embed'

    void (async () => {
      onStatusProgressRef.current?.('Updating view')
      if (args.view === 'json') {
        onStatusProgressRef.current?.('Loading JSON')
        const rawJson = await (async () => {
          if (args.websiteImportMeta) {
            try {
              const t = await fetchWebsiteImportArtifact({
                importId: args.websiteImportMeta.importId,
                nodeId: args.websiteImportMeta.nodeId,
                outputDirRel: args.websiteImportMeta.outputDirRel,
                kind: 'conversionJson',
                signal: ctrl.signal,
              })
              if (t && t.trim()) return t
            } catch {
              void 0
            }
          }
          return await fetchWebpageConversionJsonViaConvert({
            url,
            includeImages,
            signal: ctrl.signal,
          })
        })()

        onStatusProgressRef.current?.('Rendering JSON')
        const pretty = await runInIdle(() => {
          const t = String(rawJson || '')
          if (t.length > 900_000) {
            return `${t.slice(0, 900_000)}\n\n…(clipped ${t.length - 900_000} chars)…`
          }
          try {
            const parsed = JSON.parse(t) as unknown
            return JSON.stringify(parsed, null, 2)
          } catch {
            return t
          }
        }, { timeoutMs: 50 })
        return buildCodeViewerSrcdoc({ baseHref: url, title: url, mode: 'json', text: pretty })
      }

      const override = typeof debouncedHtmlOverride === 'string' && debouncedHtmlOverride.trim() ? debouncedHtmlOverride : null

      onStatusProgressRef.current?.('Loading HTML')
      const rawHtml = await (async () => {
        if (override) return override
        if (args.websiteImportMeta) {
          try {
            return await fetchWebsiteImportArtifact({
              importId: args.websiteImportMeta.importId,
              nodeId: args.websiteImportMeta.nodeId,
              outputDirRel: args.websiteImportMeta.outputDirRel,
              kind: 'rawHtml',
              signal: ctrl.signal,
            })
          } catch {
            void 0
          }
        }
        return await fetchWebpageHtmlAuto({
          url,
          signal: ctrl.signal,
          onProgress: (bytes, bytesTotal) => {
            try {
              onStatusProgressRef.current?.('Loading HTML', null, null, bytes, bytesTotal ?? null)
            } catch {
              void 0
            }
          },
        })
      })()

      const scriptPolicy = preferEmbed ? 'allow' : inferIframeScriptPolicyFromHtml(rawHtml)

      if (args.view === 'html' && override == null && !args.websiteImportMeta && isHttpUrl(url)) {
        const nextSrc = `/__webpage_proxy?url=${encodeURIComponent(url)}&kg_script_policy=${encodeURIComponent(scriptPolicy)}`
        return { kind: 'proxy' as const, src: nextSrc }
      }
      const siteRootRel = String(args.siteRootRel || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
      const localDirRel = (() => {
        const normalized = url.split(/[?#]/)[0].replace(/\\/g, '/').replace(/^\/+/, '')
        const parts = normalized.split('/').filter(Boolean)
        if (parts.length <= 1) return ''
        return parts.slice(0, -1).join('/')
      })()
      const encodePathForUrl = (rel: string): string =>
        String(rel || '')
          .replace(/\\/g, '/')
          .split('/')
          .filter(Boolean)
          .map(seg => encodeURIComponent(seg))
          .join('/')
      const origin = (() => {
        try {
          return typeof window !== 'undefined' && window.location && typeof window.location.origin === 'string' ? window.location.origin : ''
        } catch {
          return ''
        }
      })()
      const baseHref = /^https?:\/\//i.test(url)
        ? url
        : origin
          ? `${origin}/__repo_file/${encodePathForUrl(localDirRel || siteRootRel || '')}${(localDirRel || siteRootRel) ? '/' : ''}`
          : 'https://example.invalid/'

      const htmlPreprocessed = (() => {
        if (!origin) return rawHtml
        if (/^https?:\/\//i.test(url)) return rawHtml
        const root = siteRootRel || localDirRel
        if (!root) return rawHtml
        if (!/(\b(src|href)\s*=\s*(["'])\s*\/(?!\/))|url\(\s*\/(?!\/)/i.test(rawHtml)) return rawHtml
        const rootBase = `${origin}/__repo_file/${encodePathForUrl(root)}/`
        let next = rawHtml
        next = next.replace(/\b(src|href)\s*=\s*(["'])\s*\/(?!\/)/gi, (_m, a: string, q: string) => `${a}=${q}${rootBase}`)
        next = next.replace(/url\(\s*\/(?!\/)/gi, `url(${rootBase}`)
        return next
      })()

      onStatusProgressRef.current?.('Rendering HTML')
      const built = await runInIdle(
        () => buildWebpageHtmlSrcdocAsync({
          html: htmlPreprocessed,
          baseHref,
          scriptPolicy,
          onProgress: (step) => {
            try {
              onStatusProgressRef.current?.(`Sanitizing HTML: ${step}`)
            } catch {
              void 0
            }
          },
        }),
        { timeoutMs: 50 },
      )
      return { url, scriptPolicy, built }
    })()
      .then((res) => {
        if (cancelled) return
        if (res && typeof res === 'object' && 'kind' in res && (res as { kind?: unknown }).kind === 'proxy') {
          const nextSrc = String((res as { src?: unknown }).src || '')
          setState(prev => (prev.srcDoc === null && prev.src === nextSrc && prev.error === null ? prev : { srcDoc: null, src: nextSrc, error: null }))
          onStatusWithAutoClearRef.current?.('Updated', 1200)
          return
        }
        if (typeof res === 'string') {
          const srcDoc = res
          setState(prev => (prev.srcDoc === srcDoc && prev.src === null && prev.error === null ? prev : { srcDoc, src: null, error: null }))
          onStatusWithAutoClearRef.current?.('Updated', 1200)
          return
        }
        const blobKey = `webpage:${res.url}:view:${args.view}:policy:${res.scriptPolicy}:override:${typeof debouncedHtmlOverride === 'string' ? debouncedHtmlOverride.length : 0}`
        const blobUrl = res.built.tooLargeForSrcdoc ? getOrCreateWebpageSandboxBlobUrl({ key: blobKey, html: res.built.html }) : ''
        const nextSrc = res.built.tooLargeForSrcdoc && blobUrl ? blobUrl : null
        const nextSrcDoc = nextSrc ? null : res.built.html
        setState(prev =>
          prev.srcDoc === nextSrcDoc && prev.src === nextSrc && prev.error === null ? prev : { srcDoc: nextSrcDoc, src: nextSrc, error: null },
        )
        onStatusWithAutoClearRef.current?.('Updated', 1200)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : ''
        const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name || '') : ''
        const abortLike = ctrl.signal.aborted || name === 'AbortError' || /aborted/i.test(msg)
        if (abortLike) {
          onStatusWithAutoClearRef.current?.('Cancelled', 800)
          return
        }
        const fallback = buildCodeViewerSrcdoc({ baseHref: url, title: url, mode: 'text', text: msg || 'Request failed' })
        setState(prev =>
          prev.srcDoc === fallback && prev.src === null && prev.error === (msg || 'Request failed')
            ? prev
            : { srcDoc: fallback, src: null, error: msg || 'Request failed' },
        )
      })

    return () => {
      cancelled = true
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }
  }, [
    args.enabled,
    debouncedHtmlOverride,
    debouncedUrl,
    args.view,
    args.siteRootRel,
    args.includeImages,
    args.websiteImportMeta?.importId,
    args.websiteImportMeta?.nodeId,
    args.websiteImportMeta?.outputDirRel,
  ])

  return state
}
