import type { Canvas2dRendererId } from '@/lib/config.render'

export type WorkspaceImportUrlOpts = {
  canvas2dRenderer?: Canvas2dRendererId | null
}

export type MarkdownWorkspaceActionBridge = {
  importLocalFiles?: (files: FileList | null) => void
  importLocalFolder?: (files: FileList | null) => void
  importUrl?: (url: string, opts?: WorkspaceImportUrlOpts) => void
  importWebsite?: (url: string) => void
  createNewFolder?: () => void
  save?: () => void

  export?: {
    duplicateInWorkspace?: () => void
    workspaceFileJsonLd?: () => void
    markdown?: () => void
    png?: () => void
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
