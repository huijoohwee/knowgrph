export type GraphRagTextCentralityConfig = {
  pagerank: boolean
  hits: boolean
  betweenness: boolean
  closeness: boolean
}

export const DEFAULT_GRAPHRAG_TEXT_CENTRALITY_CONFIG: GraphRagTextCentralityConfig = {
  pagerank: true,
  hits: true,
  betweenness: true,
  closeness: true,
}

export const parseGraphRagTextCentralityConfig = (raw: unknown): GraphRagTextCentralityConfig | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const keys = ['pagerank', 'hits', 'betweenness', 'closeness']
  for (const k of keys) {
    if (typeof r[k] !== 'boolean') return null
  }
  return {
    pagerank: r.pagerank as boolean,
    hits: r.hits as boolean,
    betweenness: r.betweenness as boolean,
    closeness: r.closeness as boolean,
  }
}

