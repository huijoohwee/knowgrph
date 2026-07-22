import type { Canvas3dModeId } from '@/lib/config'
import { resolveXrMotionReferenceStage } from '@/features/three/xrMotionReferenceModel'
import { readXrMotionReferenceRuntime } from '@/features/three/xrMotionReferenceRuntime'
import { XR_MOTION_STAGE_SPAN } from '@/features/three/xrMotionReferenceCoordinates'
import { getThreeConfig, type GraphSchema } from '@/lib/graph/schema'
import type { GlbFit } from '@/lib/three/GlbAssetModel'
import { resolveCssVar } from '@/lib/ui/theme-tokens'

const XR_WORLD_CONTENT_SCALE_MIN = 0.0001
const XR_WORLD_CONTENT_SCALE_MAX = 10_000

export function readXrStageMetersPerUnit(): number {
  const stage = resolveXrMotionReferenceStage(readXrMotionReferenceRuntime().plan.stageId)
  return Math.max(stage.sizeMeters[0], stage.sizeMeters[1], 1) / XR_MOTION_STAGE_SPAN
}

export function boundedInverseFitScale(fit: GlbFit | null): number {
  const fitScale = Number(fit?.scale)
  if (!Number.isFinite(fitScale) || fitScale <= 0) return 1
  return Math.min(XR_WORLD_CONTENT_SCALE_MAX, Math.max(XR_WORLD_CONTENT_SCALE_MIN, 1 / fitScale))
}

export function fitFloorOffset(fit: GlbFit | null): readonly [number, number, number] {
  const floorY = Number(fit?.floorY)
  return [0, Number.isFinite(floorY) ? -floorY : 0, 0]
}

export function resolveSceneBackgroundColor(schema: GraphSchema, mode: Canvas3dModeId): string {
  const raw = getThreeConfig(schema).backgroundColor
  if (typeof raw === 'string' && raw.trim() !== '') return raw
  if (mode === 'voxel') return resolveCssVar('--kg-canvas-bg', '#05050f')
  return resolveCssVar('--kg-canvas-bg', '#ffffff')
}
