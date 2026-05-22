type ThreeLayoutPositions = Record<string, [number, number, number]>

type LocalThreeLayoutPositionsInspectionArgs = {
  markdownDocumentName?: unknown
  canvasRenderMode?: unknown
  canvas3dMode?: unknown
  viewPinned?: unknown
  selectedNodeId?: unknown
  positions?: ThreeLayoutPositions | null | undefined
}

const DEFAULT_SAMPLE_LIMIT = 25
const HARD_SAMPLE_LIMIT = 50

const normalizeString = (value: unknown): string => String(value || '').trim()

const roundCoordinate = (value: number): number => Math.round(value * 1000) / 1000

const readPositionTuple = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 3) return null
  const x = Number(value[0])
  const y = Number(value[1])
  const z = Number(value[2])
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return {
    x: roundCoordinate(x),
    y: roundCoordinate(y),
    z: roundCoordinate(z),
  }
}

export const inspectLocalThreeLayoutPositions = (args: LocalThreeLayoutPositionsInspectionArgs) => {
  const documentName = normalizeString(args.markdownDocumentName)
  const canvasRenderMode = normalizeString(args.canvasRenderMode) || '2d'
  const canvas3dMode = normalizeString(args.canvas3dMode) || '3d'
  const viewPinned = args.viewPinned === true
  const selectedNodeId = normalizeString(args.selectedNodeId) || null
  const positions = args.positions || null

  if (canvasRenderMode !== '3d') {
    return {
      available: false,
      sourceKind: 'browser-local-3d-layout',
      documentName: documentName || '',
      canvasRenderMode,
      canvas3dMode,
      viewPinned,
      selectedNodeId,
      selectedNodePosition: null,
      positionCount: 0,
      sampleLimit: DEFAULT_SAMPLE_LIMIT,
      truncated: false,
      samplePositions: [],
      message: 'Local 3d layout-position inspection is currently available only when the canvas render mode is 3d.',
    }
  }

  const positionEntries = positions
    ? Object.entries(positions)
        .map(([id, tuple]) => ({ id: normalizeString(id), position: readPositionTuple(tuple) }))
        .filter((entry) => entry.id && entry.position)
        .sort((a, b) => a.id.localeCompare(b.id))
    : []

  if (!positionEntries.length) {
    return {
      available: false,
      sourceKind: 'browser-local-3d-layout',
      documentName: documentName || '',
      canvasRenderMode,
      canvas3dMode,
      viewPinned,
      selectedNodeId,
      selectedNodePosition: null,
      positionCount: 0,
      sampleLimit: DEFAULT_SAMPLE_LIMIT,
      truncated: false,
      samplePositions: [],
      message: 'No active local 3d layout positions are currently registered in the app runtime.',
    }
  }

  const sampleLimit = Math.min(DEFAULT_SAMPLE_LIMIT, HARD_SAMPLE_LIMIT)
  const selectedNodePosition = selectedNodeId
    ? positionEntries.find((entry) => entry.id === selectedNodeId)?.position || null
    : null

  return {
    available: true,
    sourceKind: 'browser-local-3d-layout',
    documentName: documentName || 'document.md',
    canvasRenderMode,
    canvas3dMode,
    viewPinned,
    selectedNodeId,
    selectedNodePosition,
    positionCount: positionEntries.length,
    sampleLimit,
    truncated: positionEntries.length > sampleLimit,
    samplePositions: positionEntries.slice(0, sampleLimit).map((entry) => ({
      id: entry.id,
      ...entry.position,
    })),
    message: null,
  }
}
