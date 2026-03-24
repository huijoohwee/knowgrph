import type { GraphNode } from '@/lib/graph/types'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import type { MarkdownDesignLayout } from '@/features/markdown-edgeless/markdownDesignLayout'
import { buildMarkdownPanelSrcDoc } from '@/lib/render/markdownPanelSrcDoc'
import { looksLikeSingleTagBlock } from 'grph-shared/markdown/mediaHtml'
import { hasNodeMedia } from '@/components/GraphCanvas/helpers'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'

function readLineStart(n: GraphNode): number | null {
  const meta = n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata) ? (n.metadata as Record<string, unknown>) : null
  const raw = meta ? meta.lineStart : null
  const v = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(v)) return null
  return Math.max(1, Math.floor(v))
}

function isPanelOnlyParagraphNode(n: GraphNode): boolean {
  if (String(n.type || '').trim() !== 'Paragraph') return false
  const propsObj = n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties) ? (n.properties as Record<string, unknown>) : null
  const text = propsObj && typeof propsObj.text === 'string' ? String(propsObj.text || '').trim() : ''
  if (propsObj && propsObj.calloutType === true) return true
  if (text.startsWith('>')) return true
  if (text && /<\s*iframe\b/i.test(text) && text.toLowerCase().startsWith('<iframe') && looksLikeSingleTagBlock(text, 'iframe')) return true
  if (hasNodeMedia(n)) return true
  return false
}

export function listMarkdownPanelOverlayNodes(args: {
  nodes: GraphNode[]
  layout: MarkdownDesignLayout | null
  excludeNodeIdSet?: Set<string>
}): MediaOverlayNode[] {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const layout = args.layout
  if (!layout || !Array.isArray(layout.blocks) || layout.blocks.length === 0) return []
  const exclude = args.excludeNodeIdSet || null

  const tableByStart = new Map<number, string>()
  const codeByStart = new Map<number, string>()
  const paraByStart = new Map<number, string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const id = String(n?.id || '').trim()
    if (!id) continue
    const start = readLineStart(n)
    if (start == null) continue
    const type = String(n.type || '').trim()
    if (type === 'Table' && !tableByStart.has(start)) tableByStart.set(start, id)
    else if (type === 'CodeBlock' && !codeByStart.has(start)) codeByStart.set(start, id)
    else if (type === 'Paragraph' && !paraByStart.has(start)) paraByStart.set(start, id)
  }

  const out: MediaOverlayNode[] = []
  for (let i = 0; i < layout.blocks.length; i += 1) {
    const b = layout.blocks[i]!
    const start = Math.max(1, Math.floor(Number(b.startLine) || 1))
    const type = String(b.type || '').trim()

    const nodeId = (() => {
      if (type === 'table') return tableByStart.get(start) || null
      if (type === 'code') return codeByStart.get(start) || null
      if (type === 'blockquote' || type === 'callout') return paraByStart.get(start) || null
      if (type === 'html') return paraByStart.get(start) || null
      return null
    })()
    if (!nodeId) continue
    if (exclude?.has(nodeId)) continue

    const srcDoc = buildMarkdownPanelSrcDoc(b)
    out.push({
      id: nodeId,
      title: String(b.title || 'Panel').trim() || 'Panel',
      url: 'about:blank',
      srcDoc,
      openUrl: 'about:blank',
      interactive: false,
      kind: 'iframe',
    })
  }
  return out
}

export function computeMarkdownAnchorNodeIdByBlockId(args: {
  layout: MarkdownDesignLayout | null
  nodes: GraphNode[]
}): Record<string, string> | null {
  const layout = args.layout
  if (!layout || !Array.isArray(layout.blocks) || layout.blocks.length === 0) return null
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  if (nodes.length === 0) return null

  const tableByStart = new Map<number, string>()
  const codeByStart = new Map<number, string>()
  const paraByStart = new Map<number, string>()
  const mediaIframeByStart = new Map<number, string>()

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const id = String(n?.id || '').trim()
    if (!id) continue

    const meta = n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata) ? (n.metadata as Record<string, unknown>) : null
    const lineStartRaw = meta ? meta.lineStart : null
    const lineStart = typeof lineStartRaw === 'number' ? lineStartRaw : typeof lineStartRaw === 'string' ? Number(lineStartRaw) : NaN
    if (!Number.isFinite(lineStart)) continue
    const start = Math.max(1, Math.floor(lineStart))

    const type = String(n.type || '').trim()
    if (type === 'Table' && !tableByStart.has(start)) tableByStart.set(start, id)
    else if (type === 'CodeBlock' && !codeByStart.has(start)) codeByStart.set(start, id)
    else if (type === 'Paragraph' && !paraByStart.has(start)) paraByStart.set(start, id)

    const spec = getNodeMediaSpec(n)
    if (spec?.kind === 'iframe' && !mediaIframeByStart.has(start)) mediaIframeByStart.set(start, id)
  }

  const out: Record<string, string> = {}
  for (let i = 0; i < layout.blocks.length; i += 1) {
    const b = layout.blocks[i]!
    const blockId = String(b.id || '').trim()
    if (!blockId) continue
    const start = Math.max(1, Math.floor(Number(b.startLine) || 1))

    if (b.type === 'table') {
      const nid = tableByStart.get(start)
      if (nid) out[blockId] = nid
    } else if (b.type === 'code') {
      const nid = codeByStart.get(start)
      if (nid) out[blockId] = nid
    } else if (b.type === 'blockquote' || b.type === 'callout') {
      const nid = paraByStart.get(start)
      if (nid) out[blockId] = nid
    } else if (b.type === 'html') {
      const raw = String(b.preview.kind === 'html' ? (b.preview.html?.raw || '') : '').trim()
      if (/<\s*iframe\b/i.test(raw)) {
        const nid = mediaIframeByStart.get(start) || paraByStart.get(start)
        if (nid) out[blockId] = nid
      }
    }
  }
  return Object.keys(out).length ? out : null
}

export function buildPanelOnlyNodeIdSetFromGraphNodes(nodes: GraphNode[]): Set<string> {
  const out = new Set<string>()
  const list = Array.isArray(nodes) ? nodes : []
  for (let i = 0; i < list.length; i += 1) {
    const n = list[i]!
    const id = String(n?.id || '').trim()
    if (!id) continue
    const type = String(n.type || '').trim()
    if (type === 'Table' || type === 'CodeBlock') {
      out.add(id)
      continue
    }
    if (isPanelOnlyParagraphNode(n)) out.add(id)
  }
  return out
}
