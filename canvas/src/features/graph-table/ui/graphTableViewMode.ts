export type GraphTableViewMode = 'table' | 'kanban'

export function parseGraphTableViewMode(raw: unknown): GraphTableViewMode | null {
  if (raw === 'table' || raw === 'kanban') return raw
  return null
}

