import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import {
  AI_KG_FORCE_BOX_FORCE_ROW_TOOLTIP,
  AI_KG_FORCE_BOX_FORCE_STRENGTH_ROW_TOOLTIP,
  AI_KG_FORCE_CHARGE_ROW_TOOLTIP,
  AI_KG_FORCE_COLLISION_ROW_TOOLTIP,
} from '@/lib/config'
import {
  COLLISION_RADIUS_DEFAULT,
  COLLISION_RADIUS_MIN,
  COLLISION_RADIUS_MAX,
  COLLISION_RADIUS_INTERVAL,
  clampCollisionRadius,
} from '@/features/panels/utils/orchestratorTraversal'
import {
  CHARGE_STRENGTH_DEFAULT,
  CHARGE_STRENGTH_INTERVAL,
  CHARGE_STRENGTH_MAX,
  CHARGE_STRENGTH_MIN,
  CHARGE_STRENGTH_TOOLTIP,
  BOX_FORCE_ENABLED_VALUE_TOOLTIP,
  BOX_FORCE_STRENGTH_TOOLTIP,
  COLLISION_RADIUS_TOOLTIP,
} from '../AiKgLayersSectionTooltips'
import { OrchestratorTraversalDelayRow } from '@/features/panels/ui/OrchestratorTraversalDelayRow'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type AiKgForceControlsProps = {
  schema: GraphSchema
  setSchema: (schema: GraphSchema) => void
  setCharge: (charge: number) => void
  setCollisionByType: (type: string, radius: number) => void
  traversalDelayMs: number
  setTraversalDelayMs: (ms: number) => void
  uiPanelKeyValueInputClass: string
}

export default function AiKgForceControls({
  schema,
  setSchema,
  setCharge,
  setCollisionByType,
  traversalDelayMs,
  setTraversalDelayMs,
  uiPanelKeyValueInputClass,
}: AiKgForceControlsProps) {
  const currentCharge = schema.layout?.forces?.charge ?? -CHARGE_STRENGTH_DEFAULT
  const separation = Math.abs(currentCharge)

  const nodeTypes = schema.catalog?.nodeTypes || []
  const sampleCollisionType = nodeTypes[0]
  const collisionByType = schema.layout?.forces?.collisionByType || {}
  const currentCollision =
    typeof sampleCollisionType === 'string' && typeof collisionByType[sampleCollisionType] === 'number'
      ? (collisionByType[sampleCollisionType] as number)
      : COLLISION_RADIUS_DEFAULT

  return (
    <>
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content={AI_KG_FORCE_CHARGE_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className={`break-words ${UI_THEME_TOKENS.text.primary}`}
          >
            layout.forces.charge
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={CHARGE_STRENGTH_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full"
          >
            <input
              type="range"
              min={CHARGE_STRENGTH_MIN}
              max={CHARGE_STRENGTH_MAX}
              step={CHARGE_STRENGTH_INTERVAL}
              value={Number(separation)}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(CHARGE_STRENGTH_MIN, Math.min(CHARGE_STRENGTH_MAX, raw))
                  : CHARGE_STRENGTH_DEFAULT
                const quantized =
                  Math.round(clamped / CHARGE_STRENGTH_INTERVAL) * CHARGE_STRENGTH_INTERVAL
                const nextCharge = -Math.abs(quantized)
                setCharge(nextCharge)
              }}
              className="w-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={CHARGE_STRENGTH_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full"
          >
            <input
              type="number"
              min={CHARGE_STRENGTH_MIN}
              max={CHARGE_STRENGTH_MAX}
              step={CHARGE_STRENGTH_INTERVAL}
              value={Number(
                Math.round(separation / CHARGE_STRENGTH_INTERVAL) * CHARGE_STRENGTH_INTERVAL,
              )}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(CHARGE_STRENGTH_MIN, Math.min(CHARGE_STRENGTH_MAX, raw))
                  : CHARGE_STRENGTH_DEFAULT
                const quantized =
                  Math.round(clamped / CHARGE_STRENGTH_INTERVAL) * CHARGE_STRENGTH_INTERVAL
                const nextCharge = -Math.abs(quantized)
                setCharge(nextCharge)
              }}
              className={uiPanelKeyValueInputClass}
            />
          </Tooltip>
        )}
      />
      <OrchestratorTraversalDelayRow
        density="compact"
        traversalDelayMs={traversalDelayMs}
        onChangeTraversalDelayMs={setTraversalDelayMs}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
      />
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content={AI_KG_FORCE_COLLISION_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          >
            <span className={`${UI_THEME_TOKENS.text.primary} break-words`}>
              layout.forces.collisionByType
            </span>
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={COLLISION_RADIUS_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full h-full"
          >
            <input
              type="range"
              min={COLLISION_RADIUS_MIN}
              max={COLLISION_RADIUS_MAX}
              step={COLLISION_RADIUS_INTERVAL}
              value={clampCollisionRadius(currentCollision)}
              onChange={e => {
                const next = clampCollisionRadius(e.target.value)
                const types = schema.catalog?.nodeTypes || []
                types.forEach(t => {
                  if (t) setCollisionByType(t, next)
                })
              }}
              className="w-full h-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={COLLISION_RADIUS_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full h-full"
          >
            <input
              type="number"
              min={COLLISION_RADIUS_MIN}
              max={COLLISION_RADIUS_MAX}
              step={COLLISION_RADIUS_INTERVAL}
              value={clampCollisionRadius(currentCollision)}
              onChange={e => {
                const next = clampCollisionRadius(e.target.value)
                const types = schema.catalog?.nodeTypes || []
                types.forEach(t => {
                  if (t) setCollisionByType(t, next)
                })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </Tooltip>
        )}
      />
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content={AI_KG_FORCE_BOX_FORCE_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className={`break-words ${UI_THEME_TOKENS.text.primary}`}
          >
            layout.forces.boxForce
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <Tooltip
            content={BOX_FORCE_ENABLED_VALUE_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          >
            <div className="flex items-center justify-end">
              <input
                type="checkbox"
                checked={schema.layout?.forces?.boxForce !== false}
                onChange={e => {
                  const forces = schema.layout?.forces || {}
                  setSchema({
                    ...schema,
                    layout: { ...schema.layout, forces: { ...forces, boxForce: e.target.checked } },
                  })
                }}
                className={`h-4 w-4 ${UI_THEME_TOKENS.input.border}`}
              />
            </div>
          </Tooltip>
        )}
      />
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content={AI_KG_FORCE_BOX_FORCE_STRENGTH_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className={`break-words ${UI_THEME_TOKENS.text.primary}`}
          >
            layout.forces.boxForceStrength
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={BOX_FORCE_STRENGTH_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full h-full"
          >
            <input
              type="range"
              min={0.01}
              max={0.2}
              step={0.01}
              value={schema.layout?.forces?.boxForceStrength ?? 0.05}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.01, Math.min(0.2, raw))
                  : 0.05
                const quantized = Math.round(clamped * 100) / 100
                const forces = schema.layout?.forces || {}
                setSchema({
                  ...schema,
                  layout: { ...schema.layout, forces: { ...forces, boxForceStrength: quantized } },
                })
              }}
              className="w-full h-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={BOX_FORCE_STRENGTH_TOOLTIP}
            maxWidthPx={260}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
            className="w-full h-full"
          >
            <input
              type="number"
              min={0.01}
              max={0.2}
              step={0.01}
              value={schema.layout?.forces?.boxForceStrength ?? 0.05}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.01, Math.min(0.2, raw))
                  : 0.05
                const quantized = Math.round(clamped * 100) / 100
                const forces = schema.layout?.forces || {}
                setSchema({
                  ...schema,
                  layout: { ...schema.layout, forces: { ...forces, boxForceStrength: quantized } },
                })
              }}
              className={uiPanelKeyValueInputClass}
            />
          </Tooltip>
        )}
      />
    </>
  )
}
