import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import {
  extractAttr,
  getYouTubeId,
  isSafeHref,
  isSafeMediaSrc,
  looksLikeSingleTagBlock,
} from '@/features/markdown/ui/markdownPreviewLinks'
import { extractEmbeddedGeoJsonFeatureCollections } from '@/lib/markdown/embeddedGeoJson'
import { readMarkdownSlideDemo } from '@/tests/lib/markdownSlideDemo'
import { slugify } from 'grph-shared/markdown/slugify'

export function testMarkdownSlideDemoParsesMediaAndGeo() {
  const presentationSource = readFileSync(resolve(process.cwd(), 'src/features/markdown/ui/markdownPresentationSlides.tsx'), 'utf8')
  if (!presentationSource.includes("MARKDOWN_PRESENTATION_TWO_COLUMN_GRID_CLASS_NAME = 'w-full h-full grid min-w-0 grid-cols-2 gap-8'") || !presentationSource.includes("MARKDOWN_PRESENTATION_PREVIEW_TWO_COLUMN_GRID_CLASS_NAME = 'w-full h-full grid min-w-0 grid-cols-2 gap-2'") || presentationSource.includes('w-full h-full grid grid-cols-2 gap-8') || presentationSource.includes('w-full h-full grid grid-cols-2 gap-2')) {
    throw new Error('expected markdown presentation two-column slide layouts to use named fixed-format grid owners')
  }
  const text = readMarkdownSlideDemo()
  if (!text) return
  const { tokens } = lexMarkdown(text)
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('Expected non-empty markdown tokens')
  }

  const collectLinkHrefs = (list: unknown[]): string[] => {
    const out: string[] = []
    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      const anyNode = node as { type?: unknown; href?: unknown; tokens?: unknown; items?: unknown; rows?: unknown; header?: unknown }
      if (anyNode.type === 'link' && typeof anyNode.href === 'string') {
        out.push(anyNode.href)
      }
      const tokensAny = anyNode.tokens
      if (Array.isArray(tokensAny)) {
        for (const t of tokensAny) visit(t)
      }
      const itemsAny = anyNode.items
      if (Array.isArray(itemsAny)) {
        for (const it of itemsAny) {
          const itAny = it as { tokens?: unknown }
          if (Array.isArray(itAny?.tokens)) {
            for (const t of itAny.tokens) visit(t)
          }
        }
      }
      const headerAny = anyNode.header
      if (Array.isArray(headerAny)) {
        for (const cell of headerAny) {
          const cellAny = cell as { tokens?: unknown }
          if (Array.isArray(cellAny?.tokens)) {
            for (const t of cellAny.tokens) visit(t)
          }
        }
      }
      const rowsAny = anyNode.rows
      if (Array.isArray(rowsAny)) {
        for (const row of rowsAny) {
          if (!Array.isArray(row)) continue
          for (const cell of row) {
            const cellAny = cell as { tokens?: unknown }
            if (Array.isArray(cellAny?.tokens)) {
              for (const t of cellAny.tokens) visit(t)
            }
          }
        }
      }
    }
    for (const t of list) visit(t)
    return out
  }

  const hrefs = collectLinkHrefs(tokens as unknown as unknown[])
  const expectedHeadingHref = `#${slugify('Phase 1 Input (Mermaid S1)')}`
  if (!hrefs.includes(expectedHeadingHref)) {
    throw new Error(`Expected wikilink heading href ${expectedHeadingHref}`)
  }
  const blockHrefCandidates = new Set(['#^mermaid-s2-decide', '#%5Emermaid-s2-decide'])
  if (!hrefs.some(h => blockHrefCandidates.has(h))) {
    throw new Error('Expected block wikilink href for ^mermaid-s2-decide')
  }

  const hasGeoJsonFence = tokens.some(t => {
    const anyTok = t as unknown as { type?: unknown; lang?: unknown; info?: unknown }
    if (anyTok.type !== 'code') return false
    const lang = String(anyTok.lang || anyTok.info || '').trim().toLowerCase()
    return lang === 'geojson'
  })
  if (!hasGeoJsonFence) {
    throw new Error('Expected demo markdown to produce at least one geojson fenced code token')
  }

  const urls = Array.from(text.matchAll(/https?:\/\/[^\s)\]]+/gi)).map(m => String(m[0] || '').trim()).filter(Boolean)
  const ytUrls = urls.filter(u => u.includes('youtube.com') || u.includes('youtu.be'))
  for (const url of ytUrls) {
    const id = getYouTubeId(url)
    if (!id) throw new Error(`Expected YouTube ID for ${url}`)
  }

  const iframeBlock = (() => {
    const full = text.match(/<iframe\b[\s\S]*?<\/iframe>/i)
    if (full && full[0]) return full[0]
    const single = text.match(/<iframe\b[^>]*\/?>/i)
    return single && single[0] ? single[0] : ''
  })()
  if (iframeBlock) {
    if (!looksLikeSingleTagBlock(iframeBlock, 'iframe')) {
      throw new Error('Expected iframe block to be a single tag block')
    }
    const iframeSrc = extractAttr(iframeBlock, 'src')
    const iframeSrcdoc = extractAttr(iframeBlock, 'srcdoc')
    if (iframeSrc) {
      if (!isSafeHref(iframeSrc) || !isSafeMediaSrc(iframeSrc)) {
        throw new Error('Expected iframe src to be safe')
      }
    } else if (iframeSrcdoc) {
      if (/<\s*script\b/i.test(iframeSrcdoc)) {
        throw new Error('Expected iframe srcdoc to be script-free')
      }
    } else {
      throw new Error('Expected iframe to have either src or srcdoc')
    }
  }

  const embedded = extractEmbeddedGeoJsonFeatureCollections(text)
  if (embedded.length === 0) {
    throw new Error('Expected demo markdown to include embedded GeoJSON FeatureCollection blocks')
  }
  for (const b of embedded) {
    const parsed = JSON.parse(b.geojsonText) as { type?: unknown }
    if (parsed.type !== 'FeatureCollection') throw new Error('Expected FeatureCollection')
  }
}
