import { parseCsvToGraph } from '@/lib/graph/csv'
import { rawToGraphData } from '@/lib/graph/rawToGraph'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { isN8nWorkflow, parseN8nWorkflow } from '@/lib/graph/n8n'
import {
  parseMarkdownBlocks,
  parseMarkdownFrontmatter,
  splitMarkdownLines,
} from '@/lib/markdown'
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

const extractLinks = (text: string): Array<{ label: string; url: string }> => {
  const out: Array<{ label: string; url: string }> = []
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  re.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const label = String(match[1] || '').trim()
    const url = String(match[2] || '').trim()
    if (!url) continue
    out.push({ label, url })
  }
  return out
}

const buildMarkdownJsonLd = (name: string, markdownText: string): Record<string, unknown> => {
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

  const sectionStack: Array<{ level: number; id: string }> = []
  let currentSectionId: string = docId
  let lastBlockId: string | null = null
  const indexByParent = new Map<string, number>()
  const linkNodeIds = new Set<string>()

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
      for (const link of extractLinks(b.text || '')) {
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
    next: { '@id': 'kg:next', '@type': '@id' },
  }

  const metadata = {
    graphId: gid,
    generatedAt: nowIso,
    layoutMode: 'tidy-tree',
    tidyTree: { edgeLabels: ['hasSection', 'hasBlock', 'hasItem'] },
    suggestedTraversalEdges: ['hasSection', 'hasBlock', 'hasItem', 'linksTo', 'next'],
  }

  return { '@context': ctx, '@graph': nodes, metadata }
}

const markdownSpec: ParserSpec = {
  id: toParserId('markdown'),
  name: 'Markdown',
  match: (name) => {
    const lower = (name || '').toLowerCase()
    return lower.endsWith('.md') || lower.endsWith('.markdown')
  },
  parse: (name, text) => ({ graphData: parseJsonLd(buildMarkdownJsonLd(name, text)), warnings: [] }),
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
