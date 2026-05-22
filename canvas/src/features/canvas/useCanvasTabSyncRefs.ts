import React from 'react'
import type {
  CanvasTabSyncBooleanRef,
  CanvasTabSyncNumberRef,
  CanvasTabSyncRef,
  CanvasTabSyncSelectionRef,
  CanvasTabSyncStringRef,
} from '@/features/canvas/canvasTabSyncShared'

export type CanvasTabSyncRuntimeRefs = {
  syncRef: CanvasTabSyncRef
  applyingRemoteRef: CanvasTabSyncBooleanRef
  lastSelectionRef: CanvasTabSyncSelectionRef
  lastSelectionRemoteTimestampRef: CanvasTabSyncNumberRef
  lastSchemaHashRef: CanvasTabSyncStringRef
  lastSchemaRemoteTimestampRef: CanvasTabSyncNumberRef
}

export function useCanvasTabSyncRefs(): CanvasTabSyncRuntimeRefs {
  const syncRef = React.useRef(null) as CanvasTabSyncRef
  const applyingRemoteRef = React.useRef(false)
  const lastSelectionRef = React.useRef(null) as CanvasTabSyncSelectionRef
  const lastSelectionRemoteTimestampRef = React.useRef<number>(0)
  const lastSchemaHashRef = React.useRef<string | null>(null)
  const lastSchemaRemoteTimestampRef = React.useRef<number>(0)

  return {
    syncRef,
    applyingRemoteRef,
    lastSelectionRef,
    lastSelectionRemoteTimestampRef,
    lastSchemaHashRef,
    lastSchemaRemoteTimestampRef,
  }
}
