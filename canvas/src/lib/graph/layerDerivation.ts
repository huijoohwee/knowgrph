import { GraphData } from './types';

const FLOW_WIDGET_FORM_ID_KEY = 'flow:widgetFormId' as const
const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const
const FLOW_EDGE_SOURCE_PORT_KEY = 'flow:sourcePortKey' as const
const FLOW_EDGE_TARGET_PORT_KEY = 'flow:targetPortKey' as const

const isFrontmatterMermaidNode = (n: { properties?: unknown } | null | undefined): boolean => {
  if (!n) return false
  const props = (n as { properties?: unknown }).properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return false
  const p = props as Record<string, unknown>
  return p.isMermaidFrontmatter === true || p.mermaidScope === 'frontmatter'
}

export const hasFrontmatterMermaidSeeds = (data: GraphData): boolean => {
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  for (let i = 0; i < nodes.length; i += 1) {
    if (isFrontmatterMermaidNode(nodes[i])) return true
  }
  return false
}

export const filterGraphToFrontmatterMermaid = (data: GraphData): GraphData => {
  const allNodes = data.nodes || []
  const allEdges = data.edges || []

  const seedIds: string[] = []
  for (let i = 0; i < allNodes.length; i += 1) {
    const n = allNodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    if (isFrontmatterMermaidNode(n)) seedIds.push(id)
  }

  if (seedIds.length === 0) return data

  const nodeById = new Map(allNodes.map(n => [String(n.id), n]))

  const normalizeEndpointId = (v: unknown): string => {
    if (!v) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
    if (typeof v === 'object' && !Array.isArray(v) && 'id' in (v as Record<string, unknown>)) {
      const id = (v as Record<string, unknown>).id
      if (typeof id === 'string') return id
      if (typeof id === 'number') return Number.isFinite(id) ? String(id) : ''
      return ''
    }
    return ''
  }

  const buildAdj = (label: string) => {
    const out = new Map<string, string[]>()
    for (let i = 0; i < allEdges.length; i += 1) {
      const e = allEdges[i]
      if (!e) continue
      if (String(e.label || '') !== label) continue
      const src = normalizeEndpointId(e.source)
      const tgt = normalizeEndpointId(e.target)
      if (!src || !tgt) continue
      const arr = out.get(src)
      if (arr) arr.push(tgt)
      else out.set(src, [tgt])
    }
    return out
  }

  const pointsToAdj = buildAdj('pointsTo')
  const hasBlockAdj = buildAdj('hasBlock')
  const hasItemAdj = buildAdj('hasItem')
  const hasInternalLinkAdj = buildAdj('hasInternalLink')
  const linksToAdj = buildAdj('linksTo')
  const embedsImageAdj = buildAdj('embedsImage')
  const embedsMediaAdj = buildAdj('embedsMedia')

  const included = new Set<string>()
  const addId = (id: string) => {
    const nid = String(id || '').trim()
    if (!nid) return false
    if (included.has(nid)) return false
    if (!nodeById.has(nid)) return false
    included.add(nid)
    return true
  }

  for (let i = 0; i < seedIds.length; i += 1) addId(seedIds[i] as string)

  const queue: string[] = Array.from(included)
  let qi = 0
  while (qi < queue.length) {
    const cur = queue[qi] as string
    qi += 1
    const next = pointsToAdj.get(cur) || []
    for (let i = 0; i < next.length; i += 1) {
      const tgt = next[i] as string
      if (addId(tgt)) queue.push(tgt)
    }
  }

  const parentQueue = Array.from(included)
  let parentQi = 0
  while (parentQi < parentQueue.length) {
    const id = parentQueue[parentQi] as string
    parentQi += 1
    const n = nodeById.get(id)
    if (!n) continue
    const props = (n.properties || {}) as Record<string, unknown>
    const parentId = typeof props['visual:parentId'] === 'string' ? String(props['visual:parentId'] || '').trim() : ''
    const topParentId = typeof props['visual:topParentId'] === 'string' ? String(props['visual:topParentId'] || '').trim() : ''
    if (parentId && addId(parentId)) parentQueue.push(parentId)
    if (topParentId && addId(topParentId)) parentQueue.push(topParentId)
  }

  const anchorIds = new Set<string>()
  for (const id of included) {
    const n = nodeById.get(id)
    if (!n || n.type !== 'Anchor') continue
    const props = (n.properties || {}) as Record<string, unknown>
    const anchorId = typeof props.anchorId === 'string' ? String(props.anchorId || '').trim() : ''
    if (anchorId) anchorIds.add(anchorId)
  }

  const sectionIds: string[] = []
  if (anchorIds.size > 0) {
    for (let i = 0; i < allNodes.length; i += 1) {
      const n = allNodes[i]
      if (!n || n.type !== 'Section') continue
      const props = (n.properties || {}) as Record<string, unknown>
      const anchor = typeof props.anchor === 'string' ? String(props.anchor || '').trim() : ''
      if (!anchor || !anchorIds.has(anchor)) continue
      const id = String(n.id || '').trim()
      if (!id) continue
      if (addId(id)) sectionIds.push(id)
      else sectionIds.push(id)
    }
  }

  const isMermaidSeedType = (type: string) => {
    if (type === 'MermaidDiagram') return true
    if (type === 'MermaidNode') return true
    if (type === 'MermaidSubgraph') return true
    return false
  }

  const isPanelRelevantParagraph = (n: { properties?: unknown }) => {
    const props = (n.properties || {}) as Record<string, unknown>
    if (props.calloutType === true) return true
    const text = typeof props.text === 'string' ? props.text.trim() : ''
    if (text.startsWith('>')) return true
    if (typeof props.media_kind === 'string' && String(props.media_kind || '').trim()) return true
    if (typeof props.mediaKind === 'string' && String(props.mediaKind || '').trim()) return true
    if (typeof props.iframe_url === 'string' && String(props.iframe_url || '').trim()) return true
    if (typeof props.iframeUrl === 'string' && String(props.iframeUrl || '').trim()) return true
    if (typeof props.media_url === 'string' && String(props.media_url || '').trim()) return true
    if (typeof props.mediaUrl === 'string' && String(props.mediaUrl || '').trim()) return true
    if (typeof props.image === 'string' && String(props.image || '').trim()) return true
    if (typeof props.imageUrl === 'string' && String(props.imageUrl || '').trim()) return true
    if (typeof props.image_url === 'string' && String(props.image_url || '').trim()) return true
    if (typeof props.video === 'string' && String(props.video || '').trim()) return true
    if (typeof props.videoUrl === 'string' && String(props.videoUrl || '').trim()) return true
    if (typeof props.video_url === 'string' && String(props.video_url || '').trim()) return true
    return false
  }

  const includeParagraphContext = (pid: string) => {
    const targets = hasInternalLinkAdj.get(pid) || []
    for (let i = 0; i < targets.length; i += 1) {
      const lid = targets[i] as string
      if (!addId(lid)) continue
      const linkTargets = pointsToAdj.get(lid) || []
      for (let j = 0; j < linkTargets.length; j += 1) {
        const tid = linkTargets[j] as string
        if (!addId(tid)) continue
      }
    }
    const links = linksToAdj.get(pid) || []
    for (let i = 0; i < links.length; i += 1) addId(links[i] as string)
    const imgs = embedsImageAdj.get(pid) || []
    for (let i = 0; i < imgs.length; i += 1) addId(imgs[i] as string)
    const media = embedsMediaAdj.get(pid) || []
    for (let i = 0; i < media.length; i += 1) addId(media[i] as string)
  }

  for (let si = 0; si < sectionIds.length; si += 1) {
    const secId = sectionIds[si] as string
    const blocks = hasBlockAdj.get(secId) || []
    for (let i = 0; i < blocks.length; i += 1) {
      const bid = blocks[i] as string
      const b = nodeById.get(bid)
      if (!b) continue
      const type = String(b.type || '')
      if (type === 'Table' || type === 'CodeBlock') {
        addId(bid)
        continue
      }
      if (type === 'Paragraph') {
        const hasContext =
          (hasInternalLinkAdj.get(bid) || []).length > 0 ||
          (linksToAdj.get(bid) || []).length > 0 ||
          (embedsImageAdj.get(bid) || []).length > 0 ||
          (embedsMediaAdj.get(bid) || []).length > 0
        if (!hasContext && !isPanelRelevantParagraph(b)) continue
        if (addId(bid)) {
          includeParagraphContext(bid)
        } else {
          includeParagraphContext(bid)
        }
        continue
      }
      if (type === 'List') {
        const itemIds = hasItemAdj.get(bid) || []
        let includedAny = false
        for (let j = 0; j < itemIds.length; j += 1) {
          const iid = itemIds[j] as string
          const it = nodeById.get(iid)
          if (!it) continue
          const itType = String(it.type || '')
          if (itType !== 'ListItem') continue
          const hasContext =
            (hasInternalLinkAdj.get(iid) || []).length > 0 ||
            (linksToAdj.get(iid) || []).length > 0 ||
            (embedsImageAdj.get(iid) || []).length > 0 ||
            (embedsMediaAdj.get(iid) || []).length > 0
          if (!hasContext) continue
          addId(iid)
          includeParagraphContext(iid)
          includedAny = true
        }
        if (includedAny) addId(bid)
        continue
      }
    }
  }

  const mermaidNodes = Array.from(included)
  for (let i = 0; i < mermaidNodes.length; i += 1) {
    const id = mermaidNodes[i] as string
    const n = nodeById.get(id)
    if (!n) continue
    if (!isMermaidSeedType(String(n.type || ''))) continue
    includeParagraphContext(id)
  }

  const nodes = allNodes.filter(n => included.has(String(n.id)))
  const edges = allEdges.filter(e => {
    const src = normalizeEndpointId(e.source)
    const tgt = normalizeEndpointId(e.target)
    return src && tgt && included.has(String(src)) && included.has(String(tgt))
  })

  return { ...data, nodes, edges }
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function readEndpointId(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'object' && !Array.isArray(v) && 'id' in (v as Record<string, unknown>)) {
    const id = (v as Record<string, unknown>).id
    if (typeof id === 'string') return id
    if (typeof id === 'number') return Number.isFinite(id) ? String(id) : ''
  }
  return ''
}

function isFlowNode(n: unknown): boolean {
  if (!n || typeof n !== 'object' || Array.isArray(n)) return false
  const props = (n as { properties?: unknown }).properties
  if (!isRecord(props)) return false
  const form = props[FLOW_WIDGET_FORM_ID_KEY]
  if (typeof form === 'string' && form.trim()) return true
  const portTypes = props[FLOW_PORT_TYPES_KEY]
  if (isRecord(portTypes)) return true
  return false
}

function isFlowEdge(e: unknown): boolean {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false
  const props = (e as { properties?: unknown }).properties
  if (!isRecord(props)) return false
  const s = props[FLOW_EDGE_SOURCE_PORT_KEY]
  const t = props[FLOW_EDGE_TARGET_PORT_KEY]
  return (typeof s === 'string' && s.trim().length > 0) || (typeof t === 'string' && t.trim().length > 0)
}

export const filterGraphToFrontmatterFlow = (data: GraphData): GraphData => {
  const allNodes = Array.isArray(data.nodes) ? data.nodes : []
  const allEdges = Array.isArray(data.edges) ? data.edges : []

  const included = new Set<string>()
  for (let i = 0; i < allNodes.length; i += 1) {
    const n = allNodes[i]
    const id = String((n as { id?: unknown })?.id || '').trim()
    if (!id) continue
    if (isFlowNode(n)) included.add(id)
  }

  for (let i = 0; i < allEdges.length; i += 1) {
    const e = allEdges[i]
    if (!isFlowEdge(e)) continue
    const src = readEndpointId((e as { source?: unknown }).source)
    const tgt = readEndpointId((e as { target?: unknown }).target)
    if (src) included.add(src)
    if (tgt) included.add(tgt)
  }

  if (included.size === 0) return data

  const nodes = allNodes.filter(n => included.has(String((n as { id?: unknown })?.id || '').trim()))
  const edges = allEdges.filter(e => {
    const src = readEndpointId((e as { source?: unknown }).source)
    const tgt = readEndpointId((e as { target?: unknown }).target)
    return src && tgt && included.has(src) && included.has(tgt)
  })

  return { ...data, nodes, edges }
}
