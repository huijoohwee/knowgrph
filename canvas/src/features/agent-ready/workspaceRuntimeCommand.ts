import { useGraphStore } from '@/hooks/useGraphStore'
import type { Canvas2dRendererId } from '@/lib/config'
import type { DocumentSemanticMode, WorkspaceViewMode } from '@/hooks/store/types'

export type WorkspaceRuntimeCommandState = {
  markdownDocumentName: string | null
  markdownDocumentText: string | null
  canvasRenderMode: '2d' | '3d'
  canvas2dRenderer: Canvas2dRendererId
  documentSemanticMode: DocumentSemanticMode
  frontmatterModeEnabled: boolean
  workspaceViewMode: WorkspaceViewMode
  workspaceCanvasPaneOpen: boolean
}

export type WorkspaceRuntimeCommandApplyDocumentArgs = {
  name: string
  text: string
  sourceUrl?: string | null
  applyToGraph?: boolean
  forceApplyToGraph?: boolean
  applyViewPreset?: boolean
  canvasRenderMode?: '2d' | '3d'
  canvas2dRenderer?: Canvas2dRendererId
  documentSemanticMode?: DocumentSemanticMode
  frontmatterModeEnabled?: boolean
  workspaceViewMode?: WorkspaceViewMode
  workspaceCanvasPaneOpen?: boolean
}

export type WorkspaceRuntimeCommand = {
  readState: () => WorkspaceRuntimeCommandState
  applyMarkdownDocument: (args: WorkspaceRuntimeCommandApplyDocumentArgs) => Promise<WorkspaceRuntimeCommandState & { applied: boolean }>
}

const readWorkspaceRuntimeCommandState = (): WorkspaceRuntimeCommandState => {
  const state = useGraphStore.getState()
  return {
    markdownDocumentName: typeof state.markdownDocumentName === 'string' && state.markdownDocumentName.trim() ? state.markdownDocumentName : null,
    markdownDocumentText: typeof state.markdownDocumentText === 'string' ? state.markdownDocumentText : null,
    canvasRenderMode: state.canvasRenderMode === '3d' ? '3d' : '2d',
    canvas2dRenderer: state.canvas2dRenderer,
    documentSemanticMode: state.documentSemanticMode === 'keyword' ? 'keyword' : 'document',
    frontmatterModeEnabled: state.frontmatterModeEnabled === true,
    workspaceViewMode: state.workspaceViewMode === 'editor' ? 'editor' : 'canvas',
    workspaceCanvasPaneOpen: state.workspaceCanvasPaneOpen === true,
  }
}

const isDocumentSemanticMode = (value: unknown): value is DocumentSemanticMode => value === 'document' || value === 'keyword'
const isWorkspaceViewMode = (value: unknown): value is WorkspaceViewMode => value === 'canvas' || value === 'editor'
const isCanvasRenderMode = (value: unknown): value is '2d' | '3d' => value === '2d' || value === '3d'

export const createWorkspaceRuntimeCommand = (): WorkspaceRuntimeCommand => ({
  readState: () => readWorkspaceRuntimeCommandState(),
  applyMarkdownDocument: async (args: WorkspaceRuntimeCommandApplyDocumentArgs) => {
    const name = String(args?.name || '').trim()
    if (!name) {
      return { ...readWorkspaceRuntimeCommandState(), applied: false }
    }
    const state = useGraphStore.getState()
    if (isWorkspaceViewMode(args?.workspaceViewMode)) {
      state.setWorkspaceViewMode(args.workspaceViewMode)
    }
    if (typeof args?.workspaceCanvasPaneOpen === 'boolean') {
      state.setWorkspaceCanvasPaneOpen(args.workspaceCanvasPaneOpen)
    }
    const nextCanvasRenderMode = args?.canvasRenderMode
    if (isCanvasRenderMode(nextCanvasRenderMode)) {
      state.setCanvasRenderMode(nextCanvasRenderMode)
    }
    const nextCanvas2dRenderer = args?.canvas2dRenderer
    if (nextCanvas2dRenderer) {
      state.setCanvas2dRenderer(nextCanvas2dRenderer)
    }
    const nextDocumentSemanticMode = args?.documentSemanticMode
    if (isDocumentSemanticMode(nextDocumentSemanticMode)) {
      state.setDocumentSemanticMode(nextDocumentSemanticMode)
    }
    if (typeof args?.frontmatterModeEnabled === 'boolean') {
      state.setFrontmatterModeEnabled(args.frontmatterModeEnabled)
    }
    const applied = await state.setActiveMarkdownDocument({
      name,
      text: String(args?.text || ''),
      sourceUrl: typeof args?.sourceUrl === 'string' ? args.sourceUrl : null,
      applyToGraph: args?.applyToGraph === true,
      forceApplyToGraph: args?.forceApplyToGraph !== false,
      applyViewPreset: args?.applyViewPreset !== false,
    })
    return {
      ...readWorkspaceRuntimeCommandState(),
      applied,
    }
  },
})

declare global {
  interface Window {
    knowgrphWorkspaceCommand?: WorkspaceRuntimeCommand
  }
}

export const installWorkspaceRuntimeCommand = (): (() => void) => {
  if (typeof window === 'undefined') return () => void 0
  const command = createWorkspaceRuntimeCommand()
  window.knowgrphWorkspaceCommand = command
  return () => {
    if (window.knowgrphWorkspaceCommand === command) {
      delete window.knowgrphWorkspaceCommand
    }
  }
}
