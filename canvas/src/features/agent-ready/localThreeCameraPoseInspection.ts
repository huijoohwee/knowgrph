import type { ThreeCameraPose } from '@/hooks/store/store-types/core'

type LocalThreeCameraPoseInspectionArgs = {
  markdownDocumentName?: unknown
  canvasRenderMode?: unknown
  canvas3dMode?: unknown
  viewPinned?: unknown
  pose?: ThreeCameraPose | null | undefined
}

const normalizeString = (value: unknown): string => String(value || '').trim()

export const inspectLocalThreeCameraPose = (args: LocalThreeCameraPoseInspectionArgs) => {
  const documentName = normalizeString(args.markdownDocumentName)
  const canvasRenderMode = normalizeString(args.canvasRenderMode) || '2d'
  const canvas3dMode = normalizeString(args.canvas3dMode) || '3d'
  const viewPinned = args.viewPinned === true
  const pose = args.pose || null

  if (canvasRenderMode !== '3d') {
    return {
      available: false,
      sourceKind: 'browser-local-3d-camera',
      documentName: documentName || '',
      canvasRenderMode,
      canvas3dMode,
      viewPinned,
      pose: null,
      message: 'Local 3D camera pose inspection is currently available only when the canvas render mode is 3d.',
    }
  }

  if (!pose) {
    return {
      available: false,
      sourceKind: 'browser-local-3d-camera',
      documentName: documentName || '',
      canvasRenderMode,
      canvas3dMode,
      viewPinned,
      pose: null,
      message: 'No active local 3d camera pose is currently registered in the app runtime.',
    }
  }

  return {
    available: true,
    sourceKind: 'browser-local-3d-camera',
    documentName: documentName || 'document.md',
    canvasRenderMode,
    canvas3dMode,
    viewPinned,
    pose,
    hasPerspective: typeof pose.fov === 'number',
    hasZoom: typeof pose.zoom === 'number',
    message: null,
  }
}
