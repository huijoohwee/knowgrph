export type GraphTableViewMode = 'table' | 'multiDimTable' | 'kanban' | 'geospatial'

export function parseGraphTableViewMode(raw: unknown): GraphTableViewMode | null {
  if (raw === 'table' || raw === 'multiDimTable' || raw === 'kanban') return raw
  if (raw === 'geospatial') return 'geospatial'
  if (String(raw || '').trim().toLowerCase() === 'multidimtable') return 'multiDimTable'
  if (String(raw || '').trim().toLowerCase() === 'geospatial') return 'geospatial'
  return null
}
