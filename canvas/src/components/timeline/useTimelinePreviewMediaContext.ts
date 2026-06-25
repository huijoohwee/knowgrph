import {
  type TimelinePreviewActivitySurfaceModel,
  useTimelinePreviewActivitySurfaceModel,
} from './useTimelinePreviewActivitySurfaceModel'
import {
  type TimelinePreviewFamilyCompactionModel,
  useTimelinePreviewFamilyCompactionModel,
} from './useTimelinePreviewFamilyCompactionModel'
import {
  type TimelinePreviewFamilyDisclosureModel,
  useTimelinePreviewFamilyDisclosureModel,
} from './useTimelinePreviewFamilyDisclosureModel'
import {
  type TimelinePreviewFamilyDisclosureSurfaceModel,
  useTimelinePreviewFamilyDisclosureSurfaceModel,
} from './useTimelinePreviewFamilyDisclosureSurfaceModel'
import {
  type TimelinePreviewFamilySectionLayoutModel,
  useTimelinePreviewFamilySectionLayoutModel,
} from './useTimelinePreviewFamilySectionLayoutModel'
import {
  type TimelinePreviewFamilySectionChromeModel,
  useTimelinePreviewFamilySectionChromeModel,
} from './useTimelinePreviewFamilySectionChromeModel'
import {
  type TimelinePreviewFamilySectionBodyModel,
  useTimelinePreviewFamilySectionBodyModel,
} from './useTimelinePreviewFamilySectionBodyModel'
import {
  type TimelinePreviewFamilySectionsModel,
  useTimelinePreviewFamilySectionsModel,
} from './useTimelinePreviewFamilySectionsModel'
import {
  type TimelinePreviewSurfaceShellModel,
  useTimelinePreviewSurfaceShellModel,
} from './useTimelinePreviewSurfaceShellModel'
import {
  type TimelinePreviewMediaCanvasRenderModel,
  useTimelinePreviewMediaCanvasRenderModel,
} from './useTimelinePreviewMediaCanvasRenderModel'
import {
  type TimelinePreviewMediaCanvasFrameModel,
  useTimelinePreviewMediaCanvasFrameModel,
} from './useTimelinePreviewMediaCanvasFrameModel'
import { useTimelinePreviewFamilyDisclosureController } from './useTimelinePreviewFamilyDisclosureController'
import { type TimelinePreviewCollection } from './useTimelinePreviewCollection'
import {
  type TimelinePreviewSurfaceIntent,
  type TimelinePreviewSurfaceModel,
  useTimelinePreviewSurfaceModel,
} from './useTimelinePreviewSurfaceModel'
import { type VideoSequenceExportPlan } from './videoSequenceExport'
import {
  type TimelinePreviewFamilyActivity,
  type TimelineSourceActivityMode,
  useTimelineSourceActivityModel,
} from './useTimelineSourceActivityModel'

export type TimelinePreviewMediaContext = {
  activeFamily: ReturnType<typeof useTimelineSourceActivityModel>['activeFamily']
  activeFamilyId: string
  activeSegment: ReturnType<typeof useTimelineSourceActivityModel>['activeSegment']
  activeSource: ReturnType<typeof useTimelineSourceActivityModel>['activeSource']
  activityMode: TimelineSourceActivityMode
  activitySurface: TimelinePreviewActivitySurfaceModel
  familyActivity: TimelinePreviewFamilyActivity[]
  familyCompaction: TimelinePreviewFamilyCompactionModel
  familyDisclosure: TimelinePreviewFamilyDisclosureModel
  familyDisclosureSurface: TimelinePreviewFamilyDisclosureSurfaceModel
  familySectionBody: TimelinePreviewFamilySectionBodyModel
  familySectionChrome: TimelinePreviewFamilySectionChromeModel
  familySections: TimelinePreviewFamilySectionsModel
  familySectionLayout: TimelinePreviewFamilySectionLayoutModel
  mediaCanvasFrame: TimelinePreviewMediaCanvasFrameModel
  mediaCanvasRender: TimelinePreviewMediaCanvasRenderModel
  selectionActive: boolean
  surfaceModel: TimelinePreviewSurfaceModel
  surfaceShell: TimelinePreviewSurfaceShellModel
}

export function useTimelinePreviewMediaContext(args: {
  collection: TimelinePreviewCollection
  documentKey: string
  exportPlan?: VideoSequenceExportPlan | null
  intent: TimelinePreviewSurfaceIntent
  maxMinutes: number
  positionMinutes: number
  selectedRowKey?: string | null
}): TimelinePreviewMediaContext {
  const surfaceModel = useTimelinePreviewSurfaceModel({
    collection: args.collection,
    intent: args.intent,
  })
  const sourceActivity = useTimelineSourceActivityModel({
    collection: args.collection,
    positionMinutes: args.positionMinutes,
    selectedRowKey: args.selectedRowKey,
    surfaceModel,
  })
  const activitySurface = useTimelinePreviewActivitySurfaceModel({
    activityMode: sourceActivity.activityMode,
    familyActivity: sourceActivity.familyActivity,
    surfaceModel,
  })
  const familyCompaction = useTimelinePreviewFamilyCompactionModel({
    activitySurface,
    intent: args.intent,
  })
  const familyDisclosureController = useTimelinePreviewFamilyDisclosureController({
    autoExpandFamilyId: sourceActivity.activityMode === 'fallback'
      ? ''
      : sourceActivity.activeFamilyId,
    documentKey: args.documentKey,
    familyIds: familyCompaction.families.map(family => family.familyId),
  })
  const familyDisclosure = useTimelinePreviewFamilyDisclosureModel({
    controller: familyDisclosureController,
    familyCompaction,
  })
  const familyDisclosureSurface = useTimelinePreviewFamilyDisclosureSurfaceModel({
    familyDisclosure,
  })
  const familySectionLayout = useTimelinePreviewFamilySectionLayoutModel({
    familyDisclosureSurface,
  })
  const familySectionChrome = useTimelinePreviewFamilySectionChromeModel({
    familyDisclosure,
    familySectionLayout,
  })
  const familySectionBody = useTimelinePreviewFamilySectionBodyModel({
    documentKey: args.documentKey,
    exportPlan: args.exportPlan || null,
    familySectionLayout,
    sequenceMaxMinutes: args.maxMinutes,
  })
  const familySections = useTimelinePreviewFamilySectionsModel({
    familySectionBody,
    familySectionChrome,
  })
  const surfaceShell = useTimelinePreviewSurfaceShellModel({
    activeFamilyId: sourceActivity.activeFamilyId,
    activityMode: sourceActivity.activityMode,
    familyDisclosure,
    familySectionLayout,
  })
  const mediaCanvasRender = useTimelinePreviewMediaCanvasRenderModel({
    familySections,
    surfaceShell,
  })
  const mediaCanvasFrame = useTimelinePreviewMediaCanvasFrameModel({
    renderModel: mediaCanvasRender,
  })
  return {
    activeFamily: sourceActivity.activeFamily,
    activeFamilyId: sourceActivity.activeFamilyId,
    activeSegment: sourceActivity.activeSegment,
    activeSource: sourceActivity.activeSource,
    activityMode: sourceActivity.activityMode,
    activitySurface,
    familyActivity: sourceActivity.familyActivity,
    familyCompaction,
    familyDisclosure,
    familyDisclosureSurface,
    familySectionBody,
    familySectionChrome,
    familySections,
    familySectionLayout,
    mediaCanvasFrame,
    mediaCanvasRender,
    selectionActive: sourceActivity.selectionActive,
    surfaceModel,
    surfaceShell,
  }
}
