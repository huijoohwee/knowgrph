export type SearchResultKind = 'node' | 'edge'

export interface SearchResultBase {
  kind: SearchResultKind
  id: string
  title: string
  meta?: Record<string, unknown>
}

export interface NodeSearchResult extends SearchResultBase {
  kind: 'node'
  meta?: { type?: string; label?: string }
}

export interface EdgeSearchResult extends SearchResultBase {
  kind: 'edge'
  meta?: { source?: string; target?: string; label?: string }
}

export type SearchResult = NodeSearchResult | EdgeSearchResult

