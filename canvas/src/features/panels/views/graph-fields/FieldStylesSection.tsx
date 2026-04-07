import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'

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
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
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

  return (
    <div className="rounded border border-gray-200 bg-white p-3 space-y-3">
      {scope === 'node' ? (
        <div className="space-y-2">
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className="text-gray-700 break-words">Node type</span>}
            valueNode={<span className={`${uiPanelMonospaceTextClass} text-gray-700 break-all`}>{ownerKey || '—'}</span>}
          />
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className="text-gray-700 break-words">Fill</span>}
            valueNode={(
              <RightAlignedValueCell className="gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent disabled:opacity-50"
                  disabled={!hasOwner}
                  value={isHexColor(nodeFillNormalized) ? nodeFillNormalized : '#000000'}
                  onChange={e => updateNodeStyle(ownerKey, { color: e.target.value })}
                />
                <PlainTextInputEditor
                  className={`min-w-0 flex-1 h-6 px-2 text-xs border border-gray-300 rounded ${uiPanelMonospaceTextClass} disabled:opacity-50`}
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
            keyNode={<span className="text-gray-700 break-words">Radius</span>}
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
            keyNode={<span className="text-gray-700 break-words">Stroke</span>}
            valueNode={(
              <RightAlignedValueCell className="gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent disabled:opacity-50"
                  disabled={!hasOwner}
                  value={isHexColor(nodeStrokeNormalized) ? nodeStrokeNormalized : '#000000'}
                  onChange={e => updateNodeStroke(ownerKey, { color: e.target.value })}
                />
                <PlainTextInputEditor
                  className={`min-w-0 flex-1 h-6 px-2 text-xs border border-gray-300 rounded ${uiPanelMonospaceTextClass} disabled:opacity-50`}
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
            keyNode={<span className="text-gray-700 break-words">Stroke width</span>}
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
            keyNode={<span className="text-gray-700 break-words">Edge label</span>}
            valueNode={<span className={`${uiPanelMonospaceTextClass} text-gray-700 break-all`}>{ownerKey || '—'}</span>}
          />
          <KeyTypeValueRow
            layout="keyValue"
            align="start"
            keyNode={<span className="text-gray-700 break-words">Color</span>}
            valueNode={(
              <RightAlignedValueCell className="gap-2">
                <input
                  type="color"
                  className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent disabled:opacity-50"
                  disabled={!hasOwner}
                  value={isHexColor(edgeColorNormalized) ? edgeColorNormalized : '#000000'}
                  onChange={e => updateEdgeStyle(ownerKey, { color: e.target.value })}
                />
                <PlainTextInputEditor
                  className={`min-w-0 flex-1 h-6 px-2 text-xs border border-gray-300 rounded ${uiPanelMonospaceTextClass} disabled:opacity-50`}
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
            keyNode={<span className="text-gray-700 break-words">Width</span>}
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
            keyNode={<span className="text-gray-700 break-words">Arrow</span>}
            valueNode={(
              <RightAlignedValueCell>
                <input
                  type="checkbox"
                  className="h-3 w-3"
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
        <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-800`}>Labels</div>
        <KeyTypeValueRow
          layout="keyValue"
          align="start"
          keyNode={<span className="text-gray-700 break-words">Font size</span>}
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
          keyNode={<span className="text-gray-700 break-words">Color</span>}
          valueNode={(
            <RightAlignedValueCell className="gap-2">
              <input
                type="color"
                className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
                value={isHexColor(labelColorNormalized) ? labelColorNormalized : '#000000'}
                onChange={e => setLabelStyles({ color: e.target.value })}
              />
                <PlainTextInputEditor
                className={`min-w-0 flex-1 h-6 px-2 text-xs border border-gray-300 rounded ${uiPanelMonospaceTextClass}`}
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
          keyNode={<span className="text-gray-700 break-words">Offset dx</span>}
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
          keyNode={<span className="text-gray-700 break-words">Offset dy</span>}
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
