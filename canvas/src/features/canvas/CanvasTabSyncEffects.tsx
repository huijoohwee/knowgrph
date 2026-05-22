import React from 'react'
import {
  mountCanvasTabSchemaPublishEffect,
  mountCanvasTabSelectionPublishEffect,
} from '@/features/canvas/canvasTabSyncPublishEffectLifecycle'
import {
  selectCanvasTabSchemaPublishEffectDeps,
  selectCanvasTabSchemaPublishEffectProps,
  selectCanvasTabSelectionPublishEffectDeps,
  selectCanvasTabSelectionPublishEffectProps,
  selectCanvasTabSyncTransportEffectDeps,
  selectCanvasTabSyncTransportEffectProps,
} from '@/features/canvas/canvasTabSyncEffectSelectors'
import type { CanvasTabSyncRuntimeProps } from '@/features/canvas/canvasTabSyncRuntimeContract'
import { mountCanvasTabSyncTransportLifecycle } from '@/features/canvas/canvasTabSyncTransportLifecycle'

export function CanvasTabSyncEffects(props: CanvasTabSyncRuntimeProps) {
  React.useEffect(() => {
    return mountCanvasTabSyncTransportLifecycle(
      selectCanvasTabSyncTransportEffectProps(props),
    )
  }, selectCanvasTabSyncTransportEffectDeps(props))

  React.useEffect(() => {
    return mountCanvasTabSelectionPublishEffect(
      selectCanvasTabSelectionPublishEffectProps(props),
    )
  }, selectCanvasTabSelectionPublishEffectDeps(props))

  React.useEffect(() => {
    return mountCanvasTabSchemaPublishEffect(
      selectCanvasTabSchemaPublishEffectProps(props),
    )
  }, selectCanvasTabSchemaPublishEffectDeps(props))

  return null
}
