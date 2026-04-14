export type GraphTableViewMode = 'table' | 'multiDimTable' | 'kanban'

export function parseGraphTableViewMode(raw: unknown): GraphTableViewMode | null {
  if (raw === 'table' || raw === 'multiDimTable' || raw === 'kanban') return raw
  if (String(raw || '').trim().toLowerCase() === 'multidimtable') return 'multiDimTable'
  return null
}
