import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import {
  uiToolbarAreaActionRowClassName,
  uiToolbarAreaStackClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import { UI_LABELS } from '@/lib/config'

interface ToolbarRenderAreaProps {
  renderOpOk: boolean | null
  renderOpMsg: string | null
}

export function ToolbarRenderArea({
  renderOpOk,
  renderOpMsg,
}: ToolbarRenderAreaProps) {
  return (
    <div className={uiToolbarAreaStackClassName}>
      <div className={uiToolbarAreaActionRowClassName}>
        <StatusBadge label={UI_LABELS.renderer} ok={renderOpOk} msg={renderOpMsg || undefined} />
      </div>
    </div>
  )
}
