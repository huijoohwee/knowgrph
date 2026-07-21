import { useGraphStore } from '@/hooks/useGraphStore'
import {
  XR_NATIVE_CONTROLLER_CAMERA_OPTIONS,
  isXrNativeControllerCameraMode,
  type XrNativeControllerCameraMode,
} from '@/features/three/xrNativeControllerCameraCatalog'
import {
  readXrNativeControllerCamera,
  selectXrNativeControllerCameraMode,
} from '@/features/three/xrNativeControllerCameraRuntime'
import { readXrMotionReferenceRuntime } from '@/features/three/xrMotionReferenceRuntime'
import { readThreeObjectInputOwnership } from '@/features/three/threeObjectInputOwnership'
import type { CanonicalCameraInvocationTokens } from './cameraMcpInvocationCatalog'
import { activateXrSceneSurface } from '@/features/three/xrSceneSurfaceRuntime'

export type CameraSourceSelection = Readonly<{
  action: 'select'
  cameraId: XrNativeControllerCameraMode
  targetId: 'camera'
  invocation: string
}>

export function isCameraSourceInvocation(
  invocation: string,
  canonical: CanonicalCameraInvocationTokens,
): boolean {
  return invocation.split(/\s+/, 1)[0] === canonical.select
}

export function normalizeCameraSourceSelection(
  input: Readonly<Record<string, unknown>>,
  canonical: CanonicalCameraInvocationTokens,
): CameraSourceSelection | null {
  const invocation = String(input.invocation || '').trim()
  if (invocation) {
    if (Object.keys(input).some(key => key !== 'invocation')) return null
    const tokens = invocation.split(/\s+/).filter(Boolean)
    if (tokens.length !== 4 || tokens[0] !== canonical.select) return null
    if (tokens[1] !== canonical.camera || tokens[2] !== canonical.cameraSemantic) return null
    const [key, value, extra] = tokens[3]!.split('=')
    if (key !== 'camera' || extra !== undefined || !isXrNativeControllerCameraMode(value)) return null
    return Object.freeze({ action: 'select', cameraId: value, targetId: 'camera', invocation })
  }
  if (Object.keys(input).some(key => !['action', 'cameraId', 'targetId'].includes(key))) return null
  if (input.action !== 'select' || !isXrNativeControllerCameraMode(input.cameraId)) return null
  const targetId = String(input.targetId || 'camera').replace(/^@+/, '')
  if (targetId !== 'camera') return null
  return Object.freeze({ action: 'select', cameraId: input.cameraId, targetId: 'camera', invocation: '' })
}

export function inspectLocalCameraSource() {
  const state = useGraphStore.getState()
  const motion = readXrMotionReferenceRuntime()
  const selected = readXrNativeControllerCamera().mode
  const timelineCameraActive = state.canvasRenderMode === '3d'
    && state.canvas3dMode === 'xr'
    && state.timelineTransportPlaying === true
    && motion.plan.camera.length > 0
  return {
    selected,
    effectiveOwner: timelineCameraActive ? 'timeline-playback' : selected,
    inputSuspended: readThreeObjectInputOwnership().active,
    available: XR_NATIVE_CONTROLLER_CAMERA_OPTIONS.map(option => ({ ...option })),
  }
}

export function controlLocalCameraSource<T>(
  selection: CameraSourceSelection,
  inspect: () => T,
) {
  if (!activateXrSceneSurface({ panelView: 'camera', openPanel: true })) {
    return {
      ok: false,
      action: selection.action,
      message: 'Camera source selection requires an available shared XR Mode surface.',
      camera: inspect(),
    } as const
  }
  selectXrNativeControllerCameraMode(selection.cameraId)
  return {
    ok: true,
    action: selection.action,
    message: `XR camera source selected: ${selection.cameraId}.`,
    camera: inspect(),
  } as const
}
