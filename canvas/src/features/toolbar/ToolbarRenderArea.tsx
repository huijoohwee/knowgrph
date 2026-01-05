import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-end gap-2">
        <StatusBadge label={UI_LABELS.renderer} ok={renderOpOk} msg={renderOpMsg || undefined} />
      </div>
    </div>
  )
}
