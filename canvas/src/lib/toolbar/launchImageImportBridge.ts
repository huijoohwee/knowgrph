import { getMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { useGraphStore } from '@/hooks/useGraphStore'

type PushImportToast = (toast: {
  id: string
  kind: 'warning'
  message: string
  dismissible?: boolean
}) => void

const IMAGE_IMPORT_BRIDGE_RETRY_DELAYS_MS = [0, 75, 250, 750] as const

const openWorkspaceEditorForImport = (): void => {
  try {
    const state = useGraphStore.getState()
    state.setWorkspaceViewMode('editor')
    state.setEditorWorkspacePane('markdown')
    state.setWorkspaceCanvasPaneOpen(true)
  } catch {
    void 0
  }
}

const importLocalImagesViaWorkspaceBridge = (files: readonly File[]): boolean => {
  if (files.length === 0) return true
  const launchBridge = getMarkdownWorkspaceActionBridge()
  if (typeof launchBridge.importLocalImages !== 'function') return false
  launchBridge.importLocalImages(files as unknown as FileList)
  return true
}

export const importLocalImagesWithWorkspaceBridgeRetry = (args: {
  files: readonly File[]
  pushUiToast: PushImportToast
}): void => {
  if (importLocalImagesViaWorkspaceBridge(args.files)) return
  openWorkspaceEditorForImport()
  let index = 0
  const schedule = typeof window !== 'undefined' ? window.setTimeout.bind(window) : setTimeout
  const retry = () => {
    if (importLocalImagesViaWorkspaceBridge(args.files)) return
    if (index < IMAGE_IMPORT_BRIDGE_RETRY_DELAYS_MS.length) {
      const delay = IMAGE_IMPORT_BRIDGE_RETRY_DELAYS_MS[index]!
      index += 1
      schedule(retry, delay)
      return
    }
    args.pushUiToast({
      id: 'launch:import:localImages:bridge',
      kind: 'warning',
      message: 'Import Image: open Workspace to import images',
      dismissible: true,
    })
  }
  retry()
}
