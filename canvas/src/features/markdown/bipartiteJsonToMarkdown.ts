import { parseBipartiteApiGraphPayload } from '@/features/bipartite/apiGraphBipartite'

type TopLevelJson = Record<string, unknown>

const safeText = (v: unknown): string => {
  if (v == null) return ''
  return String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

const safeNum = (v: unknown, digits: number = 3): string => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.round(v * 10 ** digits) / 10 ** digits)
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return String(Math.round(n * 10 ** digits) / 10 ** digits)
  }
  return ''
}

const safeRatio = (v: unknown): string => {
  const n = safeNum(v, 4)
  if (!n) return ''
  const parsed = Number(n)
  if (!Number.isFinite(parsed)) return ''
  return `${Math.round(parsed * 100)}%`
}

const safeRatioOrDash = (v: unknown): string => {
  const r = safeRatio(v)
  return r || '—'
}

const asObj = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

const asArrayObj = (v: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(v)) return []
  return v.filter(x => x && typeof x === 'object' && !Array.isArray(x)) as Array<Record<string, unknown>>
}

const table = (title: string, headers: string[], rows: string[][]): string[] => {
  const out: string[] = []
  out.push(title)
  out.push('')
  out.push(`| ${headers.join(' | ')} |`)
  out.push(`| ${headers.map(() => '---').join(' | ')} |`)
  for (let i = 0; i < rows.length; i += 1) out.push(`| ${rows[i]!.join(' | ')} |`)
  out.push('')
  return out
}

const readNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

const titleCaseWord = (value: string): string => {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const sideLabel = (v: unknown): string => {
  const raw = safeText(v).toLowerCase()
  if (raw === 'problem') return 'Problem'
  if (raw === 'solution') return 'Solution'
  return safeText(v)
}

const metricPriority = (gapRatio: unknown): string => {
  const n = readNumber(gapRatio)
  if (n == null) return '—'
  if (n >= 0.85) return 'Critical'
  if (n >= 0.65) return 'High'
  if (n >= 0.45) return 'Medium'
  return 'Low'
}

const parseLeadingNumber = (text: string): string => {
  const m = text.match(/-?\d+(\.\d+)?/)
  return m ? m[0] : ''
}

export function buildBipartiteMarkdownFromJsonValue(value: unknown): string | null {
  const root = asObj(value)
  if (!root) return null
  const payload = parseBipartiteApiGraphPayload(root)
  if (!payload) return null
  const hasComposite =
    (Array.isArray(payload.member_nodes) && payload.member_nodes.length > 0) ||
    (Array.isArray(payload.hub_nodes) && payload.hub_nodes.length > 0) ||
    (Array.isArray(payload.cross_edges) && payload.cross_edges.length > 0) ||
    (Array.isArray(payload.spoke_edges) && payload.spoke_edges.length > 0)
  if (!hasComposite) return null

  const topMeta = asObj(root.meta)
  const clusters = asArrayObj(root.clusters)
  const hubNodes = asArrayObj(root.hub_nodes)
  const memberNodes = asArrayObj(root.member_nodes)
  const crossEdges = asArrayObj(root.cross_edges)
  const spokeEdges = asArrayObj(root.spoke_edges)
  const whitespace = asArrayObj(root.whitespace)

  const titleProduct = safeText(root.product) || 'Knowledge Graph'
  const titleCanvas = safeText(root.canvas) || 'Bipartite + Hub-Spoke'
  const schemaVersion = safeText(root.schema_version) || 'unknown'
  const generatedAt = safeText(root.generated_at)
  const layoutMeta = asObj(topMeta?.layout)
  const canvasEncoding = asObj(topMeta?.canvas_encoding)

  const crossByProblem = new Map<string, Array<Record<string, unknown>>>()
  const crossBySolution = new Map<string, Array<Record<string, unknown>>>()
  for (let i = 0; i < crossEdges.length; i += 1) {
    const e = crossEdges[i]!
    const p = safeText(e.problem_id)
    const s = safeText(e.solution_id)
    if (p) {
      const list = crossByProblem.get(p) || []
      list.push(e)
      crossByProblem.set(p, list)
    }
    if (s) {
      const list = crossBySolution.get(s) || []
      list.push(e)
      crossBySolution.set(s, list)
    }
  }

  const clusterRows = clusters.map(c => [
    safeText(c.id),
    safeText(c.name),
    sideLabel(c.side),
    safeText(c.color),
    safeText(c.hub_id),
    safeRatioOrDash(c.gap_ratio),
    safeNum(c.member_count),
    safeNum(c.cross_edges),
    safeNum(c.spoke_edges),
    String(sideLabel(c.side) === 'Problem' ? metricPriority(c.gap_ratio) : '—'),
  ])

  const hubRows = hubNodes.map(h => [
    safeText(h.id),
    safeText(h.cluster),
    safeText(h.label),
    safeNum(h.members),
    safeText(h.position) || 'Pinned (fx,fy)',
    `${safeNum(h.ring_r) || '26'}px`,
    `${safeNum(h.inner_r) || '18'}px`,
    `${safeNum(h.halo_r) || '38'}px`,
    safeText(h.position) ? 'Stable anchor' : '',
    safeRatioOrDash(h.gap_ratio),
    safeRatio(h.gap_ratio) ? `Members + ${safeRatio(h.gap_ratio)} gap` : 'Members',
  ])

  const spokeRows = spokeEdges.map(e => [
    safeText(e.id),
    safeText(e.hub_id),
    safeText(e.member_id),
    safeText(e.cluster),
    safeNum(e.force_strength),
    `${safeNum(e.distance_px)}px`,
    'Dashed 3,6',
    '0.22',
    safeText(e.cluster) ? `${safeText(e.cluster)} ownership link` : '',
  ])

  const forceRows = [
    ['forceX', 'Position', 'Members', parseLeadingNumber(safeText(layoutMeta?.problems_x)), safeText(layoutMeta?.problems_x), 'Keeps problem/solution columns'],
    ['forceY', 'Position', 'Members', parseLeadingNumber(safeText(layoutMeta?.cluster_y_spacing)), safeText(layoutMeta?.cluster_y_spacing), 'Keeps cluster lanes'],
    ['forceManyBody(member)', 'Repulsion', 'Members', parseLeadingNumber(safeText(layoutMeta?.member_repulsion)), '—', 'Prevents member overlap'],
    ['forceManyBody(hub)', 'Stabilizer', 'Hubs', parseLeadingNumber(safeText(layoutMeta?.hub_repulsion)), '—', 'Minimal hub drift control'],
    ['forceLink(spoke)', 'Attraction', 'Hub↔Member', parseLeadingNumber(safeText(layoutMeta?.spoke_force)), safeText(layoutMeta?.spoke_force), 'Keeps orbital cluster structure'],
    ['forceLink(cross)', 'Attraction', 'Problem↔Solution', parseLeadingNumber(safeText(layoutMeta?.cross_link_force)), safeText(layoutMeta?.cross_link_force), 'Gentle cross-side pull'],
    ['Hub pin', 'Fixed', 'Hubs', '—', safeText(layoutMeta?.hub_position), 'Hubs stay fixed'],
  ].filter(r => r[4] || r[3])

  const problemRows = memberNodes
    .slice()
    .filter(n => safeText(n.type).toLowerCase() === 'problem')
    .sort((a, b) => {
      const pa = Number(safeNum(a.pmf_score, 6) || '0')
      const pb = Number(safeNum(b.pmf_score, 6) || '0')
      if (pb !== pa) return pb - pa
      return safeText(a.id).localeCompare(safeText(b.id))
    })
    .map((n, idx) => [
      safeText(n.id),
      safeText(n.label),
      safeText(n.cluster),
      safeText(n.hub),
      safeNum(n.gap_score),
      safeNum(n.pmf_score),
      safeNum(n.gap_velocity),
      safeNum(n.source_count),
      safeText(n.specificity),
      safeNum((crossByProblem.get(safeText(n.id)) || []).length),
      safeText(n.alert) === 'true' ? 'Alert' : 'Normal',
      Number(safeNum(n.gap_velocity) || '0') >= 0.7 ? 'Fast' : Number(safeNum(n.gap_velocity) || '0') >= 0.4 ? 'Med' : '—',
      `#${idx + 1}`,
    ])

  const solutionRows = memberNodes
    .slice()
    .filter(n => safeText(n.type).toLowerCase() === 'solution')
    .sort((a, b) => {
      const sa = Number(safeNum(a.source_count, 6) || '0')
      const sb = Number(safeNum(b.source_count, 6) || '0')
      if (sb !== sa) return sb - sa
      return safeText(a.id).localeCompare(safeText(b.id))
    })
    .map(n => {
      const linked = crossBySolution.get(safeText(n.id)) || []
      const strengths = linked
        .map(e => readNumber(e.strength))
        .filter((x): x is number => x != null)
        .sort((a, b) => a - b)
      const strengthRange = strengths.length === 0 ? '—' : strengths.length === 1 ? String(Math.round(strengths[0]! * 100) / 100) : `${Math.round(strengths[0]! * 100) / 100}–${Math.round(strengths[strengths.length - 1]! * 100) / 100}`
      return [
        safeText(n.id),
        safeText(n.label),
        safeText(n.cluster),
        safeText(n.hub),
        safeNum(n.source_count),
        String(linked.length),
        strengthRange,
        '9px',
        Number(safeNum(n.source_count) || '0') > 3 ? '2.0px' : '1.2px',
      ]
    })

  const canvasRows = canvasEncoding
    ? Object.keys(canvasEncoding).map(key => [titleCaseWord(key.replace(/_/g, ' ')), safeText(canvasEncoding[key])])
    : []

  const interactionRows = [
    ['Hover member node', 'Member node', 'Connected members + linked solutions', 'Fade non-connected'],
    ['Hover hub node', 'Hub node', 'Cluster members + spoke links', 'Fade other clusters'],
    ['Click cluster header', 'Cluster heading', 'Collapse/expand cluster members', 'Keep hub visible'],
    ['Toggle hub-spoke visibility', 'Toolbar toggle', 'Show/hide hubs and spoke edges', 'Preserve cross-edge layer'],
  ]

  const whitespaceRows = whitespace.map(w => [
    safeText(w.problem_id),
    safeText(w.label),
    safeText(w.cluster),
    safeText(w.hub),
    safeNum(w.gap_score),
    safeText(w.note),
  ])

  const lines: string[] = []
  lines.push(`# ${titleProduct} — ${titleCanvas}`)
  lines.push(`### Multi-Dimensional Reference · Table Format · v${schemaVersion}`)
  lines.push('*Source: local JSON import pipeline*')
  lines.push('')
  lines.push(`Generated at: ${generatedAt || 'unknown'}`)
  lines.push(`Totals: nodes ${safeNum(topMeta?.total_nodes) || '0'} · edges ${safeNum(topMeta?.total_edges) || '0'} · problems ${safeNum(topMeta?.total_problems) || '0'} · solutions ${safeNum(topMeta?.total_solutions) || '0'}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  if (clusterRows.length > 0) {
    lines.push(...table('## TABLE 1 — CLUSTERS', ['ID', 'Name', 'Side', 'Color', 'Hub ID', 'Gap Ratio', 'Members', 'Cross Edges', 'Spoke Edges', 'Priority'], clusterRows))
    lines.push('---')
    lines.push('')
  }
  if (hubRows.length > 0) {
    lines.push(...table('## TABLE 2 — HUB NODES', ['ID', 'Cluster', 'Label', 'Members', 'Position', 'Outer Ring', 'Inner Ring', 'Halo', 'Animation', 'Gap Ratio', 'Tooltip Shows'], hubRows))
    lines.push('---')
    lines.push('')
  }
  if (spokeRows.length > 0) {
    lines.push(...table('## TABLE 3 — SPOKE EDGES', ['ID', 'Hub', 'Member', 'Cluster', 'Force Strength', 'Distance', 'Render', 'Canvas Opacity', 'Insight'], spokeRows))
    lines.push('---')
    lines.push('')
  }
  if (forceRows.length > 0) {
    lines.push(...table('## TABLE 4 — FORCE SIMULATION PARAMETERS', ['Force', 'Type', 'Applies To', 'Strength', 'Distance / Hint', 'Purpose'], forceRows))
    lines.push('---')
    lines.push('')
  }
  if (problemRows.length > 0) {
    lines.push(...table('## TABLE 5 — PROBLEM NODES', ['ID', 'Label', 'Cluster', 'Hub', 'Gap Score', 'PMF Score', 'Velocity', 'Sources', 'Specificity', 'Solutions', 'Alert', 'Pulse', 'Rank'], problemRows))
    lines.push('---')
    lines.push('')
  }
  if (solutionRows.length > 0) {
    lines.push(...table('## TABLE 6 — SOLUTION NODES', ['ID', 'Label', 'Cluster', 'Hub', 'Sources', 'Problems Linked', 'Strength Range', 'Radius', 'Border'], solutionRows))
    lines.push('---')
    lines.push('')
  }
  if (canvasRows.length > 0) {
    lines.push(...table('## TABLE 7 — CANVAS ENCODING', ['Visual Property', 'Rule'], canvasRows))
    lines.push('---')
    lines.push('')
  }
  lines.push(...table('## TABLE 8 — INTERACTION MATRIX', ['Trigger', 'Target', 'Behavior', 'Effect'], interactionRows))
  lines.push('---')
  lines.push('')
  if (whitespaceRows.length > 0) {
    lines.push(...table('## TABLE 9 — WHITESPACE MAP', ['Problem ID', 'Label', 'Cluster', 'Hub', 'Gap Score', 'Insight'], whitespaceRows))
    lines.push('---')
    lines.push('')
  }
  return lines.join('\n')
}

export function buildBipartiteMarkdownFromJsonText(text: string): string | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return buildBipartiteMarkdownFromJsonValue(parsed)
  } catch {
    return null
  }
}
