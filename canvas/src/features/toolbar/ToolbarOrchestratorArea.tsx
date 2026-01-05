import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import { UI_LABELS } from '@/lib/config'

interface ToolbarOrchestratorAreaProps {
  orchestratorOpOk: boolean | null
  orchestratorOpMsg: string | null
}

export function ToolbarOrchestratorArea({
  orchestratorOpOk,
  orchestratorOpMsg,
}: ToolbarOrchestratorAreaProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-end gap-2">
        <StatusBadge label={UI_LABELS.orchestrator} ok={orchestratorOpOk} msg={orchestratorOpMsg || undefined} />
      </div>
    </div>
  )
}
