import type { CanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'
import { isCanvas2dRendererId, type Canvas2dRendererId } from '@/lib/config.render'

export const DESIGN_URL_IMPORT_CANVAS_PRESET: CanvasWorkspaceFrontmatterPreset = {
  canvasSurfaceMode: '2d',
  canvasRenderMode: '2d',
  canvas2dRenderer: 'design',
  documentSemanticMode: 'document',
}

export const normalizeWorkspaceUrlImportCanvas2dRenderer = (value: unknown): Canvas2dRendererId | null => {
  return isCanvas2dRendererId(value) ? value : null
}

export const getWorkspaceUrlImportCanvasPreset = (canvas2dRenderer: Canvas2dRendererId | null | undefined): CanvasWorkspaceFrontmatterPreset | null => {
  if (canvas2dRenderer === 'design') return DESIGN_URL_IMPORT_CANVAS_PRESET
  return null
}
