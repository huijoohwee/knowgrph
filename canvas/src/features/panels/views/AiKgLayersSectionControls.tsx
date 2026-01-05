import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import {
  ORCHESTRATOR_TRAVERSAL_DELAY_ROW_TOOLTIP,
  AI_KG_LAYER_MODE_TOOLTIP,
  AI_KG_SEMANTIC_METRIC_TOOLTIP,
  AI_KG_SEMANTIC_TOPK_TOOLTIP,
  AI_KG_SEMANTIC_MIN_SIMILARITY_TOOLTIP,
  AI_KG_SEMANTIC_EDGE_LABEL_TOOLTIP,
} from '@/lib/config'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
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
  LAYER1_OPACITY_TOOLTIP,
  LAYER2_OPACITY_TOOLTIP,
  LAYER3_OPACITY_TOOLTIP,
  SEMANTIC_MIN_SIMILARITY_TOOLTIP,
  SEMANTIC_TOPK_EDGES_TOOLTIP,
} from '@/features/panels/views/AiKgLayersSectionTooltips'

type AiKgLayersControlsProps = {
  schema: GraphSchema
  setSchema: (schema: GraphSchema) => void
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  setCharge: (charge: number) => void
  setCollisionByType: (type: string, radius: number) => void
  traversalDelayMs: number
  setTraversalDelayMs: (ms: number) => void
  uiPanelKeyValueInputClass: string
}

export default function AiKgLayersControls({
  schema,
  setSchema,
  setThreeConfig,
  setCharge,
  setCollisionByType,
  traversalDelayMs,
  setTraversalDelayMs,
  uiPanelKeyValueInputClass,
}: AiKgLayersControlsProps) {
  const three = getThreeConfig(schema)
  const layerOpacityByLayer = (three.layerOpacityByLayer || {}) as Record<string, number>

  const getLayerOpacityValue = (layer: '1' | '2' | '3', fallback: number) => {
    const v = layerOpacityByLayer[layer]
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback
  }

  const layer1 = getLayerOpacityValue('1', 1.0)
  const layer2 = getLayerOpacityValue('2', 0.9)
  const layer3 = getLayerOpacityValue('3', 0.8)

  const currentCharge = schema.layout?.forces?.charge ?? -CHARGE_STRENGTH_DEFAULT
  const separation = Math.abs(currentCharge)

  const nodeTypes = schema.catalog?.nodeTypes || []
  const sampleCollisionType = nodeTypes[0]
  const collisionByType = schema.layout?.forces?.collisionByType || {}
  const currentCollision =
    typeof sampleCollisionType === 'string' && typeof collisionByType[sampleCollisionType] === 'number'
      ? (collisionByType[sampleCollisionType] as number)
      : COLLISION_RADIUS_DEFAULT

  const threeCfg = getThreeConfig(schema)
  const nodeSizingFormula: 'schema' | 'importance' = threeCfg.nodeSizingFormula || 'schema'
  const edgeWidthFormula: 'schema' | 'weight' = threeCfg.edgeWidthFormula || 'schema'

  const layers = schema.layers || {}
  const layerMode: 'property' | 'document-structure' | 'semantic' =
    layers.mode === 'document-structure' || layers.mode === 'semantic'
      ? layers.mode
      : 'property'
  const documentStructure = layers.documentStructure || {}
  const rawMinGroupSize = documentStructure.minGroupSize
  const minGroupSize =
    typeof rawMinGroupSize === 'number' && Number.isFinite(rawMinGroupSize)
      ? Math.max(2, Math.floor(rawMinGroupSize))
      : 2
  const semanticCfg = layers.semantic || {}
  const similarityEdgeLabel = String(semanticCfg.similarityEdgeLabel || 'semanticSimilarity')
  const similarityMetric: 'cosine' | 'pmi' = semanticCfg.similarityMetric === 'pmi' ? 'pmi' : 'cosine'
  const topKRaw = semanticCfg.topKEdgesPerNode
  const topKEdgesPerNode =
    typeof topKRaw === 'number' && Number.isFinite(topKRaw) ? Math.max(0, Math.floor(topKRaw)) : 3
  const minSimRaw = semanticCfg.minSimilarity
  const minSimilarity =
    typeof minSimRaw === 'number' && Number.isFinite(minSimRaw)
      ? Math.max(0, minSimRaw)
      : (similarityMetric === 'pmi' ? 0.15 : 0.2)

  return (
    <div className="mt-1 space-y-1">
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content={AI_KG_LAYER_MODE_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="text-gray-700 break-words"
          >
            <span className="text-gray-700 break-words">
              schema.layers.mode
            </span>
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <select
              className="w-full max-w-[180px] px-1 py-0.5 border border-gray-300 rounded text-right"
              value={layerMode}
              onChange={e => {
                const raw = String(e.target.value || '')
                const nextMode: 'property' | 'document-structure' | 'semantic' =
                  raw === 'document-structure' || raw === 'semantic'
                    ? (raw as 'document-structure' | 'semantic')
                    : 'property'
                const current = schema
                const nextLayers = current.layers || {}
                const next: GraphSchema = {
                  ...current,
                  layers: {
                    ...nextLayers,
                    mode: nextMode,
                  },
                }
                setSchema(next)
              }}
            >
              <option value="property">property (array properties)</option>
              <option value="document-structure">document-structure (node type)</option>
              <option value="semantic">semantic (similarity graph)</option>
            </select>
          </RightAlignedValueCell>
        )}
      />
      {(layerMode === 'document-structure' || layerMode === 'semantic') && (
        <KeyTypeValueRow
          density="compact"
          layout="keyIconValue"
          keyNode={(
            <Tooltip
              content="Derived group size → set minimum nodes per document-structure or semantic group → merge smaller groups back into base polygons to keep layers readable."
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="text-gray-700 break-words"
            >
              <span className="text-gray-700 break-words">
                schema.layers.documentStructure.minGroupSize
              </span>
            </Tooltip>
          )}
          typeNode={null}
          valueNode={(
            <RightAlignedValueCell>
              <input
                className={uiPanelKeyValueInputClass}
                type="number"
                min={2}
                step={1}
                value={Number(minGroupSize)}
                onChange={e => {
                  const raw = Number(e.target.value)
                  const nextValue = Number.isFinite(raw) ? Math.max(2, Math.floor(raw)) : 2
                  const current = schema
                  const baseLayers = current.layers || {}
                  const baseDoc = baseLayers.documentStructure || {}
                  const next: GraphSchema = {
                    ...current,
                    layers: {
                      ...baseLayers,
                      documentStructure: {
                        ...baseDoc,
                        minGroupSize: nextValue,
                      },
                    },
                  }
                  setSchema(next)
                }}
              />
            </RightAlignedValueCell>
          )}
        />
      )}
      {layerMode === 'semantic' && (
        <>
          <KeyTypeValueRow
            density="compact"
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={AI_KG_SEMANTIC_EDGE_LABEL_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
                className="text-gray-700 break-words"
              >
                <span className="text-gray-700 break-words">
                  schema.layers.semantic.similarityEdgeLabel
                </span>
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedValueCell>
                <input
                  className={uiPanelKeyValueInputClass}
                  type="text"
                  value={similarityEdgeLabel}
                  onChange={e => {
                    const raw = String(e.target.value || '')
                    const trimmed = raw.trim()
                    const current = schema
                    const baseLayers = current.layers || {}
                    const baseSemantic = baseLayers.semantic || {}
                    const next: GraphSchema = {
                      ...current,
                      layers: {
                        ...baseLayers,
                        semantic: {
                          ...baseSemantic,
                          similarityEdgeLabel: trimmed || undefined,
                        },
                      },
                    }
                    setSchema(next)
                  }}
                />
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            density="compact"
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={AI_KG_SEMANTIC_METRIC_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
                className="text-gray-700 break-words"
              >
                <span className="text-gray-700 break-words">
                  schema.layers.semantic.similarityMetric
                </span>
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedValueCell>
                <select
                  className="w-full max-w-[180px] px-1 py-0.5 border border-gray-300 rounded text-right"
                  value={similarityMetric}
                  onChange={e => {
                    const raw = String(e.target.value || '')
                    const nextMetric: 'cosine' | 'pmi' = raw === 'pmi' ? 'pmi' : 'cosine'
                    const current = schema
                    const baseLayers = current.layers || {}
                    const baseSemantic = baseLayers.semantic || {}
                    const next: GraphSchema = {
                      ...current,
                      layers: {
                        ...baseLayers,
                        semantic: {
                          ...baseSemantic,
                          similarityMetric: nextMetric,
                        },
                      },
                    }
                    setSchema(next)
                  }}
                >
                  <option value="cosine">cosine (embedding cosine similarity)</option>
                  <option value="pmi">pmi (pointwise mutual information)</option>
                </select>
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            density="compact"
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={AI_KG_SEMANTIC_TOPK_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
                className="text-gray-700 break-words"
              >
                <span className="text-gray-700 break-words">
                  schema.layers.semantic.topKEdgesPerNode
                </span>
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedValueCell>
                <Tooltip
                  content={SEMANTIC_TOPK_EDGES_TOOLTIP}
                  maxWidthPx={260}
                  contentClassName="bg-gray-800/90"
                  className="w-full"
                >
                  <input
                    className={uiPanelKeyValueInputClass}
                    type="number"
                    min={0}
                    step={1}
                    value={Number(topKEdgesPerNode)}
                    onChange={e => {
                      const raw = Number(e.target.value)
                      const nextValue = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 3
                      const current = schema
                      const baseLayers = current.layers || {}
                      const baseSemantic = baseLayers.semantic || {}
                      const next: GraphSchema = {
                        ...current,
                        layers: {
                          ...baseLayers,
                          semantic: {
                            ...baseSemantic,
                            topKEdgesPerNode: nextValue,
                          },
                        },
                      }
                      setSchema(next)
                    }}
                  />
                </Tooltip>
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            density="compact"
            layout="keyIconValue"
            keyNode={(
              <Tooltip
                content={AI_KG_SEMANTIC_MIN_SIMILARITY_TOOLTIP}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
                className="text-gray-700 break-words"
              >
                <span className="text-gray-700 break-words">
                  schema.layers.semantic.minSimilarity
                </span>
              </Tooltip>
            )}
            typeNode={null}
            valueNode={(
              <RightAlignedValueCell>
                <Tooltip
                  content={SEMANTIC_MIN_SIMILARITY_TOOLTIP}
                  maxWidthPx={260}
                  contentClassName="bg-gray-800/90"
                  className="w-full"
                >
                  <input
                    className={uiPanelKeyValueInputClass}
                    type="number"
                    min={0}
                    step={0.01}
                    value={Number(minSimilarity)}
                    onChange={e => {
                      const raw = Number(e.target.value)
                      const nextValue = Number.isFinite(raw)
                        ? Math.max(0, raw)
                        : (similarityMetric === 'pmi' ? 0.15 : 0.2)
                      const current = schema
                      const baseLayers = current.layers || {}
                      const baseSemantic = baseLayers.semantic || {}
                      const next: GraphSchema = {
                        ...current,
                        layers: {
                          ...baseLayers,
                          semantic: {
                            ...baseSemantic,
                            minSimilarity: nextValue,
                          },
                        },
                      }
                      setSchema(next)
                    }}
                  />
                </Tooltip>
              </RightAlignedValueCell>
            )}
          />
        </>
      )}
      <KeyTypeValueRow
        density="compact"
        layout="keyIconSliderInput"
        keyNode={(
          <Tooltip
            content="AI KG renderer → adjust three.layerOpacityByLayer['1'] for foreground band → keep top-layer concepts readable while replaying traversal paths."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="text-gray-700 break-words"
          >
            three.layerOpacityByLayer['1']
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={LAYER1_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="w-full"
          >
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer1)}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 1
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': quantized,
                    '2': layer2,
                    '3': layer3,
                  },
                })
              }}
              className="w-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={LAYER1_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="w-full"
          >
            <input
              type="number"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer1.toFixed(2))}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 1
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': quantized,
                    '2': layer2,
                    '3': layer3,
                  },
                })
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
            content="AI KG renderer → adjust three.layerOpacityByLayer['2'] for mid band → balance context layer visibility against traversal highlights."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="text-gray-700 break-words"
          >
            three.layerOpacityByLayer['2']
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={LAYER2_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="w-full"
          >
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer2)}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 0.9
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': layer1,
                    '2': quantized,
                    '3': layer3,
                  },
                })
              }}
              className="w-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={LAYER2_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="w-full"
          >
            <input
              type="number"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer2.toFixed(2))}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 0.9
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': layer1,
                    '2': quantized,
                    '3': layer3,
                  },
                })
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
            content="AI KG renderer → adjust three.layerOpacityByLayer['3'] for background band → keep deep context visible without overpowering traversal overlays."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="text-gray-700 break-words"
          >
            three.layerOpacityByLayer['3']
          </Tooltip>
        )}
        typeNode={(
          <Tooltip
            content={LAYER3_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="w-full"
          >
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer3)}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 0.8
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': layer1,
                    '2': layer2,
                    '3': quantized,
                  },
                })
              }}
              className="w-full"
            />
          </Tooltip>
        )}
        valueNode={(
          <Tooltip
            content={LAYER3_OPACITY_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="w-full"
          >
            <input
              type="number"
              min={0.2}
              max={1}
              step={0.05}
              value={Number(layer3.toFixed(2))}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0.2, Math.min(1, raw))
                  : 0.8
                const quantized = Math.round(clamped * 20) / 20
                setThreeConfig({
                  layerOpacityByLayer: {
                    ...(layerOpacityByLayer as Record<string, number>),
                    '1': layer1,
                    '2': layer2,
                    '3': quantized,
                  },
                })
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
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content="Renderer → choose three.nodeSizingFormula for AI KG layers → size nodes by schema type or visual importance so key concepts stand out in dense 3D traversal views."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <span className="text-gray-700 break-words">
              schema.three.nodeSizingFormula
            </span>
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <Tooltip
              content="Default: schema; Impact: toggles node sizes between schema types and importance weights."
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="w-full h-full"
            >
              <select
                className="w-full max-w-[180px] px-1 py-0.5 border border-gray-300 rounded text-right"
                value={nodeSizingFormula}
                onChange={e => {
                  const v: 'schema' | 'importance' =
                    e.target.value === 'importance' ? 'importance' : 'schema'
                  setThreeConfig({ nodeSizingFormula: v })
                }}
              >
                <option value="schema">Schema (type-based)</option>
                <option value="importance">Importance (visual:importance)</option>
              </select>
            </Tooltip>
          </RightAlignedValueCell>
        )}
      />
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content="Renderer → choose three.edgeWidthFormula for AI KG layers for AI KG layers → map edge thickness to schema label or weight so stronger relations appear visually bolder along traversal paths."
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <span className="text-gray-700 break-words">
              schema.three.edgeWidthFormula
            </span>
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <Tooltip
              content="Default: schema; Impact: toggles edge widths between labels and weight-based emphasis."
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
              className="w-full h-full"
            >
              <select
                className="w-full max-w-[180px] px-1 py-0.5 border border-gray-300 rounded text-right"
                value={edgeWidthFormula}
                onChange={e => {
                  const v: 'schema' | 'weight' =
                    e.target.value === 'weight' ? 'weight' : 'schema'
                  setThreeConfig({ edgeWidthFormula: v })
                }}
              >
                <option value="schema">Schema (label-based)</option>
                <option value="weight">Weight (edge weight)</option>
              </select>
            </Tooltip>
          </RightAlignedValueCell>
        )}
      />
    </div>
  )
}
