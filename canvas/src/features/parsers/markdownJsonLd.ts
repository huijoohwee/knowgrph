import {
  parseMarkdownBlocks,
  parseMarkdownFrontmatter,
  splitMarkdownLines,
} from '@/lib/markdown'
import { normalizeGitHubBlobLikeUrl } from '@/lib/url'
import {
  slugify,
  extractMarkdownInlineRefs,
  classifyMediaFromAltAndUrl,
} from './markdownJsonLdUtils'
import {
  mermaidDensityConfig,
  computeMermaidTidyTreeSeparation,
} from './markdownJsonLdMermaid'
import {
  parseMermaidFrontmatter,
  MermaidParserContext,
} from './markdownJsonLdMermaidParser'

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
  const nodeById = new Map<string, Record<string, unknown>>()
  const nodes: Record<string, unknown>[] = []
  let mermaidTidyTreeLayout: {
    orientation?: 'vertical' | 'horizontal'
    direction?: 'source-target' | 'target-source'
  } | null = null

  const ensureNode = (node: Record<string, unknown>): void => {
    const id = String(node['@id'] || '')
    if (!id) return
    if (nodeById.has(id)) return
    nodeById.set(id, node)
    nodes.push(node)
  }

  const addRel = (src: string, key: string, tgt: string): void => {
    const node = nodeById.get(src)
    if (!node) return
    const cur = node[key]
    if (Array.isArray(cur)) {
      if (!cur.includes(tgt)) {
        cur.push(tgt)
      }
      return
    }
    if (typeof cur === 'string' && cur.trim()) {
      if (cur !== tgt) {
        node[key] = [cur, tgt]
      }
      return
    }
    node[key] = tgt
  }

  const setNext = (prev: string | null, next: string): void => {
    if (!prev) return
    const node = nodeById.get(prev)
    if (!node) return
    if ((node as { next?: unknown }).next) return
    ;(node as { next?: unknown }).next = next
  }

  const docProps: Record<string, unknown> = { format: 'text/markdown', graphId: gid }
  if (baseName) docProps.path = baseName
  ensureNode({
    '@id': docId,
    '@type': 'Document',
    labels: ['Document'],
    name: title,
    chunk_text: `${title}\n\nSource: ${baseName || 'inline'}`,
    properties: docProps,
    metadata: mkMeta(1, Math.max(1, rawLines.length)),
  })

  const mermaidRaw = typeof meta.mermaid === 'string' ? meta.mermaid : ''
  const mermaidCode = String(mermaidRaw || '').trim()
  const mermaidAnchorsOnlyRaw = (meta as Record<string, unknown>).mermaidAnchorsOnly
  const mermaidAnchorsOnly =
    typeof mermaidAnchorsOnlyRaw === 'boolean'
      ? mermaidAnchorsOnlyRaw
      : typeof mermaidAnchorsOnlyRaw === 'string'
      ? mermaidAnchorsOnlyRaw.trim().toLowerCase() === 'true'
      : false

  if (mermaidCode) {
    const mermaidId = `mermaid:${gid}:frontmatter`
    ensureNode({
      '@id': mermaidId,
      '@type': 'MermaidDiagram',
      labels: ['MermaidDiagram'],
      name: 'Frontmatter Mermaid Diagram',
      chunk_text: mermaidCode.slice(0, 800),
      properties: { code: mermaidCode, format: 'graph' },
      metadata: mkMeta(1, Math.max(1, startIndex - 1)),
    })
    addRel(docId, 'hasMermaid', mermaidId)

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

    const parserCtx: MermaidParserContext = {
      gid,
      docId,
      startIndex: mermaidStartLine,
      mermaidTidyTreeLayout,
      ensureNode,
      addRel,
      mkMeta,
      setMermaidTidyTreeLayout: (layout) => {
        mermaidTidyTreeLayout = layout
      },
    }
    parseMermaidFrontmatter(mermaidCode, parserCtx)
  }

  const sectionStack: Array<{ level: number; id: string }> = []
  let currentSectionId: string = docId
  let lastBlockId: string | null = null
  const indexByParent = new Map<string, number>()
  const linkNodeIds = new Set<string>()
  const imageNodeIds = new Set<string>()
  if (!mermaidAnchorsOnly) {
    for (const b of blocks) {
      if (b.kind === 'heading') {
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1]!.level >= b.level) {
          sectionStack.pop()
        }
        const parentId = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1]!.id : docId
        const anchor = slugify(b.text)
        const secId = `sec:${gid}:${anchor}:${b.startLine}`
        const order = (indexByParent.get(parentId) || 0) + 1
        indexByParent.set(parentId, order)
        ensureNode({
          '@id': secId,
          '@type': 'Section',
          labels: ['Section'],
          name: b.text,
          chunk_text: b.text,
          properties: { heading: b.text, level: b.level, anchor, order },
          metadata: mkMeta(b.startLine, b.endLine),
        })
        addRel(parentId, 'hasSection', secId)
        setNext(lastBlockId, secId)
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
        ensureNode({
          '@id': id,
          '@type': 'Paragraph',
          labels: ['Paragraph'],
          name: `Paragraph ${order}`,
          chunk_text: (b.text || '').slice(0, 800),
          properties: { text: b.text, order, charCount: (b.text || '').length },
          metadata: mkMeta(b.startLine, b.endLine),
        })
        addRel(parentId, 'hasBlock', id)
        setNext(lastBlockId, id)
        lastBlockId = id
        const refs = extractMarkdownInlineRefs(b.text || '', { baseUrl: sourceUrl || undefined })
        for (const link of refs.links) {
          const linkId = `link:${slugify(link.url)}`
          if (!linkNodeIds.has(linkId)) {
            linkNodeIds.add(linkId)
            ensureNode({
              '@id': linkId,
              '@type': 'Link',
              labels: ['Link'],
              name: link.label || link.url,
              chunk_text: (link.label || '').slice(0, 800),
              properties: { url: link.url, label: link.label },
              metadata: mkMeta(b.startLine, b.endLine),
            })
          }
          addRel(id, 'linksTo', linkId)
        }
        for (const img of refs.images) {
          const normalizedUrl = (() => {
            const raw = String(img.url || '').trim()
            if (!raw) return ''
            const fromGitHub = normalizeGitHubBlobLikeUrl(raw)
            return fromGitHub || raw
          })()
          const imgId = `img:${slugify(normalizedUrl || img.url)}`
          if (!imageNodeIds.has(imgId)) {
            imageNodeIds.add(imgId)
            const { type, props: mediaProps } = classifyMediaFromAltAndUrl(
              normalizedUrl,
              img.alt,
            )

            ensureNode({
              '@id': imgId,
              '@type': type,
              labels: [type],
              name: img.alt || normalizedUrl || img.url,
              chunk_text: (img.alt || normalizedUrl || img.url).slice(0, 800),
              properties: mediaProps,
              metadata: mkMeta(b.startLine, b.endLine),
            })
            addRel(id, 'embedsImage', imgId)
          }
        }
        continue
      }

      if (b.kind === 'code') {
        const id = `blk:${gid}:code:${b.startLine}:${order}`
        const props: Record<string, unknown> = { code: b.text, order, charCount: (b.text || '').length }
        if (b.language) props.language = b.language
        ensureNode({
          '@id': id,
          '@type': 'CodeBlock',
          labels: ['CodeBlock'],
          name: `Code ${order}`,
          chunk_text: (b.text || '').slice(0, 800),
          properties: props,
          metadata: mkMeta(b.startLine, b.endLine),
        })
        addRel(parentId, 'hasBlock', id)
        setNext(lastBlockId, id)
        lastBlockId = id
        continue
      }

      if (b.kind === 'table') {
        const id = `blk:${gid}:table:${b.startLine}:${order}`
        ensureNode({
          '@id': id,
          '@type': 'Table',
          labels: ['Table'],
          name: `Table ${order}`,
          chunk_text: (b.text || '').slice(0, 800),
          properties: { markdown: b.text, order },
          metadata: mkMeta(b.startLine, b.endLine),
        })
        addRel(parentId, 'hasBlock', id)
        setNext(lastBlockId, id)
        lastBlockId = id
        continue
      }

      if (b.kind === 'list') {
        const listId = `blk:${gid}:list:${b.startLine}:${order}`
        ensureNode({
          '@id': listId,
          '@type': 'List',
          labels: ['List'],
          name: `List ${order}`,
          chunk_text: b.items.map(it => it.text).join('\n').slice(0, 800),
          properties: { order },
          metadata: mkMeta(b.startLine, b.endLine),
        })
        addRel(parentId, 'hasBlock', listId)
        setNext(lastBlockId, listId)
        lastBlockId = listId
        for (let idx = 0; idx < b.items.length; idx++) {
          const item = b.items[idx]!
          const itId = `blk:${gid}:li:${b.startLine}:${idx + 1}`
          ensureNode({
            '@id': itId,
            '@type': 'ListItem',
            labels: ['ListItem'],
            name: (item.text || '').slice(0, 80) || `Item ${idx + 1}`,
            chunk_text: (item.text || '').slice(0, 800),
            properties: {
              text: item.text,
              ordered: !!item.ordered,
              index: item.index ?? null,
              order: idx + 1,
            },
            metadata: mkMeta(b.startLine, b.endLine),
          })
          addRel(listId, 'hasItem', itId)
        }
        continue
      }
    }
  }

  const anchorNodeIds = new Set<string>()
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
      if (anchorNodeIds.has(anchorNodeId)) continue
      anchorNodeIds.add(anchorNodeId)
      ensureNode({
        '@id': anchorNodeId,
        '@type': 'Anchor',
        labels: ['Anchor'],
        name: anchorIdRaw,
        chunk_text: anchorIdRaw,
        properties: { anchorId: anchorIdRaw },
        metadata: mkMeta(lineNo, lineNo),
      })
      addRel(docId, 'hasAnchor', anchorNodeId)
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
      if (!linkNodeIds.has(linkId)) {
        linkNodeIds.add(linkId)
        ensureNode({
          '@id': linkId,
          '@type': 'InternalLink',
          labels: ['InternalLink'],
          name: label || anchorIdRaw,
          chunk_text: (label || anchorIdRaw).slice(0, 800),
          properties: { anchorId: anchorIdRaw, label },
          metadata: mkMeta(lineNo, lineNo),
        })
      }
      addRel(docId, 'hasInternalLink', linkId)
      const anchorNodeId = `anchor:${gid}:${anchorIdRaw}`
      if (anchorNodeIds.has(anchorNodeId)) {
        addRel(linkId, 'pointsTo', anchorNodeId)
      }
    }

    if (!mermaidAnchorsOnly) {
      const refs = extractMarkdownInlineRefs(line, { baseUrl: sourceUrl || undefined })
      for (const link of refs.links) {
        const url = String(link.url || '').trim()
        if (!url || url.startsWith('#')) continue
        const linkId = `link:${slugify(url)}`
        if (!linkNodeIds.has(linkId)) {
          linkNodeIds.add(linkId)
          ensureNode({
            '@id': linkId,
            '@type': 'Link',
            labels: ['Link'],
            name: link.label || url,
            chunk_text: (link.label || url).slice(0, 800),
            properties: { url, label: link.label },
            metadata: mkMeta(lineNo, lineNo),
          })
        }
        addRel(docId, 'linksTo', linkId)
      }
      for (const img of refs.images) {
        const normalizedUrl = (() => {
          const raw = String(img.url || '').trim()
          if (!raw) return ''
          const fromGitHub = normalizeGitHubBlobLikeUrl(raw)
          return fromGitHub || raw
        })()
        const imgId = `img:${slugify(normalizedUrl || img.url)}`
        if (!imageNodeIds.has(imgId)) {
          imageNodeIds.add(imgId)
          const { type, props: mediaProps } = classifyMediaFromAltAndUrl(
            normalizedUrl,
            img.alt,
          )

          ensureNode({
            '@id': imgId,
            '@type': type,
            labels: [type],
            name: img.alt || normalizedUrl || img.url,
            chunk_text: (img.alt || normalizedUrl || img.url).slice(0, 800),
            properties: mediaProps,
            metadata: mkMeta(lineNo, lineNo),
          })
        }
        addRel(docId, 'embedsImage', imgId)
      }
    }
  }

  const ctx = {
    '@version': 1.1,
    '@language': 'en-us',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    kg: 'https://huijoohwee.github.io/schema/AgenticRAG/v1/kg#',
    rag: 'https://huijoohwee.github.io/schema/AgenticRAG/v1/rag#',
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

  const tidyTreeMeta: {
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
    tidyTreeMeta.edgeLabels = ['pointsTo']
    if (mermaidTidyTreeLayout?.orientation) {
      tidyTreeMeta.orientation = mermaidTidyTreeLayout.orientation
    } else {
      tidyTreeMeta.orientation = 'horizontal'
    }
    if (mermaidTidyTreeLayout?.direction) {
      tidyTreeMeta.direction = mermaidTidyTreeLayout.direction
    }
    const density = computeMermaidTidyTreeSeparation(mermaidCode, mermaidAnchorsOnly)
    tidyTreeMeta.separation = density.separation
    tidyTreeMeta.mermaidDensity = {
      statementCount: density.statementCount,
      density: density.density,
      anchorsOnly: mermaidAnchorsOnly,
      config: mermaidDensityConfig,
    }
  } else {
    tidyTreeMeta.edgeLabels = [
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
    layoutMode: 'tidy-tree',
    tidyTree: tidyTreeMeta,
  }

  return { '@context': ctx, metadata, '@graph': nodes }
}
