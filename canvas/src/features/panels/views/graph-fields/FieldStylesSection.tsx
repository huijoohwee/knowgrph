import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type FieldStylesSectionProps = {
  schema: GraphSchema
  scope: 'node' | 'edge'
  ownerKey: string
  uiPanelKeyValueTextSizeClass: string
}

function isHexColor(text: string) {
  const v = String(text || '').trim()
  if (!v.startsWith('#')) return false
  if (v.length === 4) return true
  if (v.length === 7) return true
  return false
}

export default function FieldStylesSection({
  schema,
  scope,
  ownerKey,
  uiPanelKeyValueTextSizeClass,
}: FieldStylesSectionProps) {
  const {
    updateNodeStyle,
    updateEdgeStyle,
    updateNodeSize,
    updateNodeStroke,
    setLabelStyles,
    setLabelOffset,
    setEdgeArrow,
  } = useGraphStore()
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`,
  )
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )

  const hasOwner = Boolean(String(ownerKey || '').trim())

  const nodeFillRaw = scope === 'node' ? String(schema.nodeStyles[ownerKey]?.color ?? '') : ''
  const nodeFillNormalized = nodeFillRaw.trim() || '#28A745'
  const nodeStrokeRaw = scope === 'node' ? String(schema.nodeStroke?.[ownerKey]?.color ?? '') : ''
  const nodeStrokeNormalized = nodeStrokeRaw.trim() || '#ffffff'

  const edgeColorRaw = scope === 'edge' ? String(schema.edgeStyles[ownerKey]?.color ?? '') : ''
  const edgeColorNormalized = edgeColorRaw.trim() || '#999999'

  const labelColorRaw = String(schema.labelStyles?.color ?? '')
  const labelColorNormalized = labelColorRaw.trim() || '#111111'
  const panelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-3`
  const keyLabelClassName = `${UI_THEME_TOKENS.text.secondary} break-words`
  const ownerValueClassName = `${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.secondary} break-all`
  const colorPickerClassName = `w-8 h-6 p-0 border ${UI_THEME_TOKENS.input.border} rounded cursor-pointer bg-transparent ${UI_THEME_TOKENS.focus.primaryBorderRing} disabled:opacity-50`
  const colorInputClassName = `min-w-0 flex-1 h-6 px-2 text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded ${UI_THEME_TOKENS.input.text} ${UI_THEME_TOKENS.focus.primaryBorderRing} ${uiPanelMonospaceTextClass} disabled:opacity-50`
  const sectionHeadingClassName = `${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.primary}`
  const selectionControlClassName = `h-3 w-3 rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`

  return (
    <div className={panelClassName}>
      {scope === 'node' ? (
        <div className="space-y-2">
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className={keyLabelClassName}>Node type</span>}
            valueNode={<span className={ownerValueClassName}>{ownerKey || '—'}</span>}
          />
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className={keyLabelClassName}>Fill</span>}
            valueNode={(
              <RightAlignedValueCell className="gap-2">
                <input
                  type="color"
                  className={colorPickerClassName}
                  disabled={!hasOwner}
                  value={isHexColor(nodeFillNormalized) ? nodeFillNormalized : '#000000'}
                  onChange={e => updateNodeStyle(ownerKey, { color: e.target.value })}
                />
                <PlainTextInputEditor
                  className={colorInputClassName}
                  disabled={!hasOwner}
                  value={nodeFillRaw}
                  onChange={next => updateNodeStyle(ownerKey, { color: next })}
                  placeholder="#28A745"
                />
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className={keyLabelClassName}>Radius</span>}
            valueNode={(
              <RightAlignedValueCell>
                <input
                  type="number"
                  min={2}
                  max={60}
                  step={1}
                  disabled={!hasOwner}
                  value={schema.nodeSizes?.[ownerKey]?.radius ?? 10}
                  onChange={e => updateNodeSize(ownerKey, { radius: parseInt(e.target.value || '10', 10) })}
                  className={`${uiPanelKeyValueInputClass} disabled:opacity-50`}
                />
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className={keyLabelClassName}>Stroke</span>}
            valueNode={(
              <RightAlignedValueCell className="gap-2">
                <input
                  type="color"
                  className={colorPickerClassName}
                  disabled={!hasOwner}
                  value={isHexColor(nodeStrokeNormalized) ? nodeStrokeNormalized : '#000000'}
                  onChange={e => updateNodeStroke(ownerKey, { color: e.target.value })}
                />
                <PlainTextInputEditor
                  className={colorInputClassName}
                  disabled={!hasOwner}
                  value={nodeStrokeRaw}
                  onChange={next => updateNodeStroke(ownerKey, { color: next })}
                  placeholder="#ffffff"
                />
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className={keyLabelClassName}>Stroke width</span>}
            valueNode={(
              <RightAlignedValueCell>
                <input
                  type="number"
                  min={0}
                  max={8}
                  step={0.5}
                  disabled={!hasOwner}
                  value={schema.nodeStroke?.[ownerKey]?.width ?? 1.5}
                  onChange={e => updateNodeStroke(ownerKey, { width: parseFloat(e.target.value || '1.5') })}
                  className={`${uiPanelKeyValueInputClass} disabled:opacity-50`}
                />
              </RightAlignedValueCell>
            )}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className={keyLabelClassName}>Edge label</span>}
            valueNode={<span className={ownerValueClassName}>{ownerKey || '—'}</span>}
          />
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className={keyLabelClassName}>Color</span>}
            valueNode={(
              <RightAlignedValueCell className="gap-2">
                <input
                  type="color"
                  className={colorPickerClassName}
                  disabled={!hasOwner}
                  value={isHexColor(edgeColorNormalized) ? edgeColorNormalized : '#000000'}
                  onChange={e => updateEdgeStyle(ownerKey, { color: e.target.value })}
                />
                <PlainTextInputEditor
                  className={colorInputClassName}
                  disabled={!hasOwner}
                  value={edgeColorRaw}
                  onChange={next => updateEdgeStyle(ownerKey, { color: next })}
                  placeholder="#999999"
                />
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className={keyLabelClassName}>Width</span>}
            valueNode={(
              <RightAlignedValueCell>
                <input
                  type="number"
                  min={0.5}
                  max={8}
                  step={0.5}
                  disabled={!hasOwner}
                  value={schema.edgeStyles[ownerKey]?.width ?? 2}
                  onChange={e => updateEdgeStyle(ownerKey, { width: parseFloat(e.target.value || '2') })}
                  className={`${uiPanelKeyValueInputClass} disabled:opacity-50`}
                />
              </RightAlignedValueCell>
            )}
          />
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className={keyLabelClassName}>Arrow</span>}
            valueNode={(
              <RightAlignedValueCell>
                <input
                  type="checkbox"
                  className={selectionControlClassName}
                  checked={!!schema.edgeStyles[ownerKey]?.arrow}
                  disabled={!hasOwner}
                  onChange={e => setEdgeArrow(ownerKey, e.target.checked)}
                />
              </RightAlignedValueCell>
            )}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className={sectionHeadingClassName}>Labels</div>
        <KeyTypeValueRow
          layout="keyValue"
          align="start"
          keyNode={<span className={keyLabelClassName}>Font size</span>}
          valueNode={(
            <RightAlignedValueCell>
              <input
                type="number"
                min={8}
                max={32}
                step={1}
                value={schema.labelStyles?.fontSize ?? 12}
                onChange={e => setLabelStyles({ fontSize: parseInt(e.target.value || '12', 10) })}
                className={uiPanelKeyValueInputClass}
              />
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          align="start"
          keyNode={<span className={keyLabelClassName}>Color</span>}
          valueNode={(
            <RightAlignedValueCell className="gap-2">
              <input
                type="color"
                className={colorPickerClassName.replace(' disabled:opacity-50', '')}
                value={isHexColor(labelColorNormalized) ? labelColorNormalized : '#000000'}
                onChange={e => setLabelStyles({ color: e.target.value })}
              />
              <PlainTextInputEditor
                className={colorInputClassName.replace(' disabled:opacity-50', '')}
                value={labelColorRaw}
                onChange={next => setLabelStyles({ color: next })}
                placeholder="#111111"
              />
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          align="start"
          keyNode={<span className={keyLabelClassName}>Offset dx</span>}
          valueNode={(
            <RightAlignedValueCell>
              <input
                type="number"
                step={1}
                value={schema.labelStyles?.offset?.dx ?? 12}
                onChange={e => setLabelOffset({ dx: parseInt(e.target.value || '12', 10) })}
                className={uiPanelKeyValueInputClass}
              />
            </RightAlignedValueCell>
          )}
        />
        <KeyTypeValueRow
          layout="keyValue"
          align="start"
          keyNode={<span className={keyLabelClassName}>Offset dy</span>}
          valueNode={(
            <RightAlignedValueCell>
              <input
                type="number"
                step={1}
                value={schema.labelStyles?.offset?.dy ?? 4}
                onChange={e => setLabelOffset({ dy: parseInt(e.target.value || '4', 10) })}
                className={uiPanelKeyValueInputClass}
              />
            </RightAlignedValueCell>
          )}
        />
      </div>
    </div>
  )
}
