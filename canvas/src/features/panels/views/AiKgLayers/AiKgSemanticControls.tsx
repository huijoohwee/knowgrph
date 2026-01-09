import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  AI_KG_SEMANTIC_METRIC_TOOLTIP,
  AI_KG_SEMANTIC_TOPK_TOOLTIP,
  AI_KG_SEMANTIC_MIN_SIMILARITY_TOOLTIP,
  AI_KG_SEMANTIC_EDGE_LABEL_TOOLTIP,
  AI_KG_SEMANTIC_MERMAID_FILTER_TOOLTIP,
} from '@/lib/config'
import {
  SEMANTIC_MIN_SIMILARITY_TOOLTIP,
  SEMANTIC_TOPK_EDGES_TOOLTIP,
} from '@/features/panels/views/AiKgLayersSectionTooltips'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'

type AiKgSemanticControlsProps = {
  schema: GraphSchema
  setSchema: (schema: GraphSchema) => void
  uiPanelKeyValueInputClass: string
}

export default function AiKgSemanticControls({
  schema,
  setSchema,
  uiPanelKeyValueInputClass,
}: AiKgSemanticControlsProps) {
  const layers = schema.layers || {}
  if (layers.mode !== 'semantic') return null

  const semanticCfg = layers.semantic || {}
  const similarityEdgeLabel = String(semanticCfg.similarityEdgeLabel || 'semanticSimilarity')
  const similarityMetric: 'cosine' | 'pmi' = semanticCfg.similarityMetric === 'pmi' ? 'pmi' : 'cosine'
  const hiddenTypesRaw = semanticCfg.hiddenNodeTypes
  const hiddenNodeTypes = Array.isArray(hiddenTypesRaw)
    ? hiddenTypesRaw.map(t => String(t || '').trim()).filter(Boolean)
    : []
  const mermaidHidden = hiddenNodeTypes.includes('MermaidNode')
  
  const topKRaw = semanticCfg.topKEdgesPerNode
  const topKEdgesPerNode =
    typeof topKRaw === 'number' && Number.isFinite(topKRaw) ? Math.max(0, Math.floor(topKRaw)) : 3
  
  const minSimRaw = semanticCfg.minSimilarity
  const minSimilarity =
    typeof minSimRaw === 'number' && Number.isFinite(minSimRaw)
      ? Math.max(0, minSimRaw)
      : (similarityMetric === 'pmi' ? 0.15 : 0.2)

  return (
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
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content={AI_KG_SEMANTIC_MERMAID_FILTER_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
            className="text-gray-700 break-words"
          >
            <span className="text-gray-700 break-words">
              schema.layers.semantic.hiddenNodeTypes
            </span>
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <div className="flex items-center justify-end gap-2">
              <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800">
                <span className="mr-1 h-2 w-2 rounded-full bg-violet-500" />
                MermaidNode · pointsTo
              </span>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={mermaidHidden}
                  onChange={e => {
                    const checked = e.target.checked
                    const current = schema
                    const baseLayers = current.layers || {}
                    const baseSemantic = baseLayers.semantic || {}
                    const prevHidden = Array.isArray(baseSemantic.hiddenNodeTypes)
                      ? baseSemantic.hiddenNodeTypes.map(t => String(t || '').trim()).filter(Boolean)
                      : []
                    const nextHidden = (() => {
                      if (checked) {
                        if (prevHidden.includes('MermaidNode')) return prevHidden
                        return [...prevHidden, 'MermaidNode']
                      }
                      return prevHidden.filter(t => t !== 'MermaidNode')
                    })()
                    const next: GraphSchema = {
                      ...current,
                      layers: {
                        ...baseLayers,
                        semantic: {
                          ...baseSemantic,
                          hiddenNodeTypes: nextHidden.length ? nextHidden : undefined,
                        },
                      },
                    }
                    setSchema(next)
                  }}
                />
                <span>{mermaidHidden ? 'Hide Mermaid nodes' : 'Show Mermaid nodes'}</span>
              </label>
            </div>
          </RightAlignedValueCell>
        )}
      />
    </>
  )
}
