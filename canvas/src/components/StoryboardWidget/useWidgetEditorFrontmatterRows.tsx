import React from 'react'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { StoryboardWidgetInlineValueEditor } from '@/components/StoryboardWidget/StoryboardWidgetInlineValueEditor'
import { WidgetEditorKvTable, type WidgetEditorKvRow } from '@/components/StoryboardWidget/WidgetEditorKvTable'
import { PORT_HANDLE_STROKE_CLASS } from '@/components/StoryboardWidget/portHandleUi'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import {
  applyWidgetFieldValueUpdate,
  coerceWidgetFieldValue,
  formatWidgetFieldValueText,
  normalizeWidgetFieldSchemaPath,
  readWidgetFieldValueText,
} from '@/features/storyboard-widget-manager/widgetFieldMutation'
import type { FrontmatterWidgetContractRowSpec } from '@/features/storyboard-widget-manager/frontmatterWidgetContract'
import {
  formatFlowHandleAccessibleName,
  formatFlowHandleKtvKeyLabel,
  formatFlowHandleSemanticKey,
  readFlowHandlePath,
} from '@/lib/graph/flowHandlePresentation'
import { cleanDomIdPart } from '@/components/StoryboardWidget/widgetEditorFormSemantics'

type FrontmatterContractRowSpecs = {
  handleRows: ReadonlyArray<Extract<FrontmatterWidgetContractRowSpec, { kind: 'handle' }>>
  envelopeRows: ReadonlyArray<FrontmatterWidgetContractRowSpec>
}

export type FrontmatterPortKvRow = WidgetEditorKvRow & {
  dir: 'in' | 'out'
  portKey: string
  schemaPath: string
  normalizedSchemaPath: string
}

export function useWidgetEditorFrontmatterRows(args: {
  active: boolean
  idBase: string
  keyLabelClass: string
  keyValueInputClass: string
  textSizeClass: string
  monospaceTextClass: string
  dotSizePx: number
  dotHitPx: number
  portHandlesEnabled: boolean
  onSchemaPortHandleClick?: (args: { dir: 'in' | 'out'; portKey: string }) => void
  frontmatterContractRowSpecs: FrontmatterContractRowSpecs
  connectedValuesSnapshot?: Record<string, { value?: unknown }>
  propertiesSnapshot: Record<string, unknown>
  flowDataDraft: string
  setFlowDataDraft: React.Dispatch<React.SetStateAction<string>>
  flowCompute: string
  flowEnvelopeValueBoxClass: string
  propertiesInlineMediaCommandContext: string
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
}): {
  frontmatterPortRows: FrontmatterPortKvRow[]
  frontmatterEnvelopeRows: WidgetEditorKvRow[]
} {
  const {
    active,
    idBase,
    keyLabelClass,
    keyValueInputClass,
    textSizeClass,
    monospaceTextClass,
    dotSizePx,
    dotHitPx,
    portHandlesEnabled,
    onSchemaPortHandleClick,
    frontmatterContractRowSpecs,
    connectedValuesSnapshot,
    propertiesSnapshot,
    flowDataDraft,
    setFlowDataDraft,
    flowCompute,
    flowEnvelopeValueBoxClass,
    propertiesInlineMediaCommandContext,
    onPatchProperties,
    onSetProperties,
  } = args

  const renderFrontmatterPortButton = React.useCallback((
    dir: 'in' | 'out',
    portKey: string,
    accessibleName?: string,
    schemaPath?: string,
  ) => {
    const aria = String(accessibleName || '').trim() || formatFlowHandleSemanticKey({ dir, portKey })
    return (
      <button
        key={`${dir}:${portKey}`}
        type="button"
        aria-label={aria}
        title={aria}
        data-kg-port-handle="1"
        data-kg-port-handle-kind="dot"
        data-kg-port-dir={dir}
        data-kg-port-key={portKey}
        data-kg-port-path={readFlowHandlePath(dir)}
        data-kg-port-schema-path={String(schemaPath || '').trim() || undefined}
        className={cn('relative block', UI_THEME_TOKENS.button.text)}
        style={{ width: `${dotHitPx}px`, height: `${dotHitPx}px` }}
        onPointerDown={e => {
          try {
            e.stopPropagation()
          } catch {
            void 0
          }
        }}
        onClick={e => {
          try {
            e.stopPropagation()
          } catch {
            void 0
          }
          if (!active || !portHandlesEnabled) return
          onSchemaPortHandleClick?.({ dir, portKey })
        }}
        disabled={!active || !portHandlesEnabled}
      >
        <span
          aria-hidden={true}
          className={cn('absolute top-1/2 left-1/2 rounded-full border', UI_THEME_TOKENS.panel.bg, PORT_HANDLE_STROKE_CLASS)}
          style={{ width: `${dotSizePx}px`, height: `${dotSizePx}px`, transform: 'translate(-50%, -50%)' }}
        />
      </button>
    )
  }, [active, dotHitPx, dotSizePx, onSchemaPortHandleClick, portHandlesEnabled])

  const frontmatterEnvelopeFieldSchemaPathSet = React.useMemo(() => {
    const out = new Set<string>()
    frontmatterContractRowSpecs.envelopeRows.forEach(rowSpec => {
      if (rowSpec.kind !== 'field') return
      const schemaPath = normalizeWidgetFieldSchemaPath(rowSpec.schemaPath, rowSpec.fieldKey)
      if (schemaPath) out.add(schemaPath)
    })
    return out
  }, [frontmatterContractRowSpecs.envelopeRows])

  const frontmatterPortRows = React.useMemo<FrontmatterPortKvRow[]>(() => {
    return frontmatterContractRowSpecs.handleRows.flatMap(rowSpec => {
      const portKeys = rowSpec.portKeys.map(portKey => String(portKey || '').trim()).filter(Boolean)
      if (portKeys.length === 0) return []
      const occurrenceCounts = new Map<string, number>()
      portKeys.forEach(portKey => {
        occurrenceCounts.set(portKey, (occurrenceCounts.get(portKey) || 0) + 1)
      })
      const occurrenceIndexes = new Map<string, number>()
      return portKeys.map((portKey, index) => {
        const occurrenceCount = occurrenceCounts.get(portKey) || 1
        const occurrenceIndex = occurrenceIndexes.get(portKey) || 0
        occurrenceIndexes.set(portKey, occurrenceIndex + 1)
        const schemaPath = portKey
        const normalizedSchemaPath = normalizeWidgetFieldSchemaPath(schemaPath, portKey)
        const accessibleName = formatFlowHandleAccessibleName({
          dir: rowSpec.dir,
          portKey,
          schemaPath,
          occurrenceIndex,
          occurrenceCount,
        })
        const rowKey = `${rowSpec.rowKey}-${index}-${cleanDomIdPart(portKey) || 'port'}`
        const inputId = `${idBase}-${rowKey}`
        const portButton = renderFrontmatterPortButton(rowSpec.dir, portKey, accessibleName, schemaPath)
        const keyLabel = formatFlowHandleKtvKeyLabel({ dir: rowSpec.dir, portKey }) || accessibleName
        const connectedPortValue = rowSpec.dir === 'in' ? connectedValuesSnapshot?.[normalizedSchemaPath]?.value : undefined
        const connectedPortValueText = typeof connectedPortValue !== 'undefined' ? formatWidgetFieldValueText(connectedPortValue) : ''
        const portValueText = readWidgetFieldValueText({ properties: propertiesSnapshot, schemaPath, fallbackKey: portKey })
        return {
          rowKey,
          dir: rowSpec.dir,
          portKey,
          schemaPath,
          normalizedSchemaPath,
          labelId: `${idBase}-kv-${rowKey}`,
          inPortNode: rowSpec.dir === 'in' ? portButton : undefined,
          outPortNode: rowSpec.dir === 'out' ? portButton : undefined,
          keyNode: (
            <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId} title={accessibleName || keyLabel}>
              {keyLabel}
            </label>
          ),
          valueNode: (
            <PlainTextInputEditor
              id={inputId}
              data-kg-authored-value-contract="value={portValueText}"
              value={portValueText || connectedPortValueText}
              disabled
              className={cn(keyValueInputClass, textSizeClass, 'text-left', monospaceTextClass, UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
            />
          ),
        }
      })
    })
  }, [
    connectedValuesSnapshot,
    frontmatterContractRowSpecs.handleRows,
    idBase,
    keyLabelClass,
    keyValueInputClass,
    monospaceTextClass,
    propertiesSnapshot,
    renderFrontmatterPortButton,
    textSizeClass,
  ])

  const frontmatterFieldPortNodesBySchemaPath = React.useMemo(() => {
    const out = new Map<string, Pick<WidgetEditorKvRow, 'inPortNode' | 'outPortNode'>>()
    frontmatterPortRows.forEach(row => {
      if (!row.normalizedSchemaPath || !frontmatterEnvelopeFieldSchemaPathSet.has(row.normalizedSchemaPath)) return
      const current = out.get(row.normalizedSchemaPath) || {}
      out.set(row.normalizedSchemaPath, {
        ...current,
        ...(row.dir === 'in' ? { inPortNode: row.inPortNode } : { outPortNode: row.outPortNode }),
      })
    })
    return out
  }, [frontmatterEnvelopeFieldSchemaPathSet, frontmatterPortRows])

  const frontmatterEnvelopeRows = React.useMemo<WidgetEditorKvRow[]>(() => {
    return frontmatterContractRowSpecs.envelopeRows.flatMap<WidgetEditorKvRow>((rowSpec, fieldIndex) => {
      if (rowSpec.kind === 'handle') {
        return frontmatterPortRows.filter(row => (
          (row.rowKey === rowSpec.rowKey || row.rowKey.startsWith(`${rowSpec.rowKey}-`))
          && !frontmatterEnvelopeFieldSchemaPathSet.has(row.normalizedSchemaPath)
        ))
      }
      const inputId = `${idBase}-${rowSpec.rowKey}`
      if (rowSpec.kind === 'data' || rowSpec.rowKey === 'flow-data') {
        return [{
          rowKey: rowSpec.rowKey,
          labelId: `${idBase}-kv-${rowSpec.rowKey}`,
          showInPortDot: false,
          showOutPortDot: false,
          keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>{rowSpec.fieldKey}</label>,
          valueNode: (
            <StoryboardWidgetInlineValueEditor
              id={inputId}
              value={flowDataDraft}
              active={active}
              editorSurface="control"
              multiline
              markdownCommandContextText={propertiesInlineMediaCommandContext}
              className={flowEnvelopeValueBoxClass}
              onCommit={next => {
                const raw = String(next ?? '')
                setFlowDataDraft(raw)
                if (!raw.trim()) {
                  onPatchProperties({ data: undefined })
                  return
                }
                try {
                  onPatchProperties({ data: JSON.parse(raw) })
                } catch {
                  void 0
                }
              }}
            />
          ),
        }]
      }
      if (rowSpec.kind === 'compute' || rowSpec.rowKey === 'flow-compute') {
        return [{
          rowKey: rowSpec.rowKey,
          labelId: `${idBase}-kv-${rowSpec.rowKey}`,
          showInPortDot: false,
          showOutPortDot: false,
          keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>{rowSpec.fieldKey}</label>,
          valueNode: (
            <StoryboardWidgetInlineValueEditor
              id={inputId}
              value={flowCompute}
              active={active}
              editorSurface="control"
              multiline
              markdownCommandContextText={propertiesInlineMediaCommandContext}
              className={flowEnvelopeValueBoxClass}
              onCommit={next => onPatchProperties({ 'flow:compute': next || undefined })}
            />
          ),
        }]
      }
      const fieldSchemaPath = normalizeWidgetFieldSchemaPath(rowSpec.kind === 'field' ? rowSpec.schemaPath : '', rowSpec.fieldKey)
      const mergedPortNodes = frontmatterFieldPortNodesBySchemaPath.get(fieldSchemaPath)
      return [{
        rowKey: rowSpec.rowKey,
        labelId: `${idBase}-kv-flow-envelope-field-${fieldIndex}`,
        inPortNode: mergedPortNodes?.inPortNode,
        outPortNode: mergedPortNodes?.outPortNode,
        keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>{rowSpec.fieldKey}</label>,
        valueNode: (
          <StoryboardWidgetInlineValueEditor
            id={inputId}
            value={rowSpec.valueText}
            active={active}
            editorSurface="control"
            multiline
            markdownCommandContextText={propertiesInlineMediaCommandContext}
            className={flowEnvelopeValueBoxClass}
            onCommit={next => {
              if (!fieldSchemaPath) return
              const raw = String(next ?? '')
              const nextValue = raw.trim() ? coerceWidgetFieldValue({ fieldType: rowSpec.typeLabel, value: raw }) : undefined
              onSetProperties(applyWidgetFieldValueUpdate({
                properties: propertiesSnapshot,
                schemaPath: fieldSchemaPath,
                nextValue,
              }))
            }}
          />
        ),
      }]
    }).filter(Boolean) as WidgetEditorKvRow[]
  }, [
    active,
    flowCompute,
    flowDataDraft,
    flowEnvelopeValueBoxClass,
    frontmatterContractRowSpecs.envelopeRows,
    frontmatterEnvelopeFieldSchemaPathSet,
    frontmatterFieldPortNodesBySchemaPath,
    frontmatterPortRows,
    idBase,
    keyLabelClass,
    onPatchProperties,
    onSetProperties,
    propertiesInlineMediaCommandContext,
    propertiesSnapshot,
    setFlowDataDraft,
  ])

  return { frontmatterPortRows, frontmatterEnvelopeRows }
}
