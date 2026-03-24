import React from 'react'
import type { GraphDataTableColumnKey } from '@/features/graph-data-table/graphDataTable'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

type GraphDataTableFreezeMode = 'none' | 'label' | 'id'

type UseGraphDataTableFrozenAreaOptions = {
  freezeFirstDataColumn: GraphDataTableFreezeMode
  setFreezeFirstDataColumn: (value: GraphDataTableFreezeMode) => void
  orderedVisibleColumnKeys: GraphDataTableColumnKey[]
  scrollContainerRef: React.RefObject<HTMLDivElement>
  stepNoneLabelPx: number
  stepLabelIdPx: number
}

type UseGraphDataTableFrozenAreaResult = {
  frozenBoundaryColumnKey: GraphDataTableColumnKey | null
  frozenAreaDragIndicatorLeft: number | null
  isFrozenAreaIndicatorVisible: boolean
  handleFrozenAreaPointerDown: (event: PointerEvent) => void
}

const FROZEN_COLUMN_DRAG_NOISE_THRESHOLD_PX = 8

function resolveFrozenBoundaryColumnKey(
  mode: GraphDataTableFreezeMode,
  columns: GraphDataTableColumnKey[],
): GraphDataTableColumnKey | null {
  if (mode === 'label' && columns.includes('label')) return 'label'
  if (mode === 'id' && columns.includes('id')) return 'id'
  if (columns.includes('label')) return 'label'
  if (columns.includes('id')) return 'id'
  return null
}

function getFrozenDragStepThreshold(
  from: GraphDataTableFreezeMode,
  to: GraphDataTableFreezeMode,
  stepNoneLabelPx: number,
  stepLabelIdPx: number,
): number {
  if (from === to) return 0
  if (from === 'none' && to === 'label') return stepNoneLabelPx
  if (from === 'label' && to === 'none') return stepNoneLabelPx
  if (from === 'label' && to === 'id') return stepLabelIdPx
  if (from === 'id' && to === 'label') return stepLabelIdPx
  if (from === 'none' && to === 'id') return stepNoneLabelPx + stepLabelIdPx
  if (from === 'id' && to === 'none') return stepNoneLabelPx + stepLabelIdPx
  return stepLabelIdPx
}

export function useGraphDataTableFrozenArea(
  options: UseGraphDataTableFrozenAreaOptions,
): UseGraphDataTableFrozenAreaResult {
  const {
    freezeFirstDataColumn,
    setFreezeFirstDataColumn,
    orderedVisibleColumnKeys,
    scrollContainerRef,
    stepNoneLabelPx,
    stepLabelIdPx,
  } = options

  const frozenAreaDragStartXRef = React.useRef<number | null>(null)
  const frozenAreaDragStartModeRef = React.useRef<GraphDataTableFreezeMode | null>(null)
  const frozenAreaAvailableModesRef = React.useRef<GraphDataTableFreezeMode[]>([])
  const isFrozenAreaDraggingRef = React.useRef(false)
  const frozenAreaSnapTimeoutRef = React.useRef<number | null>(null)
  const [frozenAreaDragIndicatorLeft, setFrozenAreaDragIndicatorLeft] = React.useState<number | null>(null)
  const [isFrozenAreaIndicatorVisible, setIsFrozenAreaIndicatorVisible] = React.useState(false)

  const availableFreezeModes = React.useMemo<GraphDataTableFreezeMode[]>(() => {
    const modes: GraphDataTableFreezeMode[] = ['none']
    if (orderedVisibleColumnKeys.includes('label')) modes.push('label')
    if (orderedVisibleColumnKeys.includes('id')) modes.push('id')
    return modes
  }, [orderedVisibleColumnKeys])

  const frozenBoundaryColumnKey = React.useMemo<GraphDataTableColumnKey | null>(() => {
    return resolveFrozenBoundaryColumnKey(freezeFirstDataColumn, orderedVisibleColumnKeys)
  }, [freezeFirstDataColumn, orderedVisibleColumnKeys])

  const finishFrozenAreaDrag = React.useCallback(
    (clientX: number | null) => {
      isFrozenAreaDraggingRef.current = false
      const startX = frozenAreaDragStartXRef.current
      const startMode = frozenAreaDragStartModeRef.current
      const modes = frozenAreaAvailableModesRef.current
      frozenAreaDragStartXRef.current = null
      frozenAreaDragStartModeRef.current = null
      frozenAreaAvailableModesRef.current = []
      if (startX == null || !startMode || modes.length === 0 || clientX == null) {
        setIsFrozenAreaIndicatorVisible(false)
        setFrozenAreaDragIndicatorLeft(null)
        return
      }

      const deltaX = clientX - startX
      const absoluteDeltaX = Math.abs(deltaX)
      const currentIndex = modes.indexOf(startMode)
      if (currentIndex === -1) {
        setIsFrozenAreaIndicatorVisible(false)
        setFrozenAreaDragIndicatorLeft(null)
        return
      }

      let finalMode = startMode
      if (absoluteDeltaX >= FROZEN_COLUMN_DRAG_NOISE_THRESHOLD_PX) {
        if (deltaX > 0) {
          let remaining = absoluteDeltaX
          let index = currentIndex
          while (index < modes.length - 1) {
            const nextIndex = index + 1
            const threshold = getFrozenDragStepThreshold(modes[index], modes[nextIndex], stepNoneLabelPx, stepLabelIdPx)
            if (remaining < threshold) break
            remaining -= threshold
            index = nextIndex
          }
          finalMode = modes[index]
        } else if (deltaX < 0) {
          let remaining = absoluteDeltaX
          let index = currentIndex
          while (index > 0) {
            const nextIndex = index - 1
            const threshold = getFrozenDragStepThreshold(modes[index], modes[nextIndex], stepNoneLabelPx, stepLabelIdPx)
            if (remaining < threshold) break
            remaining -= threshold
            index = nextIndex
          }
          finalMode = modes[index]
        }
        if (finalMode !== startMode) {
          setFreezeFirstDataColumn(finalMode)
        }
      }

      const boundaryColumnKey = resolveFrozenBoundaryColumnKey(finalMode, orderedVisibleColumnKeys)
      const container = scrollContainerRef.current
      if (!container || !boundaryColumnKey) {
        setIsFrozenAreaIndicatorVisible(false)
        setFrozenAreaDragIndicatorLeft(null)
        return
      }
      const span = container.querySelector<HTMLSpanElement>(`thead span[data-column-key="${boundaryColumnKey}"]`)
      const headerCell = span ? span.closest('th') : null
      if (!headerCell) {
        setIsFrozenAreaIndicatorVisible(false)
        setFrozenAreaDragIndicatorLeft(null)
        return
      }
      const containerRect = container.getBoundingClientRect()
      const headerRect = headerCell.getBoundingClientRect()
      const left = headerRect.right - containerRect.left + container.scrollLeft
      setIsFrozenAreaIndicatorVisible(true)
      setFrozenAreaDragIndicatorLeft(left)
      if (frozenAreaSnapTimeoutRef.current != null) {
        window.clearTimeout(frozenAreaSnapTimeoutRef.current)
      }
      frozenAreaSnapTimeoutRef.current = window.setTimeout(() => {
        setIsFrozenAreaIndicatorVisible(false)
        setFrozenAreaDragIndicatorLeft(null)
        frozenAreaSnapTimeoutRef.current = null
      }, 160)
    },
    [orderedVisibleColumnKeys, scrollContainerRef, setFreezeFirstDataColumn, stepLabelIdPx, stepNoneLabelPx],
  )

  const handleFrozenAreaPointerDown = React.useCallback(
    (event: PointerEvent) => {
      if (frozenAreaSnapTimeoutRef.current != null) {
        window.clearTimeout(frozenAreaSnapTimeoutRef.current)
        frozenAreaSnapTimeoutRef.current = null
      }
      const clientX = event.clientX
      frozenAreaDragStartXRef.current = clientX
      frozenAreaDragStartModeRef.current = freezeFirstDataColumn
      frozenAreaAvailableModesRef.current = availableFreezeModes
      isFrozenAreaDraggingRef.current = true
      const container = scrollContainerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const left = clientX - rect.left + container.scrollLeft
        setFrozenAreaDragIndicatorLeft(left)
        setIsFrozenAreaIndicatorVisible(true)
      }

      startPointerDrag({
        ev: event,
        cursor: 'col-resize',
        onMove: mv => {
          if (!isFrozenAreaDraggingRef.current) return
          const c = scrollContainerRef.current
          if (!c) return
          const r = c.getBoundingClientRect()
          const left = mv.clientX - r.left + c.scrollLeft
          setFrozenAreaDragIndicatorLeft(left)
        },
        onEnd: up => {
          finishFrozenAreaDrag(up.clientX)
        },
        onCancel: () => {
          finishFrozenAreaDrag(null)
        },
      })
    },
    [availableFreezeModes, finishFrozenAreaDrag, freezeFirstDataColumn, scrollContainerRef],
  )

  return {
    frozenBoundaryColumnKey,
    frozenAreaDragIndicatorLeft,
    isFrozenAreaIndicatorVisible,
    handleFrozenAreaPointerDown,
  }
}
