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
  const classDefs = new Map<string, Record<string, unknown>>()
  const nodeClasses = new Map<string, Set<string>>()

  // Track active subgraphs stack
  const subgraphStack: Array<{ name: string; id: string }> = []

  // Helper to parse styles from a string (e.g. "fill:#f9f,stroke:#333,stroke-width:4px")
  const parseStyleString = (styleStr: string): Record<string, unknown> => {
    const styles: Record<string, unknown> = {}
    const normalized = styleStr.trim().replace(/;$/, '')
    const parts = normalized.split(',')
    for (const part of parts) {
      const idx = part.indexOf(':')
      if (idx < 0) continue
      const key = part.slice(0, idx).trim()
      const val = part.slice(idx + 1).trim().replace(/;$/, '')
      if (!key || !val) continue
      if (key === 'fill') styles['visual:fill'] = val
      if (key === 'stroke') styles['visual:stroke'] = val
      if (key === 'stroke-width') {
        const w = parseFloat(val.replace('px', ''))
        if (Number.isFinite(w)) styles['visual:strokeWidth'] = w
        if (Number.isFinite(w)) styles['stroke-width'] = w
      }
      if (key === 'color') styles['visual:color'] = val
    }
    return styles
  }

  const getMergedClassStyles = (nodeName: string): Record<string, unknown> => {
    const classes = nodeClasses.get(nodeName)
    if (!classes) return {}
    let mergedStyles: Record<string, unknown> = {}
    classes.forEach((cls) => {
      const def = classDefs.get(cls)
      if (def) mergedStyles = { ...mergedStyles, ...def }
    })
    return mergedStyles
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() ?? ''
    if (!trimmed) continue
    if (trimmed.startsWith('%%')) continue

    if (trimmed.startsWith('classDef ')) {
      const parts = trimmed.substring(9).trim().split(/\s+/)
      const className = parts[0]
      const styleStr = parts.slice(1).join(' ')
      if (className && styleStr) {
        classDefs.set(className, parseStyleString(styleStr))
      }
      continue
    }

    if (trimmed.startsWith('class ')) {
      const parts = trimmed.substring(6).trim().replace(/;$/, '').split(/\s+/)
      if (parts.length < 2) continue
      const classNamesStr = parts[parts.length - 1]
      const nodesStr = parts.slice(0, parts.length - 1).join(' ')

      const nodeNames = nodesStr
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      const classNames = String(classNamesStr || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      if (!nodeNames.length || !classNames.length) continue
      for (let j = 0; j < nodeNames.length; j += 1) {
        const nodeName = nodeNames[j]!
        if (!nodeClasses.has(nodeName)) nodeClasses.set(nodeName, new Set())
        const set = nodeClasses.get(nodeName)!
        for (let k = 0; k < classNames.length; k += 1) {
          set.add(classNames[k]!)
        }
      }
    }
  }

  // Helper to get or create a node
  const getOrCreateNode = (name: string, label: string | null, lineIndex: number, className?: string): string => {
    const safeName = name.trim()
    if (!safeName) return ''
    
    // Check if already exists
    const existing = mermaidNodeIdsByName.get(safeName)
    // If it exists, we might still want to apply the class if it wasn't applied before?
    // But typically we create it once. 
    // However, if the user does `A:::c1 --> B`, and later `A:::c2 --> C`, Mermaid might merge or override.
    // For simplicity, we assume the first declaration or explicit class statements rule.
    // But since we have the className now, we should probably ensure it's recorded if this is the first time we see it?
    // Actually, `existing` check prevents re-creation. 
    // If we want to support `A:::cls` applying even if node exists, we'd need to update the node.
    // But `ensureNode` might merge properties if we call it again?
    // `ctx.ensureNode` usually merges. Let's check `ensureNode` in parser context.
    // Usually it just pushes to a list or map.
    
    if (existing) {
      // If we have a className that wasn't applied via `class` statement, we might want to apply it.
      // But `ensureNode` creates a JSON-LD object. We can't easily "update" it here without knowing implementation of ensureNode.
      // Assuming ensureNode handles merging or we just ignore subsequent definitions.
      // Let's stick to "first wins" or "existing wins" for now, consistent with current logic.
      return existing
    }

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

    let classStyles = getMergedClassStyles(safeName)
    if (className) {
        const extra = classDefs.get(className)
        if (extra) {
            classStyles = { ...classStyles, ...extra }
        }
    }

    ensureNode({
      '@id': nodeId,
      '@type': 'MermaidNode',
      labels: ['MermaidNode'],
      name: label || safeName,
      chunk_text: (label || safeName).slice(0, 800),
      properties: { ...nodeProps, ...classStyles },
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
    const parent = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null
    
    const classStyles = getMergedClassStyles(safeName)
    ensureNode({
      '@id': subgraphId,
      '@type': 'MermaidSubgraph',
      labels: ['MermaidSubgraph'],
      name: display,
      chunk_text: display.slice(0, 800),
      subgraphName: safeName,
      label: display,
      properties: {
        subgraphName: safeName,
        nodeName: safeName,
        ...(parent ? { mermaidSubgraphName: parent.name } : {}),
        ...classStyles,
      },
      metadata: mkMeta(startIndex + lineIndex, startIndex + lineIndex),
    })

    // If there is a parent subgraph, link it
    if (parent) {
      addRel(parent.id, 'hasMermaidSubgraph', subgraphId)
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
    const parseNodeString = (str: string): { name: string; label: string | null; className?: string } | null => {
      const s = str.trim()
      if (!s) return null
      
      let m: RegExpExecArray | null

      // Check for class suffix: :::className
      let className: string | undefined
      const classMatch = /:::([a-zA-Z0-9_-]+)$/.exec(s)
      let cleanStr = s
      if (classMatch) {
        className = classMatch[1]
        cleanStr = s.substring(0, classMatch.index).trim()
      }

      const finish = (n: string, l: string | null) => ({ name: n, label: l, className })

      // Subroutine: id[[label]]
      m = /^([A-Za-z0-9_.]+)\s*\[\[([^\]]+)\]\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Cylinder: id[(label)]
      m = /^([A-Za-z0-9_.]+)\s*\[\(([^)]+)\)\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Circle: id((label))
      m = /^([A-Za-z0-9_.]+)\s*\(\(([^)]+)\)\)$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Stadium / Pill: id([label])
      m = /^([A-Za-z0-9_.]+)\s*\(\[([^\]]+)\]\)$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Asymmetric: id>label]
      m = /^([A-Za-z0-9_.]+)\s*>\s*([^\]]+)\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Hexagon: id{{label}}
      m = /^([A-Za-z0-9_.]+)\s*\{\{([^}]+)\}\}$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Parallelogram: id[/label/]
      m = /^([A-Za-z0-9_.]+)\s*\[\/([^/]+)\/\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Parallelogram alt: id[\label\]
      m = /^([A-Za-z0-9_.]+)\s*\[\\([^\\]+)\\\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Trapezoid: id[/label\]
      m = /^([A-Za-z0-9_.]+)\s*\[\/([^\]]+)\\\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Trapezoid alt: id[\label/]
      m = /^([A-Za-z0-9_.]+)\s*\[\\([^/]+)\/\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])
      
      // Standard Box: id["label"]
      m = /^([A-Za-z0-9_.]+)\s*\["(.+)"\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2]) 
      
      // Standard Box: id[label]
      m = /^([A-Za-z0-9_.]+)\s*\[([^\]]+)\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])

      // Round Box: id(label)
      m = /^([A-Za-z0-9_.]+)\s*\(([^)]+)\)$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])
      
      // Rhombus: id{label}
      m = /^([A-Za-z0-9_.]+)\s*\{([^}]+)\}$/.exec(cleanStr)
      if (m) return finish(m[1], m[2])
      
      if (/^[A-Za-z0-9_.]+$/.test(cleanStr)) return finish(cleanStr, null)
      
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
        getOrCreateNode(nodeDef.name, nodeDef.label, i, nodeDef.className)
      }
    } else {
      let currentSrcName: string | null = null
      
      const n0 = parseNodeString(parts[0])
      if (n0) {
        getOrCreateNode(n0.name, n0.label, i, n0.className)
        currentSrcName = n0.name
      }
      
      for (let k = 1; k < parts.length; k += 2) {
        const nextNodeStr = parts[k+1] // This is the node
        
        // Check if nextNodeStr is empty (e.g. trailing arrow?)
        if (!nextNodeStr) continue;

        const nNext = parseNodeString(nextNodeStr)
        if (nNext && currentSrcName) {
           getOrCreateNode(nNext.name, nNext.label, i, nNext.className)
           
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
