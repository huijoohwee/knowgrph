import type * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { computeDragChargeStrength2d, computeDragDistanceMax2d, readPhysics2dTuning } from '@/lib/graph/physics2dTuning'
import { useGraphStore } from '@/hooks/useGraphStore'

type ChargeForce = {
  strength: (() => (d: GraphNode, i: number, data: GraphNode[]) => number) & ((v: number) => unknown) & ((v: (d: GraphNode, i: number, data: GraphNode[]) => number) => unknown)
  distanceMax: (() => number) & ((v: number) => unknown)
}

type DragTuningState = {
  active: number
  savedChargeStrength?: (d: GraphNode, i: number, data: GraphNode[]) => number
  savedDistanceMax?: number
}

const stateBySimulation = new WeakMap<object, DragTuningState>()

const readChargeForce = (simulation: d3.Simulation<GraphNode, GraphEdge>): ChargeForce | null => {
  const raw = simulation.force('charge') as unknown
  if (!raw || typeof raw !== 'function') return null
  if (typeof (raw as { strength?: unknown }).strength !== 'function') return null
  if (typeof (raw as { distanceMax?: unknown }).distanceMax !== 'function') return null
  return raw as unknown as ChargeForce
}

export const beginDragForceTuning = (simulation: d3.Simulation<GraphNode, GraphEdge>): (() => void) => {
  const physicsTuning = (() => {
    try {
      return readPhysics2dTuning(useGraphStore.getState().schema)
    } catch {
      return null
    }
  })()
  const key = simulation as unknown as object
  const cur = stateBySimulation.get(key) || { active: 0 }
  cur.active += 1
  if (cur.active > 1) {
    stateBySimulation.set(key, cur)
    return () => {
      const s = stateBySimulation.get(key)
      if (!s) return
      s.active = Math.max(0, s.active - 1)
      if (s.active === 0) stateBySimulation.delete(key)
      else stateBySimulation.set(key, s)
    }
  }

  const charge = readChargeForce(simulation)
  if (charge) {
    try {
      const acc = charge.strength() as unknown
      const accessor = typeof acc === 'function' ? (acc as (d: GraphNode, i: number, data: GraphNode[]) => number) : null
      if (accessor) cur.savedChargeStrength = accessor
    } catch {
      void 0
    }
    try {
      const dm = charge.distanceMax()
      if (typeof dm === 'number' && Number.isFinite(dm)) cur.savedDistanceMax = dm
    } catch {
      void 0
    }
  }
  stateBySimulation.set(key, cur)

  if (charge && cur.savedChargeStrength) {
    const nodes = simulation.nodes()
    const sample = nodes && nodes.length > 0 ? nodes[0]! : ({ id: '' } as GraphNode)
    const base = cur.savedChargeStrength(sample, 0, nodes as GraphNode[])
    const tuned = computeDragChargeStrength2d(typeof base === 'number' && Number.isFinite(base) ? base : 0, physicsTuning || undefined)
    if (tuned !== 0) {
      try {
        charge.strength(tuned)
      } catch {
        void 0
      }
    }
    try {
      const tunedDistMax = computeDragDistanceMax2d(cur.savedDistanceMax, physicsTuning || undefined)
      if (Number.isFinite(tunedDistMax) && tunedDistMax > 0) charge.distanceMax(tunedDistMax)
    } catch {
      void 0
    }
  }

  return () => {
    const s = stateBySimulation.get(key)
    if (!s) return
    s.active = Math.max(0, s.active - 1)
    if (s.active > 0) {
      stateBySimulation.set(key, s)
      return
    }

    const charge = readChargeForce(simulation)
    if (charge && s.savedChargeStrength) {
      try {
        charge.strength(s.savedChargeStrength)
      } catch {
        void 0
      }
      try {
        if (typeof s.savedDistanceMax === 'number' && Number.isFinite(s.savedDistanceMax)) {
          charge.distanceMax(s.savedDistanceMax)
        }
      } catch {
        void 0
      }
    }
    stateBySimulation.delete(key)
  }
}
