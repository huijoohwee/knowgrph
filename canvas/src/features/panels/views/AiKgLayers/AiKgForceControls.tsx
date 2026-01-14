import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_ROW_TOOLTIP,
} from '@/lib/config'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_DEFAULT_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MAX_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_MIN_MS,
  ORCHESTRATOR_TRAVERSAL_DELAY_TOOLTIP,
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
  COLLISION_RADIUS_TOOLTIP,
} from '../AiKgLayersSectionTooltips'

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
            content="AI KG layout forces → tune layout.forces.charge separation strength → keep nodes spaced for readable traversal overlays without fragmenting clusters."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="text-gray-700 break-words"
          >
            layout.forces.charge
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={CHARGE_STRENGTH_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
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
            contentClassName="bg-gray-800/90"
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
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content={ORCHESTRATOR_TRAVERSAL_DELAY_ROW_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="text-gray-700"
          >
            orchestratorTraversalDelayMs
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={ORCHESTRATOR_TRAVERSAL_DELAY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
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
                setTraversalDelayMs(next)
              }}
              className="w-full h-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={ORCHESTRATOR_TRAVERSAL_DELAY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
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
                setTraversalDelayMs(next)
              }}
              className={uiPanelKeyValueInputClass}
            />
          </Tooltip>
        )}
      />
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content="Renderer → tune global collision radius applied via layout.forces.collisionByType → push nodes apart in dense regions so AI KG layers avoid overlap and maintain legible clusters during traversal replays."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <span className="text-gray-700 break-words">
              layout.forces.collisionByType
            </span>
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={COLLISION_RADIUS_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
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
            contentClassName="bg-gray-800/90"
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
        keyNode={(
          <Tooltip
             content="Box Force → constrain nodes to viewport to prevent flying off-screen."
             maxWidthPx={260}
             contentClassName="bg-gray-800/90"
             className="text-gray-700"
          >
            Box Force
          </Tooltip>
        )}
        typeNode={
           <div className="flex items-center">
             <input
               type="checkbox"
               checked={schema.layout?.forces?.boxForce !== false}
               onChange={e => {
                  const forces = schema.layout?.forces || {};
                  setSchema({
                     ...schema,
                     layout: { ...schema.layout, forces: { ...forces, boxForce: e.target.checked } }
                  });
               }}
               className="h-4 w-4"
             />
           </div>
        }
        valueNode={
           <span className="text-xs text-gray-500 italic">Constrain</span>
        }
      />
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
             content="Strength of the box force constraint."
             maxWidthPx={260}
             contentClassName="bg-gray-800/90"
             className="text-gray-700"
          >
            Box Str.
          </Tooltip>
        )}
        typeNode={(
           <input
               type="range"
               min={0.01}
               max={0.2}
               step={0.01}
               value={schema.layout?.forces?.boxForceStrength ?? 0.05}
               onChange={e => {
                 const val = Number(e.target.value);
                 const forces = schema.layout?.forces || {};
                 setSchema({
                    ...schema,
                    layout: { ...schema.layout, forces: { ...forces, boxForceStrength: val } }
                 });
               }}
               className="w-full h-full"
           />
        )}
        valueNode={(
           <input
               type="number"
               min={0.01}
               max={0.2}
               step={0.01}
               value={schema.layout?.forces?.boxForceStrength ?? 0.05}
               onChange={e => {
                 const val = Number(e.target.value);
                 const forces = schema.layout?.forces || {};
                 setSchema({
                    ...schema,
                    layout: { ...schema.layout, forces: { ...forces, boxForceStrength: val } }
                 });
               }}
               className={uiPanelKeyValueInputClass}
           />
        )}
      />
    </>
  )
}
