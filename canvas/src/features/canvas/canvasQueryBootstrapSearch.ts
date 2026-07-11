import {
  QUERY_PARAM_IMPORT_CANVAS_EMBED,
  QUERY_PARAM_OPEN_EDITOR_WORKSPACE,
} from '@/lib/routing/queryParams'

export const shouldOpenEditorWorkspaceFromSearch = (search: string): boolean => {
  const raw = String(search || '')
  if (!raw) return false
  const params = new URLSearchParams(raw)
  return String(params.get(QUERY_PARAM_OPEN_EDITOR_WORKSPACE) || '').trim().length > 0
}

export const shouldOpenCanvasEmbedImportFromSearch = (search: string): boolean => {
  const raw = String(search || '')
  if (!raw) return false
  const params = new URLSearchParams(raw)
  return String(params.get(QUERY_PARAM_IMPORT_CANVAS_EMBED) || '').trim().length > 0
}

export const removeCanvasEmbedImportFromSearch = (search: string): string => {
  const params = new URLSearchParams(String(search || ''))
  params.delete(QUERY_PARAM_IMPORT_CANVAS_EMBED)
  params.delete(QUERY_PARAM_OPEN_EDITOR_WORKSPACE)
  const next = params.toString()
  return next ? `?${next}` : ''
}
