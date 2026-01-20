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

export { slugify } from './markdownJsonLdUtils'

export const buildMarkdownJsonLd = (name: string, markdownText: string): Record<string, unknown> => {
  const rawLines = splitMarkdownLines(markdownText)
  const { meta, startIndex } = parseMarkdownFrontmatter(rawLines)
  const blocks = parseMarkdownBlocks(rawLines, startIndex)

  const fmGraphId = String(meta.graphId || meta.graph_id || meta.graph || '').trim()
  const baseName = (name || '').replace(/\\/g, '/').split('/').pop() || ''
  const stem = baseName.replace(/\.(md|markdown)$/i, '')
  const gid = fmGraphId || (stem ? `md:${slugify(stem)}` : 'md:x')

  const fmTitle = String(meta.title || '').trim()
  const title =
    fmTitle ||
    (() => {
      const h1 = blocks.find(b => b.kind === 'heading' && b.level === 1 && b.text.trim())
      return h1 && h1.kind === 'heading' ? h1.text.trim() : ''
    })() ||
    'Markdown Document'

  const nowIso = new Date().toISOString()
  const sourceUrl = (() => {
    const raw = String(name || '').trim()
    if (!/^https?:\/\//i.test(raw)) return ''
    return raw
  })()
  const mkMeta = (startLine: number, endLine: number): Record<string, unknown> => ({
    timestamp: nowIso,
    documentPath: baseName,
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
  if (baseName) docProps.path = baseName
  builder.createDocumentNode(title, `${title}\n\nSource: ${baseName || 'inline'}`, docProps, mkMeta(1, Math.max(1, rawLines.length)))

  const mermaidRaw = typeof meta.mermaid === 'string' ? meta.mermaid : ''
  const mermaidCode = String(mermaidRaw || '').trim()
  const mermaidAnchorsOnlyRaw = (meta as Record<string, unknown>).mermaidAnchorsOnly
  const mermaidAnchorsOnly =
    typeof mermaidAnchorsOnlyRaw === 'boolean'
      ? mermaidAnchorsOnlyRaw
      : typeof mermaidAnchorsOnlyRaw === 'string'
      ? mermaidAnchorsOnlyRaw.trim().toLowerCase() === 'true'
      : false
  
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
    const firstLine = (diagrams[0]?.code || mermaidCode).split('\n')[0]?.trim() || ''
    if (firstLine.startsWith('graph ') || firstLine.startsWith('flowchart ')) {
      const parts = firstLine.split(/\s+/)
      const dir = parts[1]?.toUpperCase()
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

  for (const b of blocks) {
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
      const diagrams = splitMermaidIntoDiagrams(b.text)
      for (let idx = 0; idx < diagrams.length; idx += 1) {
        const diagram = diagrams[idx]!
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
        builder.createParagraphNode(id, b.text, { text: b.text, order, charCount: (b.text || '').length, name: `Paragraph ${order}` }, mkMeta(b.startLine, b.endLine), parentId)
        
        builder.setNext(lastBlockId, id)
        lastBlockId = id
        if (mermaidAnchorsOnly) anchorsOnlyParagraphEmitted = true
        const refs = extractMarkdownInlineRefs(b.text || '', { baseUrl: sourceUrl || undefined })
        for (const link of refs.links) {
          builder.createLinkNode(link.url, link.label, mkMeta(b.startLine, b.endLine), id)
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
        builder.createTableNode(id, `Table ${order}`, (b.text || '').slice(0, 800), { markdown: b.text, order }, mkMeta(b.startLine, b.endLine), parentId)
        
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

    if (!mermaidAnchorsOnly) {
      const refs = extractMarkdownInlineRefs(line, { baseUrl: sourceUrl || undefined })
      for (const link of refs.links) {
        const url = String(link.url || '').trim()
        if (!url || url.startsWith('#')) continue
        builder.createLinkNode(url, link.label, mkMeta(lineNo, lineNo), docId)
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

  const hasMermaid = !!mermaidCode

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
    const density = computeMermaidTreeSeparation(mermaidCode, mermaidAnchorsOnly)
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
    generatedAt: nowIso,
    layoutMode: hasMermaid ? 'mermaid' : 'tree',
    ...(hasMermaid ? { mermaid: treeMeta } : { tree: treeMeta }),
  }

  return { '@context': ctx, metadata, '@graph': builder.getNodes() }
}
