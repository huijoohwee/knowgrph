import type React from 'react'
import type { AgenticRagNodeView } from '@/lib/graph/types'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'

export interface GraphNodeView {
  label: string
}

export interface GraphEdgeView {
  source: string
  target: string
  label: string
}

export type GraphNodesById = Record<string, GraphNodeView>
export type GraphEdgesById = Record<string, GraphEdgeView>

export interface OrchestratorTraversalEditState {
  editingQuery: boolean
  setEditingQuery: (value: boolean) => void
  editingQueryText: string
  setEditingQueryText: (value: string) => void
  editingExample: boolean
  setEditingExample: (value: boolean) => void
  editingExampleText: string
  setEditingExampleText: (value: string) => void
}

export interface OrchestratorTraversalPathEditState {
  editingTraverseIndex: number | null
  setEditingTraverseIndex: (index: number | null) => void
  editingTraverseText: string
  setEditingTraverseText: (value: string) => void
  editingHopIndex: number | null
  setEditingHopIndex: (index: number | null) => void
  editingHopText: string
  setEditingHopText: (value: string) => void
  editingMultiHopIndex: number | null
  setEditingMultiHopIndex: (index: number | null) => void
  editingMultiHopText: string
  setEditingMultiHopText: (value: string) => void
  newHopText: string
  setNewHopText: (value: string) => void
  newMultiHopText: string
  setNewMultiHopText: (value: string) => void
}

export interface OrchestratorTraversalSectionViewModel {
  graphNodesById: GraphNodesById
  graphEdgesById: GraphEdgesById
  previewEdgeIds: string[]
  lastTraversal: TraversalSummary | null
  setLastTraversal: React.Dispatch<React.SetStateAction<TraversalSummary | null>>
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  editState: OrchestratorTraversalEditState
  editPaths: OrchestratorTraversalPathEditState
  selectedAgenticNode: AgenticRagNodeView | null
  agenticCopyStatus: string | null
  onCopyAgenticRagNodeJson: () => void
}

export function buildOrchestratorTraversalSectionViewModel(
  params: OrchestratorTraversalSectionViewModel,
): OrchestratorTraversalSectionViewModel {
  return {
    ...params,
    previewEdgeIds: Array.isArray(params.previewEdgeIds) ? params.previewEdgeIds : [],
  }
}
