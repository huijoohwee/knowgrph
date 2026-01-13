import { slugify } from './markdownJsonLdUtils'

export interface MermaidParserContext {
  gid: string
  docId: string
  startIndex: number
  mermaidTidyTreeLayout: {
    orientation?: 'vertical' | 'horizontal'
    direction?: 'source-target' | 'target-source'
  } | null
  ensureNode: (node: Record<string, unknown>) => void
  addRel: (src: string, key: string, tgt: string) => void
  mkMeta: (startLine: number, endLine: number) => Record<string, unknown>
  setMermaidTidyTreeLayout: (layout: {
    orientation?: 'vertical' | 'horizontal'
    direction?: 'source-target' | 'target-source'
  }) => void
}

export const parseMermaidFrontmatter = (code: string, ctx: MermaidParserContext): void => {
  const {
    gid,
    docId,
    startIndex,
    ensureNode,
    addRel,
    mkMeta,
    setMermaidTidyTreeLayout,
  } = ctx

  const lines = String(code || '').split('\n')
  if (lines.length === 0) return
  const mermaidSubgraphIdsByName = new Map<string, string>()
  const docSubgraphIds = new Set<string>()
  const mermaidNodeIdsByName = new Map<string, string>()

  let currentSubgraphName: string | null = null
  let currentSubgraphId: string | null = null

  if (!ctx.mermaidTidyTreeLayout) {
    for (let i = 0; i < lines.length; i += 1) {
      const rawLine = lines[i] ?? ''
      const trimmed = rawLine.trim()
      if (!trimmed) continue
      const m = /^graph\s+(TD|LR|BT|RL)\b/i.exec(trimmed)
      if (!m) continue
      const dirToken = String(m[1] || '').toUpperCase()
      const next: {
        orientation?: 'vertical' | 'horizontal'
        direction?: 'source-target' | 'target-source'
      } = {}
      if (dirToken === 'TD') {
        next.orientation = 'vertical'
        next.direction = 'source-target'
      } else if (dirToken === 'BT') {
        next.orientation = 'vertical'
        next.direction = 'target-source'
      } else if (dirToken === 'LR') {
        next.orientation = 'horizontal'
        next.direction = 'source-target'
      } else if (dirToken === 'RL') {
        next.orientation = 'horizontal'
        next.direction = 'target-source'
      }
      if (next.orientation || next.direction) {
        setMermaidTidyTreeLayout(next)
      }
      break
    }
  }

  const ensureSubgraph = (rawName: string, rawLabel: string | null, lineOffset: number): string => {
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
      metadata: mkMeta(startIndex + lineOffset, startIndex + lineOffset),
    })
    if (!docSubgraphIds.has(subgraphId)) {
      docSubgraphIds.add(subgraphId)
      addRel(docId, 'hasMermaidSubgraph', subgraphId)
    }
    return subgraphId
  }

  const attachNodeToCurrentSubgraph = (
    nodeId: string,
    nodeProps: Record<string, unknown>,
  ): Record<string, unknown> => {
    if (!currentSubgraphName || !currentSubgraphId) return nodeProps
    addRel(currentSubgraphId, 'hasMermaidNode', nodeId)
    const nextProps = { ...nodeProps }
    if (!Object.prototype.hasOwnProperty.call(nextProps, 'mermaidSubgraphName')) {
      ;(nextProps as { mermaidSubgraphName?: unknown }).mermaidSubgraphName = currentSubgraphName
    }
    if (!Object.prototype.hasOwnProperty.call(nextProps, 'visual:layer')) {
      const layerIndexFromL = (() => {
        const m = /^L(\d+)$/.exec(currentSubgraphName as string)
        if (!m) return null
        const raw = Number(m[1] || '')
        if (!Number.isFinite(raw)) return null
        const idx = raw + 1
        return idx > 0 ? idx : null
      })()

      const layerIndexFromPhase = (() => {
        const m = /^P(\d+)$/.exec(currentSubgraphName as string)
        if (!m) return null
        const raw = Number(m[1] || '')
        if (!Number.isFinite(raw)) return null
        const idx = raw + 1
        return idx > 0 ? idx : null
      })()

      const layerIndexFromPhaseWord = (() => {
        const m = /^Phase(\d+)$/.exec(currentSubgraphName as string)
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
          : layerIndexFromPhaseWord != null
          ? layerIndexFromPhaseWord
          : layerIndexFromSpecial

      if (layerIndex != null) {
        ;(nextProps as { ['visual:layer']?: unknown })['visual:layer'] = layerIndex
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
        const id = ensureSubgraph(subgraphName, subgraphLabel, i)
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
      metadata: mkMeta(startIndex + i, startIndex + i),
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
            metadata: mkMeta(startIndex + i, startIndex + i),
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
            metadata: mkMeta(startIndex + i, startIndex + i),
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
