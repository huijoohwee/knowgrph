import type { Canvas2dRendererId } from '@/lib/config.render'
import type { WorkspaceUrlImportDocumentModeId } from '@/features/markdown-workspace/workspaceImport/canvasPresets'

export type WorkspaceImportUrlOpts = {
  canvas2dRenderer?: Canvas2dRendererId | null
  documentSemanticMode?: WorkspaceUrlImportDocumentModeId | null
}

export type WorkspaceImportWebsiteOpts = {
  generateArtifactDocs?: boolean
  browserEnhance?: boolean
  maxPages?: number
  minPages?: number
  source?: 'import-url' | 'website'
}

export type WorkspaceFileSelection = FileList | ReadonlyArray<File> | null

export type WorkspaceBridgeImportResult = {
  createdPaths?: string[]
  removedPaths?: string[]
}

type WorkspaceBridgeImportReturn = void | WorkspaceBridgeImportResult | Promise<void | WorkspaceBridgeImportResult>

export type MarkdownWorkspaceActionBridge = {
  importLocalFiles?: (files: WorkspaceFileSelection) => WorkspaceBridgeImportReturn
  importLocalImages?: (files: WorkspaceFileSelection) => WorkspaceBridgeImportReturn
  importLocalFolder?: (files: WorkspaceFileSelection) => WorkspaceBridgeImportReturn
  importUrl?: (url: string, opts?: WorkspaceImportUrlOpts) => void
  importWebsite?: (url: string, opts?: WorkspaceImportWebsiteOpts) => void
  createNewFolder?: () => void
  save?: () => void

  export?: {
    duplicateInWorkspace?: () => void
    workspaceFileJsonLd?: () => void
    markdown?: () => void
    png?: () => void
    gltf?: () => void
    glb?: () => void
    htmlWorkspace?: () => void
    htmlViewer?: () => void
    htmlCanvas?: () => void
    json?: () => void
    svg?: () => void
    pdfPortrait?: () => void
    pdfLandscape?: () => void
  }
}

const bridgeById = new Map<string, MarkdownWorkspaceActionBridge>()

export function registerMarkdownWorkspaceActionBridge(id: string, bridge: MarkdownWorkspaceActionBridge): () => void {
  const key = String(id || '').trim() || 'default'
  bridgeById.set(key, bridge)
  return () => {
    bridgeById.delete(key)
  }
}

export function getMarkdownWorkspaceActionBridge(): MarkdownWorkspaceActionBridge {
  const merged: MarkdownWorkspaceActionBridge = {}
  for (const bridge of bridgeById.values()) {
    if (bridge.importLocalFiles) merged.importLocalFiles = bridge.importLocalFiles
    if (bridge.importLocalImages) merged.importLocalImages = bridge.importLocalImages
    if (bridge.importLocalFolder) merged.importLocalFolder = bridge.importLocalFolder
    if (bridge.importUrl) merged.importUrl = bridge.importUrl
    if (bridge.importWebsite) merged.importWebsite = bridge.importWebsite
    if (bridge.createNewFolder) merged.createNewFolder = bridge.createNewFolder
    if (bridge.save) merged.save = bridge.save
    if (bridge.export) {
      merged.export = {
        ...(merged.export || {}),
        ...bridge.export,
      }
    }
  }
  return merged
}
