import React from 'react'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import type {
  OrchestratorTraversalEditState,
  OrchestratorTraversalPathEditState,
} from '@/features/panels/views/OrchestratorTraversalSectionModel'

export interface OrchestratorTraversalEditStateHookResult {
  lastTraversal: TraversalSummary | null
  setLastTraversal: React.Dispatch<React.SetStateAction<TraversalSummary | null>>
  editState: OrchestratorTraversalEditState
  editPaths: OrchestratorTraversalPathEditState
}

export function useOrchestratorTraversalEditState(): OrchestratorTraversalEditStateHookResult {
  const [lastTraversal, setLastTraversal] = React.useState<TraversalSummary | null>(null)
  const [newHopText, setNewHopText] = React.useState('')
  const [newMultiHopText, setNewMultiHopText] = React.useState('')
  const [editingTraverseIndex, setEditingTraverseIndex] = React.useState<number | null>(null)
  const [editingTraverseText, setEditingTraverseText] = React.useState('')
  const [editingHopIndex, setEditingHopIndex] = React.useState<number | null>(null)
  const [editingHopText, setEditingHopText] = React.useState('')
  const [editingMultiHopIndex, setEditingMultiHopIndex] = React.useState<number | null>(null)
  const [editingMultiHopText, setEditingMultiHopText] = React.useState('')
  const [editingQuery, setEditingQuery] = React.useState(false)
  const [editingQueryText, setEditingQueryText] = React.useState('')
  const [editingExample, setEditingExample] = React.useState(false)
  const [editingExampleText, setEditingExampleText] = React.useState('')

  const editState: OrchestratorTraversalEditState = {
    editingQuery,
    setEditingQuery,
    editingQueryText,
    setEditingQueryText,
    editingExample,
    setEditingExample,
    editingExampleText,
    setEditingExampleText,
  }

  const editPaths: OrchestratorTraversalPathEditState = {
    editingTraverseIndex,
    setEditingTraverseIndex,
    editingTraverseText,
    setEditingTraverseText,
    editingHopIndex,
    setEditingHopIndex,
    editingHopText,
    setEditingHopText,
    editingMultiHopIndex,
    setEditingMultiHopIndex,
    editingMultiHopText,
    setEditingMultiHopText,
    newHopText,
    setNewHopText,
    newMultiHopText,
    setNewMultiHopText,
  }

  return {
    lastTraversal,
    setLastTraversal,
    editState,
    editPaths,
  }
}

