import { slugify } from './markdownJsonLdUtils'

export interface MermaidParserContext {
  gid: string
  docId: string
  startIndex: number
  ensureNode: (node: Record<string, unknown>) => void
  addRel: (src: string, key: string, tgt: string) => void
  mkMeta: (startLine: number, endLine: number) => Record<string, unknown>
}

/**
 * Parses Mermaid frontmatter code.
 * Supports:
 * - Flowchart (graph TD, LR, etc.)
 * - Subgraphs (nested, labeled)
 * - Nodes with labels (including Markdown strings in quotes)
 * - Edges (--> , ---, -.->, ==>) with labels
 * - Click events
 */
export const parseMermaidFrontmatter = (code: string, ctx: MermaidParserContext): void => {
  const {
    gid,
    docId,
    startIndex,
    ensureNode,
    addRel,
    mkMeta,
  } = ctx

  const lines = String(code || '').split('\n')
  if (lines.length === 0) return

  const mermaidNodeIdsByName = new Map<string, string>()
  const mermaidSubgraphIdsByName = new Map<string, string>()
  const docSubgraphIds = new Set<string>()

  // Track active subgraphs stack
  const subgraphStack: Array<{ name: string; id: string }> = []

  // Helper to get or create a node
  const getOrCreateNode = (name: string, label: string | null, lineIndex: number): string => {
    const safeName = name.trim()
    if (!safeName) return ''
    
    // Check if already exists
    const existing = mermaidNodeIdsByName.get(safeName)
    if (existing) return existing

    const nodeId = `mermaid:${gid}:${slugify(safeName)}`
    mermaidNodeIdsByName.set(safeName, nodeId)

    // Determine parent subgraph
    const currentSubgraph = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null
    
    const nodeProps: Record<string, unknown> = {
      nodeName: safeName,
      label: label ?? safeName, // Use name as label if no label provided
    }

    if (currentSubgraph) {
      nodeProps.mermaidSubgraphName = currentSubgraph.name
      // Also link the node to the subgraph
      addRel(currentSubgraph.id, 'hasMermaidNode', nodeId)
      
      // Attempt to infer tags from subgraph name (heuristic for schema-driven colors)
      const tags = inferTagsFromSubgraphName(currentSubgraph.name)
      if (tags.length > 0) {
        nodeProps.tags = tags
      }
    }

    ensureNode({
      '@id': nodeId,
      '@type': 'MermaidNode',
      labels: ['MermaidNode'],
      name: label || safeName,
      chunk_text: (label || safeName).slice(0, 800),
      properties: nodeProps,
      metadata: mkMeta(startIndex + lineIndex, startIndex + lineIndex),
    })
    
    // Link to document
    addRel(docId, 'hasMermaidNode', nodeId)

    return nodeId
  }

  // Helper to ensure subgraph exists
  const ensureSubgraph = (name: string, label: string | null, lineIndex: number): string => {
    const safeName = name.trim()
    if (!safeName) return ''
    
    const existing = mermaidSubgraphIdsByName.get(safeName)
    if (existing) return existing

    const subgraphId = `mermaid:${gid}:subgraph:${slugify(safeName)}`
    mermaidSubgraphIdsByName.set(safeName, subgraphId)

    const display = label || safeName
    
    ensureNode({
      '@id': subgraphId,
      '@type': 'MermaidSubgraph',
      labels: ['MermaidSubgraph'],
      name: display,
      chunk_text: display.slice(0, 800),
      subgraphName: safeName,
      label: display,
      metadata: mkMeta(startIndex + lineIndex, startIndex + lineIndex),
    })

    // If there is a parent subgraph, link it
    const parent = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null
    if (parent) {
      addRel(parent.id, 'hasMermaidSubgraph', subgraphId)
      // For DAGRE layout: nested subgraphs need parent relationship too
      // We can use the same mechanism: 'mermaidSubgraphName' property
      // But we need to update the node we just created.
      // Since 'ensureNode' merges, we can call it again or just assume logic handles it?
      // Our mermaid.ts layout looks for 'mermaidSubgraphName'.
      // So let's add it.
       ensureNode({
          '@id': subgraphId,
          properties: {
             mermaidSubgraphName: parent.name
          }
       });
    } else {
      // Top level subgraph attached to document
       if (!docSubgraphIds.has(subgraphId)) {
        docSubgraphIds.add(subgraphId)
        addRel(docId, 'hasMermaidSubgraph', subgraphId)
      }
    }
    
    return subgraphId
  }

  // 2. Second pass: Parse nodes, edges, subgraphs
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('graph ')) continue
    if (trimmed.startsWith('%%')) continue

    // --- Subgraph Start ---
    if (trimmed.toLowerCase().startsWith('subgraph ')) {
      const m = /^subgraph\s+([A-Za-z0-9_]+)(?:\s*\[([^\]]+)\]|\s+"([^"]+)")?/.exec(trimmed)
      if (m) {
        const id = m[1]
        const label = m[3] || m[2] || id
        const subgraphId = ensureSubgraph(id, label, i)
        subgraphStack.push({ name: id, id: subgraphId })
      }
      continue
    }

    // --- Subgraph End ---
    if (trimmed === 'end') {
      subgraphStack.pop()
      continue
    }

    // --- Click Event ---
    const clickMatch = /^click\s+([A-Za-z0-9_.]+)\s+"#([^"]+)"/.exec(trimmed)
    if (clickMatch) {
      const nodeName = clickMatch[1]
      const anchor = clickMatch[2]
      const nodeId = mermaidNodeIdsByName.get(nodeName)
      if (nodeId && anchor) {
         addRel(nodeId, 'pointsTo', `anchor:${gid}:${anchor}`)
      }
      continue
    }

    // --- Nodes & Edges ---
    // Helper to parse a potential node string
    const parseNodeString = (str: string): { name: string; label: string | null } | null => {
      const s = str.trim()
      if (!s) return null
      
      let m = /^([A-Za-z0-9_.]+)\s*\["(.+)"\]$/.exec(s)
      if (m) return { name: m[1], label: m[2] } 
      
      m = /^([A-Za-z0-9_.]+)\s*\[([^\]]+)\]$/.exec(s)
      if (m) return { name: m[1], label: m[2] }

      m = /^([A-Za-z0-9_.]+)\s*\(([^)]+)\)$/.exec(s)
      if (m) return { name: m[1], label: m[2] }
      
      m = /^([A-Za-z0-9_.]+)\s*\{([^}]+)\}$/.exec(s)
      if (m) return { name: m[1], label: m[2] }
      
      if (/^[A-Za-z0-9_.]+$/.test(s)) return { name: s, label: null }
      
      return null
    }

    // Improved Arrow Regex: Allow spaces or no spaces
    // Use capture group to keep the delimiter
    // Regex matches: --text-->, -->, -.->, ==>
    // And optionally labeled like `|label|`
    // We split by: ( (arrow_part) (optional_label) )
    // BUT split regex in JS is tricky.
    
    // Let's use a simpler approach: Match (Node) (Link) (Node) (Link) ...
    // But nodes can contain special chars in labels.
    
    // We try to split by the link operators, keeping them.
    // Link operators:
    // \s*--+>\s*
    // \s*-\.->\s*
    // \s*==+>\s*
    // \s*---\s*
    // And labeled: \s*--\s*text\s*--\s* or \s*--\s*text\s*-->\s* (complex)
    
    // We stick to the basic arrows for now but make spaces optional.
    // The previous regex was `/\s+((?:--+|-\.-+|==+)(?:>)?(?:\|[^|]+\|)?)\s+/`
    // New regex: allow 0 spaces around arrow.
    // `/\s*((?:--+|-\.-+|==+)(?:>)?(?:\|[^|]+\|)?)\s*/`
    // Note: This might match `A-->B` as `A`, `-->`, `B`.
    
    const arrowRegex = /\s*((?:--+|-\.-+|==+)(?:>)?(?:\|[^|]+\|)?)\s*/
    const parts = trimmed.split(arrowRegex)
    
    if (parts.length === 1) {
      const nodeDef = parseNodeString(parts[0])
      if (nodeDef) {
        getOrCreateNode(nodeDef.name, nodeDef.label, i)
      }
    } else {
      let currentSrcName: string | null = null
      
      const n0 = parseNodeString(parts[0])
      if (n0) {
        getOrCreateNode(n0.name, n0.label, i)
        currentSrcName = n0.name
      }
      
      for (let k = 1; k < parts.length; k += 2) {
        const edgeStr = parts[k] // This is the separator (arrow)
        const nextNodeStr = parts[k+1] // This is the node
        
        // Check if nextNodeStr is empty (e.g. trailing arrow?)
        if (!nextNodeStr) continue;

        const nNext = parseNodeString(nextNodeStr)
        if (nNext && currentSrcName) {
           getOrCreateNode(nNext.name, nNext.label, i)
           
           const srcId = mermaidNodeIdsByName.get(currentSrcName)
           const tgtId = mermaidNodeIdsByName.get(nNext.name)
           
           if (srcId && tgtId) {
             addRel(srcId, 'pointsTo', tgtId)
           }
           
           currentSrcName = nNext.name
        }
      }
    }
  }
}

function inferTagsFromSubgraphName(name: string): string[] {
  const n = name.toUpperCase()
  if (n.includes('L0') || n.includes('OUTCOME')) return ['idea']
  if (n.includes('L1') || n.includes('PIPELINE')) return ['execution']
  if (n.includes('L2') || n.includes('OPERATION')) return ['pivot']
  return []
}
