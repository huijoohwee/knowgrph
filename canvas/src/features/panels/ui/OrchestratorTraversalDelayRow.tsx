import React from 'react'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_TOOLTIP,
} from '@/features/panels/utils/orchestratorTraversal'
import { ORCHESTRATOR_TRAVERSAL_DELAY_ROW_TOOLTIP } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function OrchestratorTraversalDelayRow(props: {
  traversalDelayMs: number
  onChangeTraversalDelayMs: (next: number) => void
  uiPanelKeyValueInputClass: string
  density?: 'compact' | 'default'
}) {
  const { traversalDelayMs, onChangeTraversalDelayMs, uiPanelKeyValueInputClass, density } = props
  return (
    <KeyTypeValueRow
      density={density}
      layout="keyIconSliderInput"
      keyNode={(
        <Tooltip
          content={ORCHESTRATOR_TRAVERSAL_DELAY_ROW_TOOLTIP}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
        >
          <div className="flex min-w-0 w-full items-center gap-1">
            <span className="break-words">orchestratorTraversalDelayMs</span>
          </div>
        </Tooltip>
      )}
      typeNode={(
        <Tooltip
          content={ORCHESTRATOR_TRAVERSAL_DELAY_TOOLTIP}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          className="w-full h-full"
        >
          <input
            type="range"
            min={ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS}
            max={ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS}
            step={50}
            value={Number(traversalDelayMs)}
            onChange={e => {
              const raw = Number(e.target.value)
              const next = Number.isFinite(raw)
                ? Math.max(
                    ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
                    Math.min(ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS, raw),
                  )
                : ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS
              onChangeTraversalDelayMs(next)
            }}
            className="w-full h-full"
          />
        </Tooltip>
      )}
      valueNode={(
        <Tooltip
          content={ORCHESTRATOR_TRAVERSAL_DELAY_TOOLTIP}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          className="w-full h-full"
        >
          <input
            type="number"
            min={ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS}
            max={ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS}
            step={50}
            value={Number(traversalDelayMs)}
            onChange={e => {
              const raw = Number(e.target.value)
              const next = Number.isFinite(raw)
                ? Math.max(
                    ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
                    Math.min(
                      ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
                      Math.round(raw / 50) * 50,
                    ),
                  )
                : ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS
              onChangeTraversalDelayMs(next)
            }}
            className={uiPanelKeyValueInputClass}
          />
        </Tooltip>
      )}
    />
  )
}
