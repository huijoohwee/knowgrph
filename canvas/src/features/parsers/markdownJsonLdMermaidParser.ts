import { hashStringToHex } from '@/lib/hash/stringHash'
import { slugify } from './markdownJsonLdUtils'

export interface MermaidParserContext {
  gid: string
  docId: string
  diagramId?: string
  diagramScope?: 'frontmatter' | 'block'
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
    diagramId,
    diagramScope,
    startIndex,
    ensureNode,
    addRel,
    mkMeta,
  } = ctx
  const scope: 'frontmatter' | 'block' = diagramScope === 'frontmatter' ? 'frontmatter' : 'block'
  const isFrontmatter = scope === 'frontmatter'

  const lines = String(code || '').split('\n')
  if (lines.length === 0) return

  const diagramKey = diagramId ? hashStringToHex(diagramId) : 'd'

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

  const mapShapeToPrimitive = (shape: string | null | undefined): 'node' | 'edge' | 'cluster' => {
    const v = String(shape || '').trim().toLowerCase()
    if (v === 'circle') return 'cluster'
    if (v === 'hex') return 'edge'
    return 'node'
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
  const getOrCreateNode = (
    name: string,
    label: string | null,
    lineIndex: number,
    className?: string,
    shape?: string | null,
  ): string => {
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

    const nodeId = `mermaid:${gid}:${diagramKey}:${slugify(safeName)}`
    mermaidNodeIdsByName.set(safeName, nodeId)

    // Determine parent subgraph
    const currentSubgraph = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null
    
    const nodeProps: Record<string, unknown> = {
      nodeName: safeName,
      label: label ?? safeName, // Use name as label if no label provided
      'visual:layer': Math.max(1, subgraphStack.length + 1),
      'frontmatter:primitive': mapShapeToPrimitive(shape),
      mermaidScope: scope,
      ...(isFrontmatter ? { isMermaidFrontmatter: true } : {}),
      ...(diagramId ? { mermaidDiagramId: diagramId } : {}),
    }
    if (shape && typeof shape === 'string') {
      const v = shape.trim().toLowerCase()
      if (v === 'circle' || v === 'rect' || v === 'diamond' || v === 'hex') {
        nodeProps['visual:shape'] = v
      }
    }

    if (currentSubgraph) {
      nodeProps.mermaidSubgraphName = currentSubgraph.name
      nodeProps['visual:parentId'] = currentSubgraph.id
      nodeProps['visual:topParentId'] = subgraphStack.length > 0 ? subgraphStack[0]!.id : currentSubgraph.id
      // Also link the node to the subgraph
      addRel(currentSubgraph.id, 'hasMermaidNode', nodeId)
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

    const subgraphId = `mermaid:${gid}:${diagramKey}:subgraph:${slugify(safeName)}`
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
        'frontmatter:primitive': 'cluster',
        'visual:layer': Math.max(1, subgraphStack.length + 1),
        mermaidScope: scope,
        ...(isFrontmatter ? { isMermaidFrontmatter: true } : {}),
        ...(diagramId ? { mermaidDiagramId: diagramId } : {}),
        'visual:topParentId': subgraphStack.length > 0 ? subgraphStack[0]!.id : subgraphId,
        ...(parent ? { mermaidSubgraphName: parent.name } : {}),
        ...(parent ? { 'visual:parentId': parent.id } : {}),
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
      const unquote = (raw: string): string => {
        const v = String(raw || '').trim()
        if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
          return v.slice(1, -1)
        }
        return v
      }

      const m =
        /^subgraph\s+([A-Za-z0-9_.-]+)(?:\s*\[([^\]]+)\]|\s+"([^"]+)")?/.exec(trimmed) ||
        /^subgraph\s+"([^"]+)"$/.exec(trimmed) ||
        /^subgraph\s+(.+)$/.exec(trimmed)

      if (m) {
        const hasExplicitId = m.length > 1 && /^[A-Za-z0-9_.-]+$/.test(String(m[1] || '').trim())
        const id = hasExplicitId ? String(m[1] || '').trim() : slugify(String(m[1] || '').trim() || `subgraph-${i + 1}`)
        const labelRaw = hasExplicitId ? String(m[3] || m[2] || m[1] || '') : String(m[1] || '')
        const label = unquote(labelRaw) || id
        const subgraphId = ensureSubgraph(id, label, i)
        subgraphStack.push({ name: id, id: subgraphId })
      }
      continue
    }

    // --- Subgraph End ---
    if (trimmed.toLowerCase() === 'end') {
      subgraphStack.pop()
      continue
    }



    // --- Click Event ---
    const clickMatch =
      /^click\s+([A-Za-z0-9_.-]+)\s+(?:"(#[^"]+)"|'(#[^']+)')(?:\s+(?:"[^"]*"|'[^']*'))?\s*$/.exec(trimmed)
    if (clickMatch) {
      const nodeName = String(clickMatch[1] || '').trim()
      const href = String(clickMatch[2] || clickMatch[3] || '').trim()
      const anchor = href.startsWith('#') ? href.slice(1).trim() : ''
      const nodeId = nodeName ? mermaidNodeIdsByName.get(nodeName) : undefined
      if (nodeId && anchor) {
        addRel(nodeId, 'pointsTo', `anchor:${gid}:${anchor}`)
      }
      continue
    }

    // --- Nodes & Edges ---
    // Helper to parse a potential node string
    const parseNodeString = (
      str: string,
    ): { name: string; label: string | null; className?: string; shape?: string | null } | null => {
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

      const finish = (n: string, l: string | null, shape?: string | null) => ({ name: n, label: l, className, shape })

      const mapMermaidShape = (raw: string): 'circle' | 'rect' | 'diamond' | 'hex' | null => {
        const v = String(raw || '').trim().toLowerCase()
        if (!v) return null
        if (v === 'circle' || v === 'circ' || v === 'doublecircle') return 'circle'
        if (v === 'diamond' || v === 'rhombus') return 'diamond'
        if (v === 'hex' || v === 'hexagon') return 'hex'
        if (
          v === 'rect' ||
          v === 'rectangle' ||
          v === 'round-rect' ||
          v === 'stadium' ||
          v === 'pill' ||
          v === 'subroutine' ||
          v === 'cyl' ||
          v === 'cylinder' ||
          v === 'parallelogram' ||
          v === 'trapezoid' ||
          v === 'trap' ||
          v === 'lean-right' ||
          v === 'lean-left'
        ) {
          return 'rect'
        }
        return 'rect'
      }

      const unquoteLocal = (raw: string): string => {
        const v = String(raw || '').trim()
        if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
          return v.slice(1, -1)
        }
        return v
      }

      const unescapeQuoted = (raw: string): string => {
        const s = String(raw || '')
        return s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\')
      }

      const parseAtShapeSyntax = () => {
        const idx = cleanStr.indexOf('@{')
        if (idx <= 0) return null
        if (!cleanStr.trimEnd().endsWith('}')) return null
        const name = cleanStr.slice(0, idx).trim()
        if (!/^[A-Za-z0-9_.-]+$/.test(name)) return null
        const body = cleanStr.slice(idx + 2, cleanStr.lastIndexOf('}')).trim()
        const shapeMatch = /(?:^|,)\s*shape\s*:\s*([A-Za-z0-9_-]+|"[^"]*"|'[^']*')\s*(?:,|$)/i.exec(body)
        const rawShape = shapeMatch ? String(shapeMatch[1] || '').trim() : ''
        const shapeValue = unquoteLocal(rawShape)
        const labelMatch = /(?:^|,)\s*(?:label|text)\s*:\s*("[^"]*"|'[^']*'|`[^`]*`|[^,}]+)\s*(?:,|$)/i.exec(body)
        const rawLabel = labelMatch ? String(labelMatch[1] || '').trim() : ''
        const labelValue = (() => {
          if (!rawLabel) return null
          const v = rawLabel.startsWith('`') && rawLabel.endsWith('`') ? rawLabel.slice(1, -1) : unquoteLocal(rawLabel)
          const out = unescapeQuoted(v)
          return out.trim() ? out : null
        })()
        const mapped = shapeValue ? mapMermaidShape(shapeValue) : null
        return finish(name, labelValue, mapped)
      }

      const atSyntax = parseAtShapeSyntax()
      if (atSyntax) return atSyntax

      // Subroutine: id[[label]]
      m = /^([A-Za-z0-9_.-]+)\s*\[\[([^\]]+)\]\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')

      // Cylinder: id[(label)]
      m = /^([A-Za-z0-9_.-]+)\s*\[\(([^)]+)\)\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')

      // Circle: id((label))
      m = /^([A-Za-z0-9_.-]+)\s*\(\(([^)]+)\)\)$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'circle')

      // Stadium / Pill: id([label])
      m = /^([A-Za-z0-9_.-]+)\s*\(\[([^\]]+)\]\)$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')

      // Asymmetric: id>label]
      m = /^([A-Za-z0-9_.-]+)\s*>\s*([^\]]+)\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')

      // Hexagon: id{{label}}
      m = /^([A-Za-z0-9_.-]+)\s*\{\{([^}]+)\}\}$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'hex')

      // Parallelogram: id[/label/]
      m = /^([A-Za-z0-9_.-]+)\s*\[\/([^/]+)\/\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')

      // Parallelogram alt: id[\label\]
      m = /^([A-Za-z0-9_.-]+)\s*\[\\([^\\]+)\\\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')

      // Trapezoid: id[/label\]
      m = /^([A-Za-z0-9_.-]+)\s*\[\/([^\]]+)\\\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')

      // Trapezoid alt: id[\label/]
      m = /^([A-Za-z0-9_.-]+)\s*\[\\([^/]+)\/\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')
      
      // Double Circle: id(((label)))
      m = /^([A-Za-z0-9_.-]+)\s*\(\(\(([^)]+)\)\)\)$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'circle')

      // Circle: id((label))
      m = /^([A-Za-z0-9_.-]+)\s*\(\((.+)\)\)$/.exec(cleanStr)
      if (m) {
        const raw = String(m[2] || '').trim()
        const unquoted =
          raw.length >= 2 && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
            ? raw.slice(1, -1)
            : raw
        return finish(m[1], unquoted, 'circle')
      }

      // Standard Box: id["label"]
      m = /^([A-Za-z0-9_.-]+)\s*\["(.+)"\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect') 
      
      // Standard Box: id[label]
      m = /^([A-Za-z0-9_.-]+)\s*\[([^\]]+)\]$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')

      // Round Box: id(label)
      m = /^([A-Za-z0-9_.-]+)\s*\(([^)]+)\)$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'rect')
      
      // Rhombus: id{label}
      m = /^([A-Za-z0-9_.-]+)\s*\{([^}]+)\}$/.exec(cleanStr)
      if (m) return finish(m[1], m[2], 'diamond')
      
      if (/^[A-Za-z0-9_.-]+$/.test(cleanStr)) return finish(cleanStr, null, null)
      
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
    
    // Updated to support multi-directional and circle/cross edges:
    // o--o, x--x, <-->
    // And labeled edges without pipes: -- text -->, -. text .->, == text ==>
    const arrowRegex = /\s*((?:--+|-\.-+|==+)(?:\s+[^|]+\s+)(?:--+|-\.-+|==+)>?|(?:--+|-\.-+|==+|o--+o|x--+x|<--+>)(?:>)?(?:\s*\|[^|]+\|\s*)?)\s*/
    const parts = trimmed.split(arrowRegex)
    
    if (parts.length === 1) {
      const nodeDef = parseNodeString(parts[0])
      if (nodeDef) {
        getOrCreateNode(nodeDef.name, nodeDef.label, i, nodeDef.className, nodeDef.shape)
      }
    } else {
      let currentSrcName: string | null = null
      
      const n0 = parseNodeString(parts[0])
      if (n0) {
        getOrCreateNode(n0.name, n0.label, i, n0.className, n0.shape)
        currentSrcName = n0.name
      }
      
      for (let k = 1; k < parts.length; k += 2) {
        const nextNodeStr = parts[k+1] // This is the node
        
        // Check if nextNodeStr is empty (e.g. trailing arrow?)
        if (!nextNodeStr) continue;

        const nNext = parseNodeString(nextNodeStr)
        if (nNext && currentSrcName) {
           getOrCreateNode(nNext.name, nNext.label, i, nNext.className, nNext.shape)
           
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
