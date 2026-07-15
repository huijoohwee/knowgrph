import { Box, BoxSelect, Camera, Crosshair, Eraser, Focus, Globe2, Info, LassoSelect, Move3D, MousePointer2, Orbit, Rocket, Rotate3D, Ruler, Scale3D } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type SpatialCaptureIconButton = {
  id: string
  label: string
  Icon: LucideIcon
}

export const SPATIAL_CAPTURE_TOOL_BUTTONS = [
  { id: 'select', label: 'Select', Icon: MousePointer2 },
  { id: 'orbit', label: 'Orbit Camera', Icon: Orbit },
  { id: 'lasso', label: 'Lasso', Icon: LassoSelect },
  { id: 'focus', label: 'Focus', Icon: Focus },
  { id: 'erase', label: 'Erase', Icon: Eraser },
  { id: 'center', label: 'Centers Mode', Icon: Crosshair },
  { id: 'sphere', label: 'Sphere Select', Icon: Crosshair },
  { id: 'box', label: 'Box Select', Icon: BoxSelect },
  { id: 'move', label: 'Move', Icon: Move3D },
  { id: 'rotate', label: 'Rotate', Icon: Rotate3D },
  { id: 'scale', label: 'Scale', Icon: Scale3D },
  { id: 'measure', label: 'Measure', Icon: Ruler },
  { id: 'world', label: 'World', Icon: Globe2 },
  { id: 'bounds', label: 'Bounds', Icon: Box },
] as const satisfies readonly SpatialCaptureIconButton[]

export const SPATIAL_CAPTURE_RAIL_BUTTONS = [
  { id: 'launch', label: 'Launch', Icon: Rocket },
  { id: 'inspect', label: 'Inspect', Icon: Info },
  { id: 'capture', label: 'Capture', Icon: Camera },
  { id: 'motion', label: 'Motion', Icon: Move3D },
] as const satisfies readonly SpatialCaptureIconButton[]

export const SPATIAL_CAPTURE_SIDE_TOOL_IDS = new Set(['center', 'sphere', 'box', 'orbit', 'move', 'rotate'])

export type SpatialCaptureToolId = typeof SPATIAL_CAPTURE_TOOL_BUTTONS[number]['id']
export type SpatialCapturePrimaryModeId = typeof SPATIAL_CAPTURE_RAIL_BUTTONS[number]['id']
export type SpatialCaptureViewAxisId = 'x' | 'y' | 'z'
export type SpatialCaptureAxisId = SpatialCaptureViewAxisId | 'free'
export type SpatialCaptureCenterActionId = 'set' | 'add' | 'remove'

type SpatialCaptureToolListener = (tool: SpatialCaptureToolId) => void
type SpatialCapturePrimaryModeListener = (mode: SpatialCapturePrimaryModeId) => void
type SpatialCaptureAxisListener = (axis: SpatialCaptureAxisId) => void
type SpatialCaptureCenterActionListener = (action: SpatialCaptureCenterActionId) => void

let activeSpatialCaptureTool: SpatialCaptureToolId = 'center'
let activeSpatialCapturePrimaryMode: SpatialCapturePrimaryModeId = 'launch'
let activeSpatialCaptureAxis: SpatialCaptureAxisId = 'y'
let activeSpatialCaptureCenterAction: SpatialCaptureCenterActionId = 'set'
const spatialCaptureToolListeners = new Set<SpatialCaptureToolListener>()
const spatialCapturePrimaryModeListeners = new Set<SpatialCapturePrimaryModeListener>()
const spatialCaptureAxisListeners = new Set<SpatialCaptureAxisListener>()
const spatialCaptureCenterActionListeners = new Set<SpatialCaptureCenterActionListener>()

export function readSpatialCaptureTool(): SpatialCaptureToolId {
  return activeSpatialCaptureTool
}

export function readSpatialCaptureToolLabel(tool: SpatialCaptureToolId = activeSpatialCaptureTool): string {
  return SPATIAL_CAPTURE_TOOL_BUTTONS.find(item => item.id === tool)?.label || 'Centers Mode'
}

export function readSpatialCapturePrimaryMode(): SpatialCapturePrimaryModeId {
  return activeSpatialCapturePrimaryMode
}

export function readSpatialCapturePrimaryModeLabel(mode: SpatialCapturePrimaryModeId = activeSpatialCapturePrimaryMode): string {
  return SPATIAL_CAPTURE_RAIL_BUTTONS.find(item => item.id === mode)?.label || 'Launch'
}

export function readSpatialCaptureAxis(): SpatialCaptureAxisId {
  return activeSpatialCaptureAxis
}

export function readSpatialCaptureCenterAction(): SpatialCaptureCenterActionId {
  return activeSpatialCaptureCenterAction
}

export function setSpatialCaptureTool(tool: SpatialCaptureToolId): void {
  if (activeSpatialCaptureTool === tool) return
  activeSpatialCaptureTool = tool
  for (const listener of spatialCaptureToolListeners) listener(activeSpatialCaptureTool)
}

export function setSpatialCapturePrimaryMode(mode: SpatialCapturePrimaryModeId): void {
  if (activeSpatialCapturePrimaryMode === mode) return
  activeSpatialCapturePrimaryMode = mode
  for (const listener of spatialCapturePrimaryModeListeners) listener(activeSpatialCapturePrimaryMode)
}

export function setSpatialCaptureAxis(axis: SpatialCaptureAxisId): void {
  activeSpatialCaptureAxis = axis
  for (const listener of spatialCaptureAxisListeners) listener(activeSpatialCaptureAxis)
}

export function setSpatialCaptureCenterAction(action: SpatialCaptureCenterActionId): void {
  if (activeSpatialCaptureCenterAction === action) return
  activeSpatialCaptureCenterAction = action
  for (const listener of spatialCaptureCenterActionListeners) listener(activeSpatialCaptureCenterAction)
}

export function subscribeSpatialCaptureTool(listener: SpatialCaptureToolListener): () => void {
  spatialCaptureToolListeners.add(listener)
  return () => {
    spatialCaptureToolListeners.delete(listener)
  }
}

export function subscribeSpatialCapturePrimaryMode(listener: SpatialCapturePrimaryModeListener): () => void {
  spatialCapturePrimaryModeListeners.add(listener)
  return () => {
    spatialCapturePrimaryModeListeners.delete(listener)
  }
}

export function subscribeSpatialCaptureAxis(listener: SpatialCaptureAxisListener): () => void {
  spatialCaptureAxisListeners.add(listener)
  return () => {
    spatialCaptureAxisListeners.delete(listener)
  }
}

export function subscribeSpatialCaptureCenterAction(listener: SpatialCaptureCenterActionListener): () => void {
  spatialCaptureCenterActionListeners.add(listener)
  return () => {
    spatialCaptureCenterActionListeners.delete(listener)
  }
}
