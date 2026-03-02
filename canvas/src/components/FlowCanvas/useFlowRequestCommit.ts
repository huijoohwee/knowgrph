import React from 'react'
import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { FlowConfig } from '@/components/FlowCanvas/config'
import type { FlowNativeDrawArgs, FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { requestFlowNativeDraw } from '@/components/FlowCanvas/nativeRuntime'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import { relaxFlowSceneNodePositions } from '@/components/FlowCanvas/relaxScenePositions'
import { computeFlowCommitRelaxSteps } from '@/components/FlowCanvas/relaxStepPolicy'

export function useFlowRequestCommit(args: {
  cacheKey: string
  flowConfig: FlowConfig
  flowPresentation: { portHandles: { enabled: boolean; sizePx: number; offsetPx: number } }
  graphDataRevision: number
  runtimeRef: React.MutableRefObject<FlowNativeRuntime | null>
  graphDataForZoomRef: React.MutableRefObject<GraphData | null>
  schemaRef: React.MutableRefObject<GraphSchema | null>
  disableRelaxOnCommit?: boolean
  setLayoutPositionsForMode?: (cacheKey: string, positions: Record<string, { x: number; y: number }>) => void
  setZoomState: (z: { k: number; x: number; y: number; graphDataRevision?: number; viewportW: number; viewportH: number }) => void
  setZoomStateForKey: (key: string, z: { k: number; x: number; y: number; graphDataRevision?: number; viewportW: number; viewportH: number }) => void
  viewportW: number
  viewportH: number
  zoomViewKey: string
  positionsDirtySinceCommitRef: React.MutableRefObject<boolean>
  lastCommittedPositionsRef: React.MutableRefObject<Record<string, { x: number; y: number }> | null>
  buildDrawArgs: () => FlowNativeDrawArgs
}) {
  const pendingCommitRef = React.useRef(false)

  const {
    cacheKey,
    flowConfig,
    flowPresentation,
    graphDataRevision,
    runtimeRef,
    graphDataForZoomRef,
    schemaRef,
    disableRelaxOnCommit,
    setLayoutPositionsForMode,
    setZoomState,
    setZoomStateForKey,
    viewportW,
    viewportH,
    zoomViewKey,
    positionsDirtySinceCommitRef,
    lastCommittedPositionsRef,
    buildDrawArgs,
  } = args

  return React.useCallback(() => {
    if (pendingCommitRef.current) return
    pendingCommitRef.current = true
    requestAnimationFrame(() => {
      pendingCommitRef.current = false
      const runtime = runtimeRef.current
      if (!runtime) return
      const t = runtime.transform || d3.zoomIdentity
      const current = useGraphStore.getState()
      commitZoomTransformToStore({
        state: {
          viewPinned: current.viewPinned,
          zoomState: current.zoomState,
          zoomStateByKey: current.zoomStateByKey,
          setZoomState,
          setZoomStateForKey,
        },
        zoomViewKey,
        transform: { k: t.k, x: t.x, y: t.y },
        viewportW,
        viewportH,
        graphDataRevision,
      })
      if (!cacheKey || typeof setLayoutPositionsForMode !== 'function') return
      if (!positionsDirtySinceCommitRef.current) return
      const scene = runtime.scene
      if (!scene) return
      positionsDirtySinceCommitRef.current = false
      const prev = lastCommittedPositionsRef.current

      const schema = schemaRef.current
      const graphDataForZoom = graphDataForZoomRef.current

      const nextPositions = (() => {
        if (disableRelaxOnCommit === true) {
          const out: Record<string, { x: number; y: number }> = {}
          for (let i = 0; i < scene.nodes.length; i += 1) {
            const n = scene.nodes[i]
            const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
            const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
            if (x == null || y == null) continue
            out[n.id] = { x, y }
          }
          return out
        }
        const relaxed =
          schema && graphDataForZoom
            ? relaxFlowSceneNodePositions({
                graphData: graphDataForZoom,
                sceneNodes: scene.nodes,
                groups: scene.groups || [],
                schema,
                nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
                portHandles: {
                  enabled: flowPresentation.portHandles.enabled,
                  sizePx: flowPresentation.portHandles.sizePx,
                  offsetPx: flowPresentation.portHandles.offsetPx,
                },
                steps: computeFlowCommitRelaxSteps({ nodeCount: scene.nodes.length, groupCount: scene.groups?.length || 0 }),
              })
            : null
        return relaxed
      })()
      if (!nextPositions) return

      for (let i = 0; i < scene.nodes.length; i += 1) {
        const n = scene.nodes[i]
        const p = nextPositions[n.id]
        if (!p) continue
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
        n.x = p.x
        n.y = p.y
      }
      runtime.dirty = true
      requestFlowNativeDraw(runtime, buildDrawArgs())

      let changed = false
      for (const id of Object.keys(nextPositions)) {
        const p = nextPositions[id]
        const prior = prev ? prev[id] : null
        if (!prior || Math.abs(prior.x - p.x) > 0.5 || Math.abs(prior.y - p.y) > 0.5) {
          changed = true
          break
        }
      }
      lastCommittedPositionsRef.current = nextPositions
      if (changed) setLayoutPositionsForMode(cacheKey, nextPositions)
    })
  }, [
    buildDrawArgs,
    cacheKey,
    disableRelaxOnCommit,
    flowConfig.node.heightPx,
    flowConfig.node.widthPx,
    flowPresentation.portHandles.enabled,
    flowPresentation.portHandles.offsetPx,
    flowPresentation.portHandles.sizePx,
    graphDataRevision,
    graphDataForZoomRef,
    lastCommittedPositionsRef,
    positionsDirtySinceCommitRef,
    runtimeRef,
    schemaRef,
    setLayoutPositionsForMode,
    setZoomState,
    setZoomStateForKey,
    viewportH,
    viewportW,
    zoomViewKey,
  ])
}
