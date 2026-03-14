import {
  parseMarkdownBlocks,
  parseMarkdownFrontmatter,
  splitMarkdownLines,
} from '@/lib/markdown'
import { normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { AGENTIC_RAG_SCHEMA_URL } from '@/lib/agenticrag'
import {
  slugify,
  extractMarkdownInlineRefs,
  extractBareHttpUrls,
  classifyMediaFromAltAndUrl,
} from './markdownJsonLdUtils'
import {
  mermaidDensityConfig,
  computeMermaidTreeSeparation,
} from './markdownJsonLdMermaid'
import {
  parseMermaidFrontmatter,
  MermaidParserContext,
} from './markdownJsonLdMermaidParser'
import { MarkdownGraphBuilder } from './markdownJsonLdBuilder'
import * as wikiLinks from 'grph-shared/markdown/wikiLinks'
import { normalizeMarkdownAsciiBlocks } from 'grph-shared/markdown/asciiBlocks'

export { slugify } from './markdownJsonLdUtils'

const buildMarkdownPipeTable = (args: { header?: string[]; rows?: string[][] }): string => {
  const header = (args.header || []).map(s => String(s || '').trim())
  const rows = (args.rows || []).map(r => (Array.isArray(r) ? r : []).map(s => String(s || '').trim()))
  const colCount = Math.max(
    header.length,
    rows.reduce((m, r) => Math.max(m, r.length), 0),
  )
  if (colCount <= 0) return ''

  const pad = (cells: string[]) => {
    const out = cells.slice(0, colCount)
    while (out.length < colCount) out.push('')
    return out
  }

  const headerRow = header.length ? pad(header) : new Array(colCount).fill('').map((_, i) => `Col ${i + 1}`)
  const divider = new Array(colCount).fill('---')
  const body = rows.map(pad)

  const render = (cells: string[]) => `| ${cells.map(c => String(c || '').trim()).join(' | ')} |`
  return [render(headerRow), render(divider), ...body.map(render)].join('\n')
}

export const buildMarkdownJsonLd = (name: string, markdownText: string): Record<string, unknown> => {
  const rawText = String(markdownText || '')
  const asciiNormalized = normalizeMarkdownAsciiBlocks(rawText)
  const normalizedText =
    asciiNormalized.includes('[[') || /(?:^|\s)\^[A-Za-z0-9]/m.test(asciiNormalized)
      ? (typeof wikiLinks.normalizeMarkdownWikiLinksAndBlockIds === 'function'
          ? wikiLinks.normalizeMarkdownWikiLinksAndBlockIds(asciiNormalized)
          : asciiNormalized)
      : asciiNormalized
  const rawLines = splitMarkdownLines(normalizedText)
  const { meta, startIndex } = parseMarkdownFrontmatter(rawLines)
  const blocks = parseMarkdownBlocks(rawLines, startIndex)

  const frontmatterNodeAnchorById = (() => {
    const out = new Map<string, string>()
    const metaRec = meta as unknown
    if (!metaRec || typeof metaRec !== 'object' || Array.isArray(metaRec)) return out
    const rec = metaRec as Record<string, unknown>
    const nodesRaw = rec.nodes
    if (!Array.isArray(nodesRaw)) return out
    for (let i = 0; i < nodesRaw.length; i += 1) {
      const row = nodesRaw[i]
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue
      const node = row as Record<string, unknown>
      const id = typeof node.id === 'string' ? node.id.trim() : ''
      if (!id) continue
      const propsRaw = node.properties
      if (!propsRaw || typeof propsRaw !== 'object' || Array.isArray(propsRaw)) continue
      const props = propsRaw as Record<string, unknown>
      const anchorRaw = props['doc:anchorId']
      const anchorId = typeof anchorRaw === 'string' ? anchorRaw.trim() : ''
      if (!anchorId) continue
      if (!out.has(id)) out.set(id, anchorId)
    }
    return out
  })()

  const mediaPoiImageUrlByName = (() => {
    const out = new Map<string, string>()
    const metaRec = meta as unknown
    const mediaRaw = metaRec && typeof metaRec === 'object' && !Array.isArray(metaRec) ? (metaRec as Record<string, unknown>).media : null
    if (!mediaRaw || typeof mediaRaw !== 'object' || Array.isArray(mediaRaw)) return out
    const poiImagesRaw = (mediaRaw as Record<string, unknown>).poi_images
    if (!Array.isArray(poiImagesRaw)) return out
    for (const item of poiImagesRaw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const rec = item as Record<string, unknown>
      const poi = typeof rec.poi === 'string' ? rec.poi.trim() : ''
      const url = typeof rec.url === 'string' ? rec.url.trim() : ''
      if (!poi || !url) continue
      const key = poi.toLowerCase()
      if (!out.has(key)) out.set(key, url)
    }
    return out
  })()

  const normalizedName = String(name || '').replace(/\\/g, '/').trim()
  const fmGraphId = String(meta.graphId || meta.graph_id || meta.graph || '').trim()
  const baseName = normalizedName.split('/').pop() || ''
  const stem = baseName.replace(/\.(md|markdown|mmd)$/i, '')
  const gid = fmGraphId || (stem ? `md:${slugify(stem)}` : 'md:x')

  const fmTitle = String(meta.title || '').trim()
  const title =
    fmTitle ||
    (() => {
      const h1 = blocks.find(b => b.kind === 'heading' && b.level === 1 && b.text.trim())
      return h1 && h1.kind === 'heading' ? h1.text.trim() : ''
    })() ||
    'Markdown Document'

  const sourceUrl = (() => {
    const fromName = /^https?:\/\//i.test(normalizedName) ? normalizedName : ''
    const fromFrontmatter = (() => {
      const rec = meta as unknown as Record<string, unknown>
      const candidates = [
        typeof rec.kgWebpageUrl === 'string' ? rec.kgWebpageUrl : '',
        typeof rec.sourceUrl === 'string' ? rec.sourceUrl : '',
        typeof rec.sourceFile === 'string' ? rec.sourceFile : '',
        typeof rec['source-file'] === 'string' ? (rec['source-file'] as string) : '',
      ]
      for (const c of candidates) {
        const u = String(c || '').trim()
        if (/^https?:\/\//i.test(u)) return u
      }
      return ''
    })()
    const raw = fromName || fromFrontmatter
    if (!raw) return ''
    const normalized = normalizeGitHubBlobLikeUrl(raw) || raw
    return /^https?:\/\//i.test(normalized) ? normalized : ''
  })()

  const documentPath = (() => {
    if (sourceUrl) return sourceUrl
    if (!normalizedName) return baseName
    const stripped = normalizedName.split('#')[0]?.split('?')[0]?.trim() || ''
    if (!stripped) return baseName
    const isAbsolutePosix = stripped.startsWith('/')
    const isAbsoluteWindows = /^[A-Za-z]:\//.test(stripped)
    return isAbsolutePosix || isAbsoluteWindows ? baseName : stripped
  })()
  const mkMeta = (startLine: number, endLine: number): Record<string, unknown> => ({
    documentPath,
    ...(sourceUrl ? { documentUrl: sourceUrl } : {}),
    lineStart: startLine,
    lineEnd: endLine,
  })

  const docId = `doc:${gid}`
  const builder = new MarkdownGraphBuilder({ gid, docId, sourceUrl, mkMeta })
  
  let mermaidTreeLayout: {
    orientation?: 'vertical' | 'horizontal'
    direction?: 'source-target' | 'target-source'
  } | null = null

  const docProps: Record<string, unknown> = { format: 'text/markdown', graphId: gid }
  if (documentPath) docProps.path = documentPath
  builder.createDocumentNode(title, `${title}\n\nSource: ${documentPath || baseName || 'inline'}`, docProps, mkMeta(1, Math.max(1, rawLines.length)))

  const mermaidRaw = typeof meta.mermaid === 'string' ? meta.mermaid : ''
  const mermaidCode = String(mermaidRaw || '').trim()
  const mermaidAnchorsOnlyRaw = (meta as Record<string, unknown>).mermaidAnchorsOnly
  const mermaidAnchorsOnly =
    typeof mermaidAnchorsOnlyRaw === 'boolean'
      ? mermaidAnchorsOnlyRaw
      : typeof mermaidAnchorsOnlyRaw === 'string'
      ? mermaidAnchorsOnlyRaw.trim().toLowerCase() === 'true'
      : false

  const mermaidDensityParts: string[] = []
  const trySetMermaidTreeLayoutFromCode = (code: string) => {
    if (mermaidTreeLayout) return
    const firstLine = String(code || '').split('\n')[0]?.trim() || ''
    if (!firstLine.startsWith('graph ') && !firstLine.startsWith('flowchart ')) return
    const parts = firstLine.split(/\s+/)
    const dir = parts[1]?.toUpperCase()
    if (!dir) return
    if (dir === 'TD' || dir === 'TB' || dir === 'DT') {
      mermaidTreeLayout = { orientation: 'vertical', direction: 'source-target' }
    } else if (dir === 'BT') {
      mermaidTreeLayout = { orientation: 'vertical', direction: 'target-source' }
    } else if (dir === 'LR') {
      mermaidTreeLayout = { orientation: 'horizontal', direction: 'source-target' }
    } else if (dir === 'RL') {
      mermaidTreeLayout = { orientation: 'horizontal', direction: 'target-source' }
    }
  }
  
  const splitMermaidIntoDiagrams = (code: string): Array<{ code: string; offset: number }> => {
    const lines = String(code || '').split('\n')
    const indices: number[] = []
    for (let i = 0; i < lines.length; i += 1) {
      const t = (lines[i] || '').trim()
      if (!t) continue
      if (t.startsWith('graph ') || t.startsWith('flowchart ')) {
        indices.push(i)
      }
    }
    if (indices.length <= 1) {
      return [{ code: String(code || ''), offset: 0 }]
    }
    const out: Array<{ code: string; offset: number }> = []
    for (let k = 0; k < indices.length; k += 1) {
      const start = indices[k]!
      const end = k + 1 < indices.length ? indices[k + 1]! : lines.length
      const slice = lines.slice(start, end).join('\n')
      if (!slice.trim()) continue
      out.push({ code: slice, offset: start })
    }
    return out.length > 0 ? out : [{ code: String(code || ''), offset: 0 }]
  }

  if (mermaidCode) {
    const diagrams = splitMermaidIntoDiagrams(mermaidCode)
    trySetMermaidTreeLayoutFromCode(diagrams[0]?.code || mermaidCode)

    let mermaidStartLine = 1
    for (let i = 0; i < startIndex; i++) {
      const line = rawLines[i] || ''
      if (line.trim().startsWith('mermaid:')) {
        if (line.includes('|') || line.includes('>')) {
          mermaidStartLine = i + 2
        } else {
          const afterKey = line.slice(line.indexOf('mermaid:') + 8).trim()
          if (afterKey) {
            mermaidStartLine = i + 1
          } else {
            mermaidStartLine = i + 2
          }
        }
        break
      }
    }

    for (let idx = 0; idx < diagrams.length; idx += 1) {
      const diagram = diagrams[idx]!
      mermaidDensityParts.push(diagram.code)
      const diagramStart = Math.max(1, mermaidStartLine + diagram.offset)
      const diagramLineCount = Math.max(1, diagram.code.split('\n').length)
      const diagramEnd = Math.max(diagramStart, diagramStart + diagramLineCount - 1)
      const mermaidId = idx === 0 ? `mermaid:${gid}:frontmatter` : `mermaid:${gid}:frontmatter:${idx + 1}`
      const mermaidName = idx === 0 ? 'Frontmatter Mermaid Diagram' : `Frontmatter Mermaid Diagram ${idx + 1}`
      builder.createMermaidNode(mermaidId, diagram.code, mkMeta(diagramStart, diagramEnd), mermaidName, { scope: 'frontmatter' })

      const parserCtx: MermaidParserContext = {
        gid,
        docId,
        diagramId: mermaidId,
        diagramScope: 'frontmatter',
        startIndex: diagramStart,
        ensureNode: (n) => builder.ensureNode(n),
        addRel: (s, k, t) => builder.addRel(s, k, t),
        mkMeta,
      }
      parseMermaidFrontmatter(diagram.code, parserCtx)
    }
  }

  const sectionStack: Array<{ level: number; id: string }> = []
  let currentSectionId: string = docId
  let lastBlockId: string | null = null
  const indexByParent = new Map<string, number>()
  let anchorsOnlyParagraphEmitted = false
  let currentAnchorId: string | null = null
  let pendingExplicitAnchorId: { id: string; line: number } | null = null
  let hasMermaidBlock = false

  const extractHtmlAnchorIds = (line: string): string[] => {
    const out: string[] = []
    const anchorRe = /<a\s+[^>]*id\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>\s*<\/a>/gi
    anchorRe.lastIndex = 0
    for (;;) {
      const match = anchorRe.exec(line)
      if (!match) break
      const anchorIdRaw = String(match[1] || match[2] || match[3] || '').trim()
      if (anchorIdRaw) out.push(anchorIdRaw)
    }
    return out
  }

  for (const b of blocks) {
    const scanStart = Math.max(1, b.startLine - 2)
    const scanEnd = Math.max(1, b.startLine - 1)
    for (let ln = scanStart; ln <= scanEnd; ln += 1) {
      const line = rawLines[ln - 1] ?? ''
      const ids = extractHtmlAnchorIds(line)
      for (const id of ids) {
        const anchorNodeId = `anchor:${gid}:${id}`
        builder.createAnchorNode(anchorNodeId, id, { anchorId: id, kind: 'html' }, mkMeta(ln, ln))
        pendingExplicitAnchorId = { id, line: ln }
      }
    }

    const isMermaidBlock =
      b.kind === 'code' &&
      (b.language === 'mermaid' ||
        b.language === 'mmd' ||
        b.language === 'graph' ||
        (String(b.language || '').trim() === '' &&
          (() => {
            const firstLine = String(b.text || '').split('\n')[0]?.trim() || ''
            return firstLine.startsWith('graph ') || firstLine.startsWith('flowchart ')
          })()))

    if (mermaidAnchorsOnly && !isMermaidBlock) {
      if (b.kind !== 'paragraph' || anchorsOnlyParagraphEmitted) continue
    }

    // Process Mermaid blocks to extract graph nodes
    if (isMermaidBlock) {
      hasMermaidBlock = true
      const diagrams = splitMermaidIntoDiagrams(b.text)
      for (let idx = 0; idx < diagrams.length; idx += 1) {
        const diagram = diagrams[idx]!
        mermaidDensityParts.push(diagram.code)
        trySetMermaidTreeLayoutFromCode(diagram.code)
        const diagramStart = Math.max(1, b.startLine + 1 + diagram.offset)
        const diagramLineCount = Math.max(1, diagram.code.split('\n').length)
        const diagramEnd = Math.max(diagramStart, diagramStart + diagramLineCount - 1)
        const mermaidId = `mermaid:${gid}:code:${b.startLine}:${idx + 1}`
        builder.createMermaidNode(mermaidId, diagram.code, mkMeta(diagramStart, diagramEnd), `Mermaid Diagram L${diagramStart}`, { scope: 'block' })

        const parserCtx: MermaidParserContext = {
          gid,
          docId,
          diagramId: mermaidId,
          diagramScope: 'block',
          startIndex: diagramStart,
          ensureNode: (n) => builder.ensureNode(n),
          addRel: (s, k, t) => builder.addRel(s, k, t),
          mkMeta,
        }
        parseMermaidFrontmatter(diagram.code, parserCtx)
      }
      
      // If we are in anchors-only mode, we might want to skip creating the CodeBlock node itself
      // to keep the graph clean (only semantic nodes).
      // However, if we want the "source" to be visible as a node, we should keep it.
      // Given "Anchors Only" usually means "Concept Map", we probably skip the container block.
      if (mermaidAnchorsOnly) {
        continue
      }
    }

    if (b.kind === 'heading') {
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1]!.level >= b.level) {
          sectionStack.pop()
        }
        const parentId = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1]!.id : docId
        const anchor = slugify(b.text)
        const secId = `sec:${gid}:${anchor}:${b.startLine}`
        const order = (indexByParent.get(parentId) || 0) + 1
        indexByParent.set(parentId, order)
        
        builder.createSectionNode(secId, b.text, { heading: b.text, level: b.level, anchor, order }, mkMeta(b.startLine, b.endLine), parentId)
        const headingAnchorNodeId = `anchor:${gid}:${anchor}`
        builder.createAnchorNode(headingAnchorNodeId, anchor, { anchorId: anchor, kind: 'heading' }, mkMeta(b.startLine, b.startLine))
        if (pendingExplicitAnchorId && Math.abs(pendingExplicitAnchorId.line - b.startLine) <= 2) {
          const explicitAnchorNodeId = `anchor:${gid}:${pendingExplicitAnchorId.id}`
          builder.addRel(explicitAnchorNodeId, 'pointsTo', headingAnchorNodeId)
          currentAnchorId = pendingExplicitAnchorId.id
        } else {
          currentAnchorId = anchor
        }
        pendingExplicitAnchorId = null
        
        builder.setNext(lastBlockId, secId)
        lastBlockId = secId
        sectionStack.push({ level: b.level, id: secId })
        currentSectionId = secId
        continue
      }

      const parentId = currentSectionId || docId
      const order = (indexByParent.get(parentId) || 0) + 1
      indexByParent.set(parentId, order)

      if (b.kind === 'paragraph') {
        const id = `blk:${gid}:p:${b.startLine}:${order}`
        const firstLine = String(b.text || '').split('\n')[0] || ''
        const calloutMatch = /^>\s*\[!([A-Za-z0-9_-]+)([+-])?\]\s*(.*)$/.exec(firstLine.trim())
        const isCallout = !!calloutMatch
        const calloutType = calloutMatch ? String(calloutMatch[1] || '').trim().toLowerCase() : ''
        const calloutFoldable = calloutMatch ? String(calloutMatch[2] || '').trim() : ''
        const calloutTitle = calloutMatch ? String(calloutMatch[3] || '').trim() : ''
        const name = isCallout ? `Callout ${calloutType || 'note'}` : `Paragraph ${order}`
        const props: Record<string, unknown> = {
          text: b.text,
          order,
          charCount: (b.text || '').length,
          name,
          ...(isCallout
            ? {
                calloutType: true,
                calloutKind: calloutType || null,
                calloutFoldable: calloutFoldable || null,
                calloutTitle: calloutTitle || null,
              }
            : {}),
        }
        builder.createParagraphNode(id, b.text, props, mkMeta(b.startLine, b.endLine), parentId)
        if (isCallout && currentAnchorId) {
          builder.addRel(id, 'pointsTo', `anchor:${gid}:${currentAnchorId}`)
        }
        
        builder.setNext(lastBlockId, id)
        lastBlockId = id
        if (mermaidAnchorsOnly) anchorsOnlyParagraphEmitted = true
        const standaloneUrl = (() => {
          const raw = String(b.text || '').trim()
          if (!raw) return null
          const singleLine = raw.split('\n').map(l => l.trim()).filter(Boolean)
          if (singleLine.length !== 1) return null
          const line = singleLine[0] || ''
          const mdLink = line.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
          if (mdLink && mdLink[2]) return String(mdLink[2]).trim()
          const angle = line.match(/^<([^>]+)>$/)
          if (angle && angle[1]) return String(angle[1]).trim()
          if (/^https?:\/\/\S+$/i.test(line)) return line
          return null
        })()
        const refs = extractMarkdownInlineRefs(b.text || '', { baseUrl: sourceUrl || undefined })
        for (const link of refs.links) {
          builder.createLinkNode(link.url, link.label, mkMeta(b.startLine, b.endLine), id, {
            preferMedia: !!standaloneUrl && standaloneUrl === link.url,
          })
        }
        const bareUrls = extractBareHttpUrls(b.text || '', { baseUrl: sourceUrl || undefined })
        for (const url of bareUrls) {
          builder.createLinkNode(url, url, mkMeta(b.startLine, b.endLine), id, {
            preferMedia: !!standaloneUrl && standaloneUrl === url,
          })
        }
        for (const img of refs.images) {
          const normalizedUrl = (() => {
            const raw = String(img.url || '').trim()
            if (!raw) return ''
            const fromGitHub = normalizeGitHubBlobLikeUrl(raw)
            return fromGitHub || raw
          })()
          const imgId = `img:${slugify(normalizedUrl || img.url)}`
          const { type, props: mediaProps } = classifyMediaFromAltAndUrl(normalizedUrl, img.alt)
          builder.createImageNode(imgId, type, img.alt || normalizedUrl || img.url, (img.alt || normalizedUrl || img.url).slice(0, 800), mediaProps, mkMeta(b.startLine, b.endLine), id)
        }
        continue
      }

      if (b.kind === 'code') {
        const id = `blk:${gid}:code:${b.startLine}:${order}`
        const props: Record<string, unknown> = { code: b.text, order, charCount: (b.text || '').length }
        if (b.language) props.language = b.language
        builder.createCodeBlockNode(id, `Code ${order}`, (b.text || '').slice(0, 800), props, mkMeta(b.startLine, b.endLine), parentId)
        
        builder.setNext(lastBlockId, id)
        lastBlockId = id
        continue
      }

      if (b.kind === 'table') {
        const id = `blk:${gid}:table:${b.startLine}:${order}`
        const headerRaw = (b as unknown as { tableHeader?: unknown }).tableHeader
        const rowsRaw = (b as unknown as { tableRows?: unknown }).tableRows
        const formatRaw = (b as unknown as { tableFormat?: unknown }).tableFormat
        const format = typeof formatRaw === 'string' ? String(formatRaw || '').trim().toLowerCase() : ''
        const header = Array.isArray(headerRaw) ? (headerRaw as unknown[]).map(v => String(v || '').trim()).filter(Boolean) : []
        const rows = Array.isArray(rowsRaw)
          ? (rowsRaw as unknown[]).map(r =>
              Array.isArray(r) ? (r as unknown[]).map(v => String(v || '').trim()) : [],
            )
          : []
        const markdown =
          format === 'ascii' && (header.length > 0 || rows.length > 0)
            ? buildMarkdownPipeTable({ header, rows })
            : String(b.text || '')
        const cols = Math.max(
          header.length,
          rows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0),
        )
        const rowCount = rows.length + (header.length ? 1 : 0)
        const visualWidth = Math.min(520, Math.max(220, 140 + cols * 120))
        const visualHeight = Math.min(420, Math.max(160, 120 + rowCount * 34))
        builder.createTableNode(
          id,
          `Table ${order}`,
          markdown.slice(0, 800),
          {
            order,
            markdown,
            ...(format === 'ascii' ? { ascii: String(b.text || '') } : {}),
            ...(header.length ? { 'table:header': header } : {}),
            ...(rows.length ? { 'table:rows': rows } : {}),
            ...(cols > 0 ? { 'table:cols': cols } : {}),
            ...(rowCount > 0 ? { 'table:rowCount': rowCount } : {}),
            'visual:shape': 'rect',
            'visual:width': visualWidth,
            'visual:height': visualHeight,
          },
          mkMeta(b.startLine, b.endLine),
          parentId,
        )
        
        builder.setNext(lastBlockId, id)
        lastBlockId = id
        continue
      }

      if (b.kind === 'list') {
        const listId = `blk:${gid}:list:${b.startLine}:${order}`
        builder.createListNode(listId, `List ${order}`, b.items.map(it => it.text).join('\n').slice(0, 800), { order }, mkMeta(b.startLine, b.endLine), parentId)
        
        builder.setNext(lastBlockId, listId)
        lastBlockId = listId
        for (let idx = 0; idx < b.items.length; idx++) {
          const item = b.items[idx]!
          const itId = `blk:${gid}:li:${b.startLine}:${idx + 1}`
          builder.createListItemNode(itId, (item.text || '').slice(0, 80) || `Item ${idx + 1}`, (item.text || '').slice(0, 800), {
            text: item.text,
            ordered: !!item.ordered,
            index: item.index ?? null,
            order: idx + 1,
          }, mkMeta(b.startLine, b.endLine), listId)
        }
        continue
      }
  }

  if (mermaidAnchorsOnly && !anchorsOnlyParagraphEmitted) {
    const bodyText = rawLines.slice(startIndex).join('\n').trim()
    const paragraphText = bodyText || title || baseName || 'Mermaid Diagram'
    const parentId = docId
    const order = 1
    const safeLine = rawLines.length > 0 ? rawLines.length : 1
    const startLine = Math.min(safeLine, Math.max(1, startIndex + 1))
    const endLine = startLine
    const id = `blk:${gid}:p:${startLine}:${order}`
    builder.createParagraphNode(
      id,
      paragraphText,
      { text: paragraphText, order, charCount: paragraphText.length, name: `Paragraph ${order}` },
      mkMeta(startLine, endLine),
      parentId,
    )
    builder.setNext(lastBlockId, id)
    lastBlockId = id
  }

  for (let i = startIndex; i < rawLines.length; i += 1) {
    const line = rawLines[i] ?? ''
    const trimmed = line.trim()
    if (!trimmed) continue
    const lineNo = i + 1

    const anchorRe = /<a\s+[^>]*id\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>\s*<\/a>/gi
    anchorRe.lastIndex = 0
    for (;;) {
      const match = anchorRe.exec(line)
      if (!match) break
      const anchorIdRaw = String(match[1] || match[2] || match[3] || '').trim()
      if (!anchorIdRaw) continue
      const anchorNodeId = `anchor:${gid}:${anchorIdRaw}`
      builder.createAnchorNode(anchorNodeId, anchorIdRaw, { anchorId: anchorIdRaw }, mkMeta(lineNo, lineNo))
    }

    const blockIdRe = /(?:^|\s)\^([A-Za-z0-9][A-Za-z0-9_-]{0,127})(?=\s*$)/g
    blockIdRe.lastIndex = 0
    for (;;) {
      const match = blockIdRe.exec(line)
      if (!match) break
      const rawId = String(match[1] || '').trim()
      if (!rawId) continue
      const anchorIdRaw = `^${rawId}`
      const anchorNodeId = `anchor:${gid}:${anchorIdRaw}`
      builder.createAnchorNode(anchorNodeId, anchorIdRaw, { anchorId: anchorIdRaw, kind: 'block' }, mkMeta(lineNo, lineNo))
    }

    const internalLinkRe = /\[([^\]]+)\]\(#([^)]+)\)/g
    internalLinkRe.lastIndex = 0
    for (;;) {
      const match = internalLinkRe.exec(line)
      if (!match) break
      const label = String(match[1] || '').trim()
      const anchorIdRaw = String(match[2] || '').trim()
      if (!anchorIdRaw) continue
      const linkId = `internal-link:${gid}:${slugify(label || anchorIdRaw)}:${slugify(anchorIdRaw)}`
      builder.createInternalLinkNode(linkId, label || anchorIdRaw, { anchorId: anchorIdRaw, label }, mkMeta(lineNo, lineNo))

      const anchorNodeId = `anchor:${gid}:${anchorIdRaw}`
      if (builder.hasAnchor(anchorNodeId)) {
        builder.addRel(linkId, 'pointsTo', anchorNodeId)
      }
    }

    const wikiRe = /\[\[([^\]\r\n]+)\]\]/g
    wikiRe.lastIndex = 0
    for (;;) {
      const match = wikiRe.exec(line)
      if (!match) break
      const innerRaw = String(match[1] || '').trim()
      if (!innerRaw) continue
      if (innerRaw.startsWith('#')) {
        const isBlock = innerRaw.startsWith('#^')
        const rawTarget = isBlock ? `^${innerRaw.slice(2).trim()}` : slugify(innerRaw.slice(1).trim())
        if (!rawTarget) continue
        const label = isBlock ? rawTarget : innerRaw.slice(1).trim()
        const linkId = `internal-wikilink:${gid}:${slugify(label || rawTarget)}:${slugify(rawTarget)}`
        builder.createInternalLinkNode(
          linkId,
          label || rawTarget,
          { anchorId: rawTarget, label, kind: 'wikilink' },
          mkMeta(lineNo, lineNo),
        )
        const anchorNodeId = `anchor:${gid}:${rawTarget}`
        if (builder.hasAnchor(anchorNodeId)) {
          builder.addRel(linkId, 'pointsTo', anchorNodeId)
        }
        continue
      }

      const nodeId = innerRaw
      const anchorFromFrontmatter = frontmatterNodeAnchorById.get(nodeId)
      if (!anchorFromFrontmatter) continue
      const rawTarget = anchorFromFrontmatter
      if (!rawTarget) continue
      const label = nodeId
      const linkId = `internal-wikilink:${gid}:${slugify(label || rawTarget)}:${slugify(rawTarget)}`
      builder.createInternalLinkNode(
        linkId,
        label || rawTarget,
        { anchorId: rawTarget, label, kind: 'wikilink', nodeId },
        mkMeta(lineNo, lineNo),
      )
      const anchorNodeId = `anchor:${gid}:${rawTarget}`
      if (builder.hasAnchor(anchorNodeId)) {
        builder.addRel(linkId, 'pointsTo', anchorNodeId)
      }
    }

    if (!mermaidAnchorsOnly) {
      const refs = extractMarkdownInlineRefs(line, { baseUrl: sourceUrl || undefined })
      for (const link of refs.links) {
        const url = String(link.url || '').trim()
        if (!url || url.startsWith('#')) continue
        builder.createLinkNode(url, link.label, mkMeta(lineNo, lineNo), docId)
      }
      const bareUrls = extractBareHttpUrls(line, { baseUrl: sourceUrl || undefined })
      for (const url of bareUrls) {
        if (!url || url.startsWith('#')) continue
        builder.createLinkNode(url, url, mkMeta(lineNo, lineNo), docId)
      }
      for (const img of refs.images) {
        const normalizedUrl = (() => {
          const raw = String(img.url || '').trim()
          if (!raw) return ''
          const fromGitHub = normalizeGitHubBlobLikeUrl(raw)
          return fromGitHub || raw
        })()
        const imgId = `img:${slugify(normalizedUrl || img.url)}`
        const { type, props: mediaProps } = classifyMediaFromAltAndUrl(normalizedUrl, img.alt)
        builder.createImageNode(imgId, type, img.alt || normalizedUrl || img.url, (img.alt || normalizedUrl || img.url).slice(0, 800), mediaProps, mkMeta(lineNo, lineNo), docId)
      }
    }
  }

  const ctx = {
    '@version': 1.1,
    '@language': 'en-us',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    kg: `${AGENTIC_RAG_SCHEMA_URL}/v1/kg#`,
    rag: `${AGENTIC_RAG_SCHEMA_URL}/v1/rag#`,
    prov: 'http://www.w3.org/ns/prov#',
    name: 'rdfs:label',
    chunk_text: 'rag:chunk_text',
    properties: { '@id': 'kg:properties', '@type': '@json' },
    metadata: { '@id': 'kg:metadata', '@type': '@json' },
    hasSection: { '@id': 'kg:hasSection', '@type': '@id' },
    hasBlock: { '@id': 'kg:hasBlock', '@type': '@id' },
    hasItem: { '@id': 'kg:hasItem', '@type': '@id' },
    linksTo: { '@id': 'kg:linksTo', '@type': '@id' },
    embedsImage: { '@id': 'kg:embedsImage', '@type': '@id' },
    hasMermaid: { '@id': 'kg:hasMermaid', '@type': '@id' },
    hasMermaidNode: { '@id': 'kg:hasMermaidNode', '@type': '@id' },
    hasAnchor: { '@id': 'kg:hasAnchor', '@type': '@id' },
    hasInternalLink: { '@id': 'kg:hasInternalLink', '@type': '@id' },
    pointsTo: { '@id': 'kg:pointsTo', '@type': '@id' },
    next: { '@id': 'kg:next', '@type': '@id' },
  }

  const hasMermaid = !!mermaidCode || hasMermaidBlock
  const mermaidDensitySource = (() => {
    const combined = mermaidDensityParts.join('\n\n').trim()
    if (!combined) return ''
    const maxChars = 50_000
    return combined.length > maxChars ? combined.slice(0, maxChars) : combined
  })()

  const treeMeta: {
    edgeLabels?: string[]
    direction?: 'source-target' | 'target-source'
    orientation?: 'vertical' | 'horizontal'
    separation?: number
    mermaidDensity?: {
      statementCount: number
      density: 'none' | 'sparse' | 'medium' | 'dense'
      anchorsOnly: boolean
      config: {
        sparseMaxStatements: number
        denseMaxStatements: number
        anchorsOnly: { sparse: number; medium: number; dense: number }
        defaultDiagram: { sparse: number; medium: number; dense: number }
      }
    }
  } = {}

  if (hasMermaid) {
    treeMeta.edgeLabels = ['pointsTo']
    if (mermaidTreeLayout?.orientation) {
      treeMeta.orientation = mermaidTreeLayout.orientation
    } else {
      treeMeta.orientation = 'horizontal'
    }
    if (mermaidTreeLayout?.direction) {
      treeMeta.direction = mermaidTreeLayout.direction
    }
    const density = computeMermaidTreeSeparation(mermaidDensitySource || mermaidCode, mermaidAnchorsOnly)
    treeMeta.separation = density.separation
    treeMeta.mermaidDensity = {
      statementCount: density.statementCount,
      density: density.density,
      anchorsOnly: mermaidAnchorsOnly,
      config: mermaidDensityConfig,
    }
  } else {
    treeMeta.edgeLabels = [
      'hasSection',
      'hasBlock',
      'hasItem',
      'hasMermaid',
      'hasMermaidNode',
      'hasAnchor',
      'hasInternalLink',
    ]
  }

  const metadata = {
    graphId: gid,
    layoutMode: hasMermaid ? 'mermaid' : 'tree',
    ...(hasMermaid ? { mermaid: treeMeta } : { tree: treeMeta }),
  }

  const nodes = builder.getNodes()
  if (mediaPoiImageUrlByName.size > 0) {
    for (const nodeAny of nodes) {
      if (!nodeAny || typeof nodeAny !== 'object' || Array.isArray(nodeAny)) continue
      const node = nodeAny as Record<string, unknown>
      const nameRaw = typeof node.name === 'string' ? node.name.trim() : ''
      if (!nameRaw) continue
      const nameKey = nameRaw.toLowerCase()
      let url = mediaPoiImageUrlByName.get(nameKey)
      if (!url) {
        for (const [poiKey, poiUrl] of mediaPoiImageUrlByName.entries()) {
          if (nameKey.includes(poiKey)) {
            url = poiUrl
            break
          }
        }
      }
      if (!url) continue
      const propsRaw = node.properties
      if (!propsRaw || typeof propsRaw !== 'object' || Array.isArray(propsRaw)) {
        node.properties = { image_url: url }
        continue
      }
      const props = propsRaw as Record<string, unknown>
      const existing = typeof props.image_url === 'string' ? props.image_url.trim() : typeof props.image === 'string' ? props.image.trim() : ''
      if (existing) continue
      props.image_url = url
    }
  }

  return { '@context': ctx, metadata, '@graph': nodes }
}
