import { parseCsvToGraph } from '@/lib/graph/csv'
import { rawToGraphData } from '@/lib/graph/rawToGraph'
import { parseJsonLd } from '@/lib/graph/jsonld/index'
import type { JSONValue } from '@/lib/graph/types'
import { isN8nWorkflow, parseN8nWorkflow } from '@/lib/graph/n8n'
import {
  parseMarkdownBlocks,
  parseMarkdownFrontmatter,
  splitMarkdownLines,
} from '@/lib/markdown'
import { normalizeGitHubBlobLikeUrl } from '@/lib/url'
import type { ParserSpec } from './types'
import { toParserId } from './types'
import { pythonSpec } from './python'
import { graphRagSpec } from './graphrag'

const slugify = (text: string): string => {
  const normalized = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return normalized || 'x'
}

const resolveUrl = (baseUrl: string | undefined, value: string): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^(data:|mailto:|tel:|javascript:)/i.test(raw)) return raw
  if (!baseUrl) return raw
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return raw
  }
}

const coerceMarkdownParenUrl = (raw: string): string => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  const unwrapped =
    trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1).trim() : trimmed
  const firstToken = unwrapped.split(/\s+/)[0] || ''
  return firstToken.trim()
}

const extractHtmlAttr = (html: string, attr: string): string => {
  const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, 'i')
  const m = String(html || '').match(re)
  return String(m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim()
}

const extractMarkdownInlineRefs = (
  text: string,
  options?: { baseUrl?: string },
): { links: Array<{ label: string; url: string }>; images: Array<{ alt: string; url: string }> } => {
  const raw = String(text || '')
  const links: Array<{ label: string; url: string }> = []
  const images: Array<{ alt: string; url: string }> = []
  const baseUrl = options?.baseUrl

  const imageRe = /!\[([^\]]*)\]\(([^)]+)\)/g
  imageRe.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = imageRe.exec(raw))) {
    const alt = String(match[1] || '').trim()
    const url = coerceMarkdownParenUrl(match[2] || '')
    if (!url) continue
    images.push({ alt, url: resolveUrl(baseUrl, url) })
  }

  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  linkRe.lastIndex = 0
  while ((match = linkRe.exec(raw))) {
    const idx = typeof match.index === 'number' ? match.index : -1
    if (idx > 0 && raw[idx - 1] === '!') continue
    const label = String(match[1] || '').trim()
    const url = coerceMarkdownParenUrl(match[2] || '')
    if (!url) continue
    links.push({ label, url: resolveUrl(baseUrl, url) })
  }

  const htmlImgRe = /<img\b[^>]*>/gi
  htmlImgRe.lastIndex = 0
  while ((match = htmlImgRe.exec(raw))) {
    const tag = match[0] || ''
    const src = extractHtmlAttr(tag, 'src')
    if (!src) continue
    const url = resolveUrl(baseUrl, src)
    if (!url) continue
    const alt = extractHtmlAttr(tag, 'alt')
    images.push({ alt, url })
  }

  return { links, images }
}

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
  const mermaidNodeIdsByName = new Map<string, string>()

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
      cur.push(tgt)
      return
    }
    if (typeof cur === 'string' && cur.trim()) {
      node[key] = [cur, tgt]
      return
    }
    node[key] = [tgt]
  }

  const setNext = (prev: string | null, next: string): void => {
    if (!prev) return
    const node = nodeById.get(prev)
    if (!node) return
    if (node.next) return
    node.next = next
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
  const parseMermaidFrontmatter = (code: string): void => {
    const lines = String(code || '').split('\n')
    if (lines.length === 0) return
    const mermaidSubgraphIdsByName = new Map<string, string>()
    const docSubgraphIds = new Set<string>()
    let currentSubgraphName: string | null = null
    let currentSubgraphId: string | null = null

    const ensureSubgraph = (rawName: string, rawLabel: string | null): string => {
      const name = String(rawName || '').trim()
      if (!name) return ''
      const existing = mermaidSubgraphIdsByName.get(name)
      if (existing) return existing
      const subgraphId = `mermaid:${gid}:subgraph:${slugify(name)}`
      mermaidSubgraphIdsByName.set(name, subgraphId)
      const label = (rawLabel || '').trim()
      const display = label || name
      ensureNode({
        '@id': subgraphId,
        '@type': 'MermaidSubgraph',
        labels: ['MermaidSubgraph'],
        name: display,
        chunk_text: display.slice(0, 800),
        properties: { subgraphName: name, label: display },
        metadata: mkMeta(1, Math.max(1, startIndex - 1)),
      })
      if (!docSubgraphIds.has(subgraphId)) {
        docSubgraphIds.add(subgraphId)
        addRel(docId, 'hasMermaidSubgraph', subgraphId)
      }
      return subgraphId
    }

    const attachNodeToCurrentSubgraph = (nodeId: string, nodeProps: Record<string, unknown>): Record<string, unknown> => {
      if (!currentSubgraphName || !currentSubgraphId) return nodeProps
      addRel(currentSubgraphId, 'hasMermaidNode', nodeId)
      const nextProps = { ...nodeProps }
      if (!Object.prototype.hasOwnProperty.call(nextProps, 'mermaidSubgraphName')) {
        nextProps.mermaidSubgraphName = currentSubgraphName
      }
      if (!Object.prototype.hasOwnProperty.call(nextProps, 'visual:layer')) {
        const layerIndexFromL = (() => {
          const m = /^L(\d+)$/.exec(currentSubgraphName)
          if (!m) return null
          const raw = Number(m[1] || '')
          if (!Number.isFinite(raw)) return null
          const idx = raw + 1
          return idx > 0 ? idx : null
        })()

        const layerIndexFromPhase = (() => {
          const m = /^P(\d+)$/.exec(currentSubgraphName)
          if (!m) return null
          const raw = Number(m[1] || '')
          if (!Number.isFinite(raw)) return null
          const idx = raw + 1
          return idx > 0 ? idx : null
        })()

        const layerIndexFromSpecial = (() => {
          if (currentSubgraphName === 'CROSS') return 10
          if (currentSubgraphName === 'INTERVIEW') return 11
          return null
        })()

        const layerIndex =
          layerIndexFromL != null
            ? layerIndexFromL
            : layerIndexFromPhase != null
            ? layerIndexFromPhase
            : layerIndexFromSpecial

        if (layerIndex != null) {
          nextProps['visual:layer'] = layerIndex
        }
      }
      return nextProps
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] || ''
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('graph')) continue
      if (trimmed.startsWith('%%')) continue
      if (trimmed.toLowerCase().startsWith('subgraph ')) {
        const m = /^subgraph\s+([A-Za-z0-9_]+)\s*\[(.+)\]/.exec(trimmed)
        const subgraphName = m ? String(m[1] || '').trim() : ''
        const subgraphLabel = m ? String(m[2] || '').trim().replace(/^"|"$/g, '') : ''
        if (subgraphName) {
          const id = ensureSubgraph(subgraphName, subgraphLabel)
          if (id) {
            currentSubgraphName = subgraphName
            currentSubgraphId = id
          }
        }
        continue
      }
      if (trimmed === 'end') {
        currentSubgraphName = null
        currentSubgraphId = null
        continue
      }
      const nodeMatch = /^([A-Za-z0-9_]+)\s*\[([^\]]+)\]/.exec(trimmed)
      if (!nodeMatch) continue
      const nodeName = String(nodeMatch[1] || '').trim()
      const nodeLabel = String(nodeMatch[2] || '').trim()
      if (!nodeName) continue
      const existingId = mermaidNodeIdsByName.get(nodeName)
      if (existingId) continue
      const nodeId = `mermaid:${gid}:${slugify(nodeName)}`
      mermaidNodeIdsByName.set(nodeName, nodeId)
      const baseProps = { nodeName, label: nodeLabel || nodeName }
      const propsWithLayer = attachNodeToCurrentSubgraph(nodeId, baseProps)
      ensureNode({
        '@id': nodeId,
        '@type': 'MermaidNode',
        labels: ['MermaidNode'],
        name: nodeLabel || nodeName,
        chunk_text: (nodeLabel || nodeName).slice(0, 800),
        properties: propsWithLayer,
        metadata: mkMeta(1, Math.max(1, startIndex - 1)),
      })
      addRel(docId, 'hasMermaidNode', nodeId)
    }
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] || ''
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('graph')) continue
      if (trimmed.startsWith('%%')) continue
      if (trimmed.toLowerCase().startsWith('subgraph ')) continue
      if (trimmed === 'end') continue
      const edgeMatch = /^([A-Za-z0-9_]+)\s*[-.]+[->]\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)/.exec(trimmed)
      if (edgeMatch) {
        const srcName = String(edgeMatch[1] || '').trim()
        const tgtName = String(edgeMatch[2] || '').trim()
        if (srcName && tgtName) {
          let srcId = mermaidNodeIdsByName.get(srcName)
          if (!srcId) {
            srcId = `mermaid:${gid}:${slugify(srcName)}`
            mermaidNodeIdsByName.set(srcName, srcId)
            const baseProps = { nodeName: srcName, label: srcName }
            const propsWithLayer = attachNodeToCurrentSubgraph(srcId, baseProps)
            ensureNode({
              '@id': srcId,
              '@type': 'MermaidNode',
              labels: ['MermaidNode'],
              name: srcName,
              chunk_text: srcName.slice(0, 800),
              properties: propsWithLayer,
              metadata: mkMeta(1, Math.max(1, startIndex - 1)),
            })
            addRel(docId, 'hasMermaidNode', srcId)
          }
          let tgtId = mermaidNodeIdsByName.get(tgtName)
          if (!tgtId) {
            tgtId = `mermaid:${gid}:${slugify(tgtName)}`
            mermaidNodeIdsByName.set(tgtName, tgtId)
            const baseProps = { nodeName: tgtName, label: tgtName }
            const propsWithLayer = attachNodeToCurrentSubgraph(tgtId, baseProps)
            ensureNode({
              '@id': tgtId,
              '@type': 'MermaidNode',
              labels: ['MermaidNode'],
              name: tgtName,
              chunk_text: tgtName.slice(0, 800),
              properties: propsWithLayer,
              metadata: mkMeta(1, Math.max(1, startIndex - 1)),
            })
            addRel(docId, 'hasMermaidNode', tgtId)
          }
          addRel(srcId, 'pointsTo', tgtId)
        }
        continue
      }
      const clickMatch = /^click\s+([A-Za-z0-9_]+)\s+"#([^"]+)"/.exec(trimmed)
      if (!clickMatch) continue
      const nodeName = String(clickMatch[1] || '').trim()
      const anchorIdRaw = String(clickMatch[2] || '').trim()
      if (!nodeName || !anchorIdRaw) continue
      const nodeId = mermaidNodeIdsByName.get(nodeName)
      if (!nodeId) continue
      const anchorNodeId = `anchor:${gid}:${anchorIdRaw}`
      addRel(nodeId, 'pointsTo', anchorNodeId)
    }
  }
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
    parseMermaidFrontmatter(mermaidCode)
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

            const altRaw = String(img.alt || '')
            const altNorm = altRaw.trim().toLowerCase()

            const isVideo =
              altNorm.startsWith('video') || /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(img.url)
            const isIFrame = altNorm.startsWith('iframe')
            const type = isVideo ? 'Video' : isIFrame ? 'IFrame' : 'Image'
            const mediaProps: Record<string, unknown> = {
              url: normalizedUrl,
              alt: img.alt,
              media_url: normalizedUrl,
              media: normalizedUrl,
              'visual:shape': 'rect',
            }
            if (type === 'IFrame') {
              mediaProps.media_kind = 'iframe'
              mediaProps.iframe_url = normalizedUrl
            } else if (type === 'Video') {
              mediaProps.media_kind = 'video'
              mediaProps.video = normalizedUrl
            } else {
              mediaProps.media_kind = 'image'
              mediaProps.image = normalizedUrl
            }

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
            properties: { text: item.text, ordered: !!item.ordered, index: item.index ?? null, order: idx + 1 },
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

          const altRaw = String(img.alt || '')
          const altNorm = altRaw.trim().toLowerCase()

          const isVideo =
            altNorm.startsWith('video') || /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(img.url)
          const isIFrame = altNorm.startsWith('iframe')
          const type = isVideo ? 'Video' : isIFrame ? 'IFrame' : 'Image'
          const mediaProps: Record<string, unknown> = {
            url: normalizedUrl,
            alt: img.alt,
            media_url: normalizedUrl,
            media: normalizedUrl,
            'visual:shape': 'rect',
          }
          if (type === 'IFrame') {
            mediaProps.media_kind = 'iframe'
            mediaProps.iframe_url = normalizedUrl
          } else if (type === 'Video') {
            mediaProps.media_kind = 'video'
            mediaProps.video = normalizedUrl
          } else {
            mediaProps.media_kind = 'image'
            mediaProps.image = normalizedUrl
          }

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

  const metadata = {
    graphId: gid,
    generatedAt: nowIso,
    layoutMode: 'tidy-tree',
    tidyTree: {
      edgeLabels: [
        'hasSection',
        'hasBlock',
        'hasItem',
        'hasMermaid',
        'hasMermaidNode',
        'hasAnchor',
        'hasInternalLink',
      ],
    },
    suggestedTraversalEdges: [
      'hasSection',
      'hasBlock',
      'hasItem',
      'linksTo',
      'embedsImage',
      'hasMermaid',
      'hasMermaidNode',
      'hasAnchor',
      'hasInternalLink',
      'pointsTo',
      'next',
    ],
  }

  return { '@context': ctx, '@graph': nodes, metadata }
}

const markdownSpec: ParserSpec = {
  id: toParserId('markdown'),
  name: 'Markdown',
  match: (name) => {
    const lower = (name || '').toLowerCase()
    if (/^https?:\/\//i.test(lower)) return true
    return lower.endsWith('.md') || lower.endsWith('.markdown')
  },
  parse: (name, text) => {
    const t0 = Date.now()
    const jsonld = buildMarkdownJsonLd(name, text)
    const t1 = Date.now()
    const baseGraph = parseJsonLd(jsonld)
    const t2 = Date.now()
    const baseMeta =
      baseGraph.metadata && typeof baseGraph.metadata === 'object' && !Array.isArray(baseGraph.metadata)
        ? baseGraph.metadata
        : ({} as Record<string, JSONValue>)
    const ingestionMetrics: Record<string, JSONValue> = {
      kind: 'markdown',
      buildMarkdownJsonLdMs: t1 - t0,
      parseJsonLdMs: t2 - t1,
      totalMs: t2 - t0,
    }
    const nextMeta: Record<string, JSONValue> = {
      ...baseMeta,
      ingestionMetrics,
    }
    const graphData = { ...baseGraph, metadata: nextMeta }
    return { graphData, warnings: [] }
  },
}

const csvSpec: ParserSpec = {
  id: toParserId('csv'),
  name: 'CSV',
  match: (name) => (name || '').toLowerCase().endsWith('.csv'),
  parse: (_, text) => ({ graphData: parseCsvToGraph(text), warnings: [] })
}

const jsonldSpec: ParserSpec = {
  id: toParserId('jsonld'),
  name: 'JSON‑LD',
  match: (name, text) => {
    const lower = (name || '').toLowerCase()
    if (lower.endsWith('.jsonld')) return true
    try { const obj = JSON.parse(text); return !!obj['@context'] } catch { return false }
  },
  parse: (_, text) => ({ graphData: parseJsonLd(JSON.parse(text)), warnings: [] })
}

const rawJsonSpec: ParserSpec = {
  id: toParserId('json'),
  name: 'Raw JSON',
  match: (name, text) => {
    const lower = (name || '').toLowerCase()
    if (lower.endsWith('.json')) return true
    try { JSON.parse(text); return true } catch { return false }
  },
  parse: (_, text) => {
    const obj = JSON.parse(text)
    if (obj && Array.isArray(obj.nodes) && Array.isArray(obj.edges)) return { graphData: obj, warnings: [] }
    return { graphData: rawToGraphData(obj), warnings: [] }
  }
}

const n8nSpec: ParserSpec = {
  id: toParserId('n8n'),
  name: 'N8n Workflow',
  match: (_, text) => { try { const obj = JSON.parse(text); return isN8nWorkflow(obj) } catch { return false } },
  parse: (_, text) => parseN8nWorkflow(JSON.parse(text))
}

export const builtInParsers: ParserSpec[] = [csvSpec, jsonldSpec, rawJsonSpec, n8nSpec, markdownSpec, pythonSpec, graphRagSpec]
