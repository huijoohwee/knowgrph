import { saveBlobWithPicker, downloadBlob } from '@/lib/graph/save'
import type { UiToastInput } from '@/hooks/store/types'

export async function exportHtmlViewerSnapshot(args: {
  exportBaseName: string
  showWebpageHtml: boolean
  iframeSrcDoc: string | null
  viewerEl: HTMLElement | null
  viewerRefCurrent: HTMLElement | null
  pushUiToast: (toast: UiToastInput) => void
}): Promise<void> {
  try {
    const MAX_INLINE_ASSET_BYTES = 25 * 1024 * 1024
    const assetCache = new Map<string, string | null>()

    const blobToDataUrl = async (blob: Blob): Promise<string> => {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Failed to read blob.'))
        reader.readAsDataURL(blob)
      })
    }

    const tryInlineUrlAsData = async (url: string): Promise<string | null> => {
      try {
        const cached = assetCache.get(url)
        if (cached !== undefined) return cached
        const resp = await fetch(url)
        if (!resp.ok) {
          assetCache.set(url, null)
          return null
        }
        const len = Number(resp.headers.get('content-length') || '')
        if (Number.isFinite(len) && len > 0 && len > MAX_INLINE_ASSET_BYTES) {
          assetCache.set(url, null)
          return null
        }
        const blob = await resp.blob()
        if (blob.size > MAX_INLINE_ASSET_BYTES) {
          assetCache.set(url, null)
          return null
        }
        const dataUrl = await blobToDataUrl(blob)
        if (!dataUrl.startsWith('data:')) return null
        assetCache.set(url, dataUrl)
        return dataUrl
      } catch {
        return null
      }
    }

    const inlineUrlString = async (rawUrl: string, baseUrl: string): Promise<string | null> => {
      try {
        const u = String(rawUrl || '').trim()
        if (!u) return null
        if (u.startsWith('data:') || u.startsWith('blob:')) return null
        if (u.startsWith('#')) return null
        if (/^javascript:/i.test(u)) return null
        const abs = new URL(u, baseUrl).toString()
        return await tryInlineUrlAsData(abs)
      } catch {
        return null
      }
    }

    const inlineImagesInElement = async (root: HTMLElement): Promise<void> => {
      const imgs = Array.from(root.querySelectorAll('img[src]')) as HTMLImageElement[]
      for (const img of imgs) {
        try {
          const src = String(img.getAttribute('src') || '').trim()
          if (!src) continue
          if (src.startsWith('data:') || src.startsWith('blob:')) continue
          const dataUrl = await inlineUrlString(src, window.location.href)
          if (!dataUrl) continue
          img.setAttribute('src', dataUrl)
          img.removeAttribute('srcset')
          img.removeAttribute('sizes')
        } catch {
          void 0
        }
      }
    }

    const inlineMediaInElement = async (root: HTMLElement): Promise<void> => {
      const media = Array.from(root.querySelectorAll('video,audio')) as Array<HTMLVideoElement | HTMLAudioElement>
      for (const el of media) {
        try {
          const src = String(el.getAttribute('src') || '').trim()
          if (src) {
            const dataUrl = await inlineUrlString(src, window.location.href)
            if (dataUrl) el.setAttribute('src', dataUrl)
          }
        } catch {
          void 0
        }
      }

      const sources = Array.from(root.querySelectorAll('source[src]')) as HTMLSourceElement[]
      for (const s of sources) {
        try {
          const src = String(s.getAttribute('src') || '').trim()
          if (!src) continue
          const dataUrl = await inlineUrlString(src, window.location.href)
          if (!dataUrl) continue
          s.setAttribute('src', dataUrl)
        } catch {
          void 0
        }
      }

      const videos = Array.from(root.querySelectorAll('video[poster]')) as HTMLVideoElement[]
      for (const v of videos) {
        try {
          const poster = String(v.getAttribute('poster') || '').trim()
          if (!poster) continue
          const dataUrl = await inlineUrlString(poster, window.location.href)
          if (!dataUrl) continue
          v.setAttribute('poster', dataUrl)
        } catch {
          void 0
        }
      }
    }

    const rewriteCssUrls = async (cssText: string, baseUrl: string): Promise<string> => {
      const raw = String(cssText || '')
      if (!raw.trim()) return raw
      const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi
      const unique = new Set<string>()
      let m: RegExpExecArray | null = null
      while ((m = re.exec(raw))) {
        const u = String(m[2] || '').trim()
        if (!u) continue
        if (u.startsWith('data:') || u.startsWith('blob:')) continue
        if (u.startsWith('#')) continue
        if (/^javascript:/i.test(u)) continue
        try {
          unique.add(new URL(u, baseUrl).toString())
        } catch {
          void 0
        }
      }
      if (!unique.size) return raw
      const mapping = new Map<string, string>()
      for (const abs of unique) {
        const dataUrl = await tryInlineUrlAsData(abs)
        if (!dataUrl) continue
        mapping.set(abs, dataUrl)
      }
      if (!mapping.size) return raw
      return raw.replace(re, (_whole, quote: string, u: string) => {
        try {
          const abs = new URL(String(u || '').trim(), baseUrl).toString()
          const rep = mapping.get(abs)
          if (!rep) return _whole
          const q = quote || '"'
          return `url(${q}${rep}${q})`
        } catch {
          return _whole
        }
      })
    }

    const inlineCssInElement = async (root: HTMLElement): Promise<void> => {
      const styles = Array.from(root.querySelectorAll('style')) as HTMLStyleElement[]
      for (const s of styles) {
        try {
          const t = String(s.textContent || '')
          if (!t.trim()) continue
          const next = await rewriteCssUrls(t, window.location.href)
          if (next !== t) s.textContent = next
        } catch {
          void 0
        }
      }
      const styled = Array.from(root.querySelectorAll('[style]')) as HTMLElement[]
      for (const el of styled) {
        try {
          const style = String(el.getAttribute('style') || '')
          if (!style.includes('url(')) continue
          const next = await rewriteCssUrls(style, window.location.href)
          if (next !== style) el.setAttribute('style', next)
        } catch {
          void 0
        }
      }
    }

    const inlineScriptsInElement = async (root: HTMLElement): Promise<void> => {
      const scripts = Array.from(root.querySelectorAll('script[src]')) as HTMLScriptElement[]
      for (const s of scripts) {
        try {
          const src = String(s.getAttribute('src') || '').trim()
          if (!src) continue
          const abs = new URL(src, window.location.href)
          if (abs.origin !== window.location.origin) continue
          const resp = await fetch(abs.toString())
          if (!resp.ok) continue
          const len = Number(resp.headers.get('content-length') || '')
          if (Number.isFinite(len) && len > 0 && len > MAX_INLINE_ASSET_BYTES) continue
          const js = String(await resp.text())
          if (!js.trim()) continue
          s.removeAttribute('src')
          s.textContent = js
        } catch {
          void 0
        }
      }
    }

    const buildCssVarsStyle = (prefixes: string[]): string => {
      try {
        const cs = window.getComputedStyle(document.documentElement)
        const out: string[] = []
        for (let i = 0; i < cs.length; i++) {
          const k = cs.item(i)
          if (!k || !k.startsWith('--')) continue
          if (!prefixes.some(p => k.startsWith(p))) continue
          const v = cs.getPropertyValue(k)
          if (!v || !v.trim()) continue
          out.push(`${k}:${v.trim()}`)
        }
        if (!out.length) return ''
        return `:root{${out.join(';')}}`
      } catch {
        return ''
      }
    }

    const collectDocumentCss = (): {
      inlineCssChunks: Array<{ cssText: string; baseUrl: string }>
      externalLinks: Array<{ href: string; outerHtml: string }>
    } => {
      const inlineCssChunks: Array<{ cssText: string; baseUrl: string }> = []
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules
          const parts: string[] = []
          for (const rule of Array.from(rules)) parts.push(rule.cssText)
          const cssText = parts.join('\n')
          if (!cssText.trim()) continue
          const baseUrl = sheet.href ? new URL(sheet.href, window.location.href).toString() : window.location.href
          inlineCssChunks.push({ cssText, baseUrl })
        } catch {
          void 0
        }
      }

      const links = Array.from(document.head.querySelectorAll('link[rel="stylesheet"][href]')) as HTMLLinkElement[]
      const externalLinks = links
        .filter(link => {
          try {
            const sheet = link.sheet as CSSStyleSheet | null
            if (!sheet) return true
            void sheet.cssRules
            return false
          } catch {
            return true
          }
        })
        .map(link => ({ href: String(link.getAttribute('href') || ''), outerHtml: link.outerHTML }))

      return { inlineCssChunks, externalLinks }
    }

    if (args.showWebpageHtml) {
      const s = String(args.iframeSrcDoc || '').trim()
      if (!s) {
        args.pushUiToast({ id: 'export-html-missing-view', kind: 'warning', message: 'Open the Viewer to export HTML.' })
        return
      }
      const isFullDoc = /<html[\s>]/i.test(s) || /<!doctype[\s>]/i.test(s)
      const html =
        isFullDoc && s.trim()
          ? s
          : [
              '<!doctype html>',
              '<html lang="en">',
              '<head>',
              '  <meta charset="utf-8" />',
              '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
              `  <title>${args.exportBaseName}</title>`,
              '</head>',
              '<body>',
              s,
              '</body>',
              '</html>',
              '',
            ].join('\n')
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const name = `${args.exportBaseName}.html`
      const saved = await saveBlobWithPicker(blob, name, { description: 'HTML Files', accept: { 'text/html': ['.html'] } })
      if (saved === '') return
      if (!saved) downloadBlob(blob, name)
      return
    }

    const root = args.viewerEl || args.viewerRefCurrent
    if (!root) {
      args.pushUiToast({ id: 'export-html-missing-view', kind: 'warning', message: 'Open the Viewer to export HTML.' })
      return
    }
    const previewRoot = (root.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null) || root
    const article = (previewRoot.querySelector('article') as HTMLElement | null) || previewRoot
    const cloned = article.cloneNode(true) as HTMLElement
    await inlineImagesInElement(cloned)
    await inlineMediaInElement(cloned)
    await inlineCssInElement(cloned)
    await inlineScriptsInElement(cloned)
    const bodyHtml = cloned.outerHTML

    const htmlClass = String(document.documentElement.className || '').trim()
    const { inlineCssChunks, externalLinks } = collectDocumentCss()
    const fetchedExternalCss: Array<{ cssText: string; baseUrl: string }> = []
    const externalLinkTags: string[] = []
    for (const link of externalLinks) {
      try {
        const href = String(link.href || '').trim()
        if (!href) continue
        const abs = new URL(href, window.location.href)
        const sameOrigin = abs.origin === window.location.origin
        if (!sameOrigin) {
          externalLinkTags.push(link.outerHtml)
          continue
        }
        const resp = await fetch(abs.toString())
        if (!resp.ok) {
          externalLinkTags.push(link.outerHtml)
          continue
        }
        const css = String(await resp.text())
        if (!css.trim()) continue
        fetchedExternalCss.push({ cssText: css, baseUrl: abs.toString() })
      } catch {
        externalLinkTags.push(link.outerHtml)
      }
    }

    const varsCss = buildCssVarsStyle(['--kg-'])
    const rewrittenExternal: string[] = []
    for (const chunk of fetchedExternalCss) {
      rewrittenExternal.push(await rewriteCssUrls(chunk.cssText, chunk.baseUrl))
    }
    const rewrittenInline: string[] = []
    for (const chunk of inlineCssChunks) {
      rewrittenInline.push(await rewriteCssUrls(chunk.cssText, chunk.baseUrl))
    }
    const combinedCss = [varsCss, ...rewrittenExternal, ...rewrittenInline].filter(Boolean).join('\n')
    const baseHref = (() => {
      try {
        const u = new URL(window.location.href)
        u.hash = ''
        return u.toString()
      } catch {
        return ''
      }
    })()

    const html = [
      '<!doctype html>',
      `<html lang="en"${htmlClass ? ` class="${htmlClass.replace(/"/g, '&quot;')}"` : ''}>`,
      '<head>',
      '  <meta charset="utf-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      `  <title>${args.exportBaseName}</title>`,
      baseHref ? `  <base href="${baseHref.replace(/"/g, '&quot;')}" />` : '',
      externalLinkTags.length ? `  ${externalLinkTags.join('\n  ')}` : '',
      combinedCss ? '  <style>' + combinedCss.replace(/<\/style>/g, '<\\/style>') + '</style>' : '',
      '</head>',
      '<body>',
      bodyHtml,
      '</body>',
      '</html>',
      '',
    ].join('\n')

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const name = `${args.exportBaseName}.html`
    const saved = await saveBlobWithPicker(blob, name, { description: 'HTML Files', accept: { 'text/html': ['.html'] } })
    if (saved === '') return
    if (!saved) downloadBlob(blob, name)
  } catch {
    void 0
  }
}

