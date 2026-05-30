import type { CanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'
import type { Canvas2dRendererId } from '@/lib/config.render'

export const WORKSPACE_URL_IMPORT_CANVAS_RENDERERS = ['d3', 'design', 'strybldr'] as const
export const WORKSPACE_URL_IMPORT_DOCUMENT_MODES = ['document', 'keyword'] as const

export type WorkspaceUrlImportCanvasRendererId = (typeof WORKSPACE_URL_IMPORT_CANVAS_RENDERERS)[number]
export type WorkspaceUrlImportDocumentModeId = (typeof WORKSPACE_URL_IMPORT_DOCUMENT_MODES)[number]

export function isWorkspaceUrlImportCanvasRendererId(value: unknown): value is WorkspaceUrlImportCanvasRendererId {
  return value === 'd3' || value === 'design' || value === 'strybldr'
}

export function isWorkspaceUrlImportDocumentModeId(value: unknown): value is WorkspaceUrlImportDocumentModeId {
  return value === 'document' || value === 'keyword'
}

export function normalizeWorkspaceUrlImportDocumentMode(value: unknown): WorkspaceUrlImportDocumentModeId {
  return value === 'keyword' ? 'keyword' : 'document'
}

export function getWorkspaceUrlImportCanvasRendererLabel(value: WorkspaceUrlImportCanvasRendererId): string {
  if (value === 'd3') return 'D3 Graph'
  if (value === 'strybldr') return 'Strybldr'
  return 'Design'
}

export function getWorkspaceUrlImportDocumentModeLabel(value: WorkspaceUrlImportDocumentModeId): string {
  return value === 'keyword' ? 'Keyword Mode' : 'Document Structure Mode'
}

export const D3_URL_IMPORT_CANVAS_PRESET: CanvasWorkspaceFrontmatterPreset = {
  canvasSurfaceMode: '2d',
  canvasRenderMode: '2d',
  canvas2dRenderer: 'd3',
  documentSemanticMode: 'document',
  frontmatterModeEnabled: false,
  multiDimTableModeEnabled: false,
}

export const DESIGN_URL_IMPORT_CANVAS_PRESET: CanvasWorkspaceFrontmatterPreset = {
  canvasSurfaceMode: '2d',
  canvasRenderMode: '2d',
  canvas2dRenderer: 'design',
  documentSemanticMode: 'document',
  frontmatterModeEnabled: false,
  multiDimTableModeEnabled: false,
}

export const STRYBLDR_URL_IMPORT_CANVAS_PRESET: CanvasWorkspaceFrontmatterPreset = {
  canvasSurfaceMode: '2d',
  canvasRenderMode: '2d',
  canvas2dRenderer: 'strybldr',
  documentSemanticMode: 'document',
  frontmatterModeEnabled: false,
  multiDimTableModeEnabled: false,
}

export const normalizeWorkspaceUrlImportCanvas2dRenderer = (value: unknown): WorkspaceUrlImportCanvasRendererId | null => {
  return isWorkspaceUrlImportCanvasRendererId(value) ? value : null
}

export const getWorkspaceUrlImportCanvasPreset = (
  canvas2dRenderer: Canvas2dRendererId | null | undefined,
  documentSemanticMode?: WorkspaceUrlImportDocumentModeId | null,
): CanvasWorkspaceFrontmatterPreset | null => {
  const mode = normalizeWorkspaceUrlImportDocumentMode(documentSemanticMode)
  if (canvas2dRenderer === 'd3') return { ...D3_URL_IMPORT_CANVAS_PRESET, documentSemanticMode: mode }
  if (canvas2dRenderer === 'design') return { ...DESIGN_URL_IMPORT_CANVAS_PRESET, documentSemanticMode: mode }
  if (canvas2dRenderer === 'strybldr') return { ...STRYBLDR_URL_IMPORT_CANVAS_PRESET, documentSemanticMode: mode }
  return null
}
