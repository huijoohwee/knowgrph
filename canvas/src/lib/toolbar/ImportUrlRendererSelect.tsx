import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import {
  WORKSPACE_URL_IMPORT_DOCUMENT_MODES,
  WORKSPACE_URL_IMPORT_CANVAS_RENDERERS,
  getWorkspaceUrlImportDocumentModeLabel,
  getWorkspaceUrlImportCanvasRendererLabel,
  isWorkspaceUrlImportCanvasRendererId,
  normalizeWorkspaceUrlImportDocumentMode,
  type WorkspaceUrlImportCanvasRendererId,
  type WorkspaceUrlImportDocumentModeId,
} from '@/features/markdown-workspace/workspaceImport/canvasPresets'

export type ImportUrlRendererPresetOptions = {
  canvas2dRenderer: WorkspaceUrlImportCanvasRendererId
  documentSemanticMode: WorkspaceUrlImportDocumentModeId
}
export type ImportUrlRendererSelection = 'default' | `${WorkspaceUrlImportCanvasRendererId}:${WorkspaceUrlImportDocumentModeId}`

export function parseImportUrlRendererSelection(value: unknown): ImportUrlRendererPresetOptions | null {
  const raw = String(value || '').trim()
  const [rendererRaw, modeRaw] = raw.split(':')
  if (!isWorkspaceUrlImportCanvasRendererId(rendererRaw)) return null
  return {
    canvas2dRenderer: rendererRaw,
    documentSemanticMode: normalizeWorkspaceUrlImportDocumentMode(modeRaw),
  }
}

export function normalizeImportUrlRendererSelection(value: unknown): ImportUrlRendererSelection {
  const parsed = parseImportUrlRendererSelection(value)
  if (parsed) return `${parsed.canvas2dRenderer}:${parsed.documentSemanticMode}`
  return isWorkspaceUrlImportCanvasRendererId(value) ? `${value}:document` : 'default'
}

export function ImportUrlRendererSelect(props: {
  value: ImportUrlRendererSelection
  onChange: (next: ImportUrlRendererSelection) => void
}) {
  return (
    <select
      className={cn(
        'h-[var(--kg-control-height,28px)] px-2 rounded border text-xs',
        UI_THEME_TOKENS.input.border,
        UI_THEME_TOKENS.input.bg,
        UI_THEME_TOKENS.input.text,
      )}
      value={props.value}
      onChange={e => props.onChange(normalizeImportUrlRendererSelection(e.target.value))}
      aria-label="Import URL renderer"
      title="2D renderer"
    >
      <option value="default">Default</option>
      {WORKSPACE_URL_IMPORT_CANVAS_RENDERERS.map(renderer => (
        <optgroup key={renderer} label={getWorkspaceUrlImportCanvasRendererLabel(renderer)}>
          {WORKSPACE_URL_IMPORT_DOCUMENT_MODES.map(mode => (
            <option key={`${renderer}:${mode}`} value={`${renderer}:${mode}`}>
              {`${getWorkspaceUrlImportCanvasRendererLabel(renderer)} / ${getWorkspaceUrlImportDocumentModeLabel(mode)}`}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
