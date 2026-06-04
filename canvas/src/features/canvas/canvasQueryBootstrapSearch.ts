import { QUERY_PARAM_OPEN_EDITOR_WORKSPACE } from '@/lib/routing/queryParams'

export const shouldOpenEditorWorkspaceFromSearch = (search: string): boolean => {
  const raw = String(search || '')
  if (!raw) return false
  const params = new URLSearchParams(raw)
  return String(params.get(QUERY_PARAM_OPEN_EDITOR_WORKSPACE) || '').trim().length > 0
}
