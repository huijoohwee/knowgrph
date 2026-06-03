import React from 'react'
import type { ArrangeAction2d } from '@/lib/canvas/arrange2d'
import { computeEvenlyDistributedPositions } from '@/lib/canvas/evenDistribute'
import { isEditableTarget, readArrangeShortcut, readNudgeDelta } from '@/lib/canvas/arrangeShortcuts'
import { readSnapGridConfigFromSchema, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import type { GraphSchema } from '@/lib/graph/schema'

type FramePosition = {
  x: number
  y: number
  w: number
  h: number
}

type PositionMap = Record<string, FramePosition>

export type DesignCanvasArrangeAction = ArrangeAction2d

type UseDesignCanvasArrangeActionsArgs = {
  active: boolean
  positions: PositionMap
  schema: GraphSchema | null | undefined
  selectedNodeId: string | null
  selectedNodeIds: string[]
  setDesignFramePosMany: (updates: Record<string, { x: number; y: number }>) => void
}

type UseDesignCanvasArrangeActionsResult = {
  selectedIds: string[]
  applyArrange: (action: DesignCanvasArrangeAction) => void
}

function commitPositionUpdates(
  updates: Record<string, { x: number; y: number }>,
  setDesignFramePosMany: (updates: Record<string, { x: number; y: number }>) => void,
): void {
  if (Object.keys(updates).length > 0) setDesignFramePosMany(updates)
}

export function useDesignCanvasArrangeActions(args: UseDesignCanvasArrangeActionsArgs): UseDesignCanvasArrangeActionsResult {
  const { active, positions, schema, selectedNodeId, selectedNodeIds, setDesignFramePosMany } = args

  const selectedIds = React.useMemo(() => {
    const out: string[] = []
    const seen = new Set<string>()
    for (let i = 0; i < selectedNodeIds.length; i += 1) {
      const id = String(selectedNodeIds[i] || '').trim()
      if (!id || seen.has(id) || !positions[id]) continue
      seen.add(id)
      out.push(id)
    }
    return out
  }, [positions, selectedNodeIds])

  const applyArrange = React.useCallback(
    (action: DesignCanvasArrangeAction) => {
      if (!active || selectedIds.length < 2) return
      const referenceId = (() => {
        const activeId = String(selectedNodeId || '').trim()
        if (activeId && selectedIds.includes(activeId)) return activeId
        return selectedIds[0] || ''
      })()
      const reference = referenceId ? positions[referenceId] : null
      if (!reference) return
      const updates: Record<string, { x: number; y: number }> = {}
      const grid = readSnapGridConfigFromSchema(schema)
      const gridSize = grid.enabled ? Math.max(grid.x, grid.y) : 0
      const snapX = (value: number) => (grid.enabled ? snapScalarToGrid(value, grid, 'x') : value)
      const snapY = (value: number) => (grid.enabled ? snapScalarToGrid(value, grid, 'y') : value)

      if (action === 'distribute-x' || action === 'distribute-y') {
        const points = selectedIds.map(id => {
          const position = positions[id]!
          return { id, x: position.x + position.w / 2, y: position.y + position.h / 2 }
        })
        const nextCenters = computeEvenlyDistributedPositions({
          nodes: points,
          axis: action === 'distribute-x' ? 'x' : 'y',
          minSpacing: gridSize || 24,
        })
        for (let i = 0; i < selectedIds.length; i += 1) {
          const id = selectedIds[i]!
          const position = positions[id]!
          const center = nextCenters[id]
          if (!center) continue
          updates[id] = {
            x: snapX(action === 'distribute-x' ? center.x - position.w / 2 : position.x),
            y: snapY(action === 'distribute-y' ? center.y - position.h / 2 : position.y),
          }
        }
        commitPositionUpdates(updates, setDesignFramePosMany)
        return
      }

      for (let i = 0; i < selectedIds.length; i += 1) {
        const id = selectedIds[i]!
        const position = positions[id]!
        let x = position.x
        let y = position.y
        if (action === 'align-left') x = reference.x
        if (action === 'align-right') x = reference.x + reference.w - position.w
        if (action === 'align-center-x') x = reference.x + reference.w / 2 - position.w / 2
        if (action === 'align-top') y = reference.y
        if (action === 'align-bottom') y = reference.y + reference.h - position.h
        if (action === 'align-center-y') y = reference.y + reference.h / 2 - position.h / 2
        updates[id] = { x: snapX(x), y: snapY(y) }
      }
      commitPositionUpdates(updates, setDesignFramePosMany)
    },
    [active, positions, schema, selectedIds, selectedNodeId, setDesignFramePosMany],
  )

  React.useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const arrange = readArrangeShortcut(event)
      if (arrange) {
        event.preventDefault()
        applyArrange(arrange)
        return
      }
      if (selectedIds.length === 0) return
      const grid = readSnapGridConfigFromSchema(schema)
      const delta = readNudgeDelta({
        e: event,
        snapGridEnabled: grid.enabled,
        snapGridSize: grid.x,
        snapGridSizeY: grid.y,
      })
      if (!delta) return
      event.preventDefault()
      const updates: Record<string, { x: number; y: number }> = {}
      for (let i = 0; i < selectedIds.length; i += 1) {
        const id = selectedIds[i]!
        const position = positions[id]
        if (!position) continue
        updates[id] = { x: position.x + delta.dx, y: position.y + delta.dy }
      }
      commitPositionUpdates(updates, setDesignFramePosMany)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as AddEventListenerOptions)
    }
  }, [active, applyArrange, positions, schema, selectedIds, setDesignFramePosMany])

  return { selectedIds, applyArrange }
}
