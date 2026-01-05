import { finalizePendingEdge } from '@/features/edge-creation'
import type { GraphData, GraphEdge } from '@/lib/graph/types'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'

function ensureGraphEdge(edge: GraphEdge | null): GraphEdge {
  if (!edge) throw new Error('edge not created correctly')
  return edge
}

function ensurePartialEdge(edge: Partial<GraphEdge> | null): Partial<GraphEdge> {
  if (!edge) throw new Error('edge is missing')
  return edge
}

export const testFinalizeCreateEdge = () => {
  const data: GraphData = {
    context: '',
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'entity', properties: {} },
      { id: 'b', label: 'B', type: 'entity', properties: {} },
    ],
    edges: [],
  }
  const temp: { current: TempLinkSelection } = { current: null }
  const linkRef: { current: PendingLink | null } = { current: { mode: 'create', fromId: 'a' } }
  let added: GraphEdge | null = null
  let selected: string | null = null
  const ok = finalizePendingEdge(
    'b',
    data,
    null,
    temp,
    linkRef,
    (e: GraphEdge) => { added = e; data.edges.push(e) },
    (id: string, u: Partial<GraphEdge>) => { void id; void u },
    (id: string) => { selected = id },
    (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => { void src },
  )
  if (!ok) throw new Error('should finalize create')
  const addedEdge = ensureGraphEdge(added)
  if (!addedEdge || addedEdge.source !== 'a' || addedEdge.target !== 'b') {
    throw new Error('edge not created correctly')
  }
  if (!selected || selected !== addedEdge.id) throw new Error('edge not selected after create')
}

export const testFinalizeUseExistingEdge = () => {
  const data: GraphData = {
    context: '',
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'entity', properties: {} },
      { id: 'b', label: 'B', type: 'entity', properties: {} },
    ],
    edges: [ { id: 'e1', source: 'a', target: 'b', label: 'link', properties: {} } ],
  }
  const temp: { current: TempLinkSelection } = { current: null }
  const linkRef: { current: PendingLink | null } = { current: { mode: 'create', fromId: 'a' } }
  let selected: string | null = null
  const ok = finalizePendingEdge(
    'b',
    data,
    null,
    temp,
    linkRef,
    (e: GraphEdge) => { void e; throw new Error('should not add new edge') },
    (id: string, u: Partial<GraphEdge>) => { void id; void u },
    (id: string) => { selected = id },
    (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => { void src },
  )
  if (!ok) throw new Error('should finalize existing')
  if (selected !== 'e1') throw new Error('should select existing edge')
}

export const testFinalizeUpdateSource = () => {
  const data: GraphData = {
    context: '',
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'entity', properties: {} },
      { id: 'b', label: 'B', type: 'entity', properties: {} },
      { id: 'c', label: 'C', type: 'entity', properties: {} },
    ],
    edges: [ { id: 'e1', source: 'a', target: 'b', label: 'link', properties: {} } ],
  }
  const temp: { current: TempLinkSelection } = { current: null }
  const linkRef: { current: PendingLink | null } = { current: { mode: 'update-source', fromId: 'a' } }
  let updated: Partial<GraphEdge> | null = null
  let selected: string | null = null
  const ok = finalizePendingEdge(
    'c',
    data,
    'e1',
    temp,
    linkRef,
    (e: GraphEdge) => { void e },
    (id: string, u: Partial<GraphEdge>) => { void id; updated = u },
    (id: string) => { selected = id },
    (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => { void src },
  )
  if (!ok) throw new Error('should finalize update-source')
  const updatedEdge = ensurePartialEdge(updated)
  if (!updatedEdge || updatedEdge.source !== 'c') throw new Error('should update source to c')
  if (selected !== 'e1') throw new Error('should select updated edge')
}

export const testFinalizeUpdateTarget = () => {
  const data: GraphData = {
    context: '',
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'entity', properties: {} },
      { id: 'b', label: 'B', type: 'entity', properties: {} },
      { id: 'c', label: 'C', type: 'entity', properties: {} },
    ],
    edges: [ { id: 'e1', source: 'a', target: 'b', label: 'link', properties: {} } ],
  }
  const temp: { current: TempLinkSelection } = { current: null }
  const linkRef: { current: PendingLink | null } = { current: { mode: 'update-target', fromId: 'b' } }
  let updated: Partial<GraphEdge> | null = null
  let selected: string | null = null
  const ok = finalizePendingEdge(
    'c',
    data,
    'e1',
    temp,
    linkRef,
    (e: GraphEdge) => { void e },
    (id: string, u: Partial<GraphEdge>) => { void id; updated = u },
    (id: string) => { selected = id },
    (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => { void src },
  )
  if (!ok) throw new Error('should finalize update-target')
  const updatedEdgeTarget = ensurePartialEdge(updated)
  if (!updatedEdgeTarget || updatedEdgeTarget.target !== 'c') {
    throw new Error('should update target to c')
  }
  if (selected !== 'e1') throw new Error('should select updated edge')
}
