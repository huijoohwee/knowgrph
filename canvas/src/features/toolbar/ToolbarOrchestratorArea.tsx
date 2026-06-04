import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import {
  uiToolbarAreaActionRowClassName,
  uiToolbarAreaStackClassName,
} from '@/features/toolbar/ui/toolbarStyles'
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
    <section className={uiToolbarAreaStackClassName}>
      <section className={uiToolbarAreaActionRowClassName}>
        <StatusBadge label={UI_LABELS.orchestrator} ok={orchestratorOpOk} msg={orchestratorOpMsg || undefined} />
      </section>
    </section>
  )
}
