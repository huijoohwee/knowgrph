import React from 'react'
import { WorkspaceActionsPanel } from '@/features/workspace-actions/WorkspaceActionsPanel'
import type { ExampleConfig, ExampleId } from '@/features/parsers/examplesCatalog'

type WorkspaceActionsStepProps = {
  searchQuery?: string
  examples: ExampleConfig[]
  onApplyExample: (exampleId: ExampleId) => void
}

export default function WorkspaceActionsStep({ searchQuery, examples, onApplyExample }: WorkspaceActionsStepProps) {
  void searchQuery
  return (
    <WorkspaceActionsPanel examples={examples} onApplyExample={onApplyExample} />
  )
}
