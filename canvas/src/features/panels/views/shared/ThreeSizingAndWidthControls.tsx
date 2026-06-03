import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import Tooltip from '@/features/panels/ui/Tooltip'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_CONSTRAINED_VALUE_FIELD_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

type SharedThreeSizingAndWidthControlsProps = {
  schema: GraphSchema
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  uiPanelKeyValueInputClass: string
  variant: 'simple' | 'aiKg'
}

const clampScale = (v: number): number => Math.max(0.2, Math.min(5, v))

export default function ThreeSizingAndWidthControls({
  schema,
  setThreeConfig,
  uiPanelKeyValueInputClass,
  variant,
}: SharedThreeSizingAndWidthControlsProps) {
  const threeCfg = getThreeConfig(schema)
  const nodeSizingFormula: 'schema' | 'importance' = threeCfg.nodeSizingFormula || 'schema'
  const edgeWidthFormula: 'schema' | 'weight' = threeCfg.edgeWidthFormula || 'schema'
  const keywordNodeSizeScaleRaw = typeof threeCfg.keywordNodeSizeScale === 'number' ? threeCfg.keywordNodeSizeScale : 1
  const keywordEdgeWidthScaleRaw = typeof threeCfg.keywordEdgeWidthScale === 'number' ? threeCfg.keywordEdgeWidthScale : 1
  const keywordNodeSizeScale = clampScale(keywordNodeSizeScaleRaw)
  const keywordEdgeWidthScale = clampScale(keywordEdgeWidthScaleRaw)
  const keyLabelClassName = `${UI_THEME_TOKENS.text.secondary} break-words`

  if (variant === 'simple') {
    return (
      <>
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Node Sizing</span>}
          valueNode={(
            <select
              className={uiPanelKeyValueInputClass}
              value={nodeSizingFormula}
              onChange={e => {
                const next: 'schema' | 'importance' = e.target.value === 'importance' ? 'importance' : 'schema'
                setThreeConfig({ nodeSizingFormula: next })
              }}
            >
              <option value="schema">schema</option>
              <option value="importance">importance</option>
            </select>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Edge Width</span>}
          valueNode={(
            <select
              className={uiPanelKeyValueInputClass}
              value={edgeWidthFormula}
              onChange={e => {
                const next: 'schema' | 'weight' = e.target.value === 'weight' ? 'weight' : 'schema'
                setThreeConfig({ edgeWidthFormula: next })
              }}
            >
              <option value="schema">schema</option>
              <option value="weight">weight</option>
            </select>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Keyword Node Scale</span>}
          valueNode={(
            <input
              type="number"
              min={0.2}
              max={5}
              step={0.1}
              className={uiPanelKeyValueInputClass}
              value={keywordNodeSizeScale}
              onChange={e => {
                const parsed = Number(e.target.value)
                setThreeConfig({ keywordNodeSizeScale: clampScale(Number.isFinite(parsed) ? parsed : 1) })
              }}
            />
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          keyNode={<span className={keyLabelClassName}>Keyword Edge Scale</span>}
          valueNode={(
            <input
              type="number"
              min={0.2}
              max={5}
              step={0.1}
              className={uiPanelKeyValueInputClass}
              value={keywordEdgeWidthScale}
              onChange={e => {
                const parsed = Number(e.target.value)
                setThreeConfig({ keywordEdgeWidthScale: clampScale(Number.isFinite(parsed) ? parsed : 1) })
              }}
            />
          )}
        />
      </>
    )
  }

  return (
    <>
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content="Renderer → choose three.nodeSizingFormula → size nodes by schema type or visual importance so key concepts stand out in dense views."
            maxWidthPx={260}

          >
            <span className={keyLabelClassName}>
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

              className="w-full h-full"
            >
              <select
                className={[UI_RESPONSIVE_CONSTRAINED_VALUE_FIELD_CLASSNAME, 'text-right', uiPanelKeyValueInputClass].filter(Boolean).join(' ')}
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
            content="Renderer → choose three.edgeWidthFormula → map edge thickness to schema label or weight so stronger relations appear visually bolder."
            maxWidthPx={260}

          >
            <span className={keyLabelClassName}>
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

              className="w-full h-full"
            >
              <select
                className={[UI_RESPONSIVE_CONSTRAINED_VALUE_FIELD_CLASSNAME, 'text-right', uiPanelKeyValueInputClass].filter(Boolean).join(' ')}
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
      <KeyTypeValueRow
        density="compact"
        layout="keyIconValue"
        keyNode={(
          <Tooltip
            content="Renderer → scale keyword node sizes (visual:nodeSize / visual:importance) to tune frequency emphasis without regenerating the keyword graph."
            maxWidthPx={260}

          >
            <span className={keyLabelClassName}>
              schema.three.keywordNodeSizeScale
            </span>
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              min={0.2}
              max={5}
              step={0.1}
              className={[UI_RESPONSIVE_CONSTRAINED_VALUE_FIELD_CLASSNAME, 'text-right', uiPanelKeyValueInputClass].filter(Boolean).join(' ')}
              value={keywordNodeSizeScale}
              onChange={e => {
                const parsed = Number(e.target.value)
                setThreeConfig({ keywordNodeSizeScale: clampScale(Number.isFinite(parsed) ? parsed : 1) })
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
            content="Renderer → scale keyword edge widths (visual:width / weight) to tune strength emphasis without regenerating the keyword graph."
            maxWidthPx={260}

          >
            <span className={keyLabelClassName}>
              schema.three.keywordEdgeWidthScale
            </span>
          </Tooltip>
        )}
        typeNode={null}
        valueNode={(
          <RightAlignedValueCell>
            <input
              type="number"
              min={0.2}
              max={5}
              step={0.1}
              className={[UI_RESPONSIVE_CONSTRAINED_VALUE_FIELD_CLASSNAME, 'text-right', uiPanelKeyValueInputClass].filter(Boolean).join(' ')}
              value={keywordEdgeWidthScale}
              onChange={e => {
                const parsed = Number(e.target.value)
                setThreeConfig({ keywordEdgeWidthScale: clampScale(Number.isFinite(parsed) ? parsed : 1) })
              }}
            />
          </RightAlignedValueCell>
        )}
      />
    </>
  )
}
