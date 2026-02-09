import React from 'react'

import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  FLOW_EDITOR_ASPECT_RATIO_OPTIONS,
  FLOW_EDITOR_DURATION_SECONDS_OPTIONS,
  FLOW_EDITOR_RESOLUTION_OPTIONS,
  FLOW_EDITOR_SMART_NODE_MODEL_OPTIONS,
  UI_COPY,
  UI_LABELS,
  type FlowEditorSmartNodeProperties,
} from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { FLOW_SCHEMA_FIELDS_PROPERTY_KEY, readSchemaFieldSpecs } from '@/lib/graph/flowPorts'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import {
  FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY,
  FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY,
} from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { readPortHandleUiMetrics } from '@/components/FlowEditor/portHandleUi'
import { NodeOverlayEditorSchemaTable } from '@/components/FlowEditor/NodeOverlayEditorSchemaTable'
import { NodeOverlayEditorRegistrySection } from '@/components/FlowEditor/NodeOverlayEditorRegistrySection'
import { NodeOverlayEditorKvTable, NodeOverlayEditorTypePill } from '@/components/FlowEditor/NodeOverlayEditorKvTable'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function pickBool(v: unknown): boolean {
  return typeof v === 'boolean' ? v : false
}

function pickNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function cleanDomIdPart(v: unknown): string {
  return String(typeof v === 'string' ? v : '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

export const NodeOverlayEditorForm = React.memo(function NodeOverlayEditorForm({
  active,
  node,
  schema,
  hideFields,
  labelInputRef,
  onSetLabel,
  onSetType,
  onPatchProperties,
  onSetProperties,
  onValidate,
  onSchemaPortHandleClick,
  onRenameSchemaFieldId,
  onRegistrySelectionChange,
  connectedValuesBySchemaPath,
  registryEntry = null,
  registryEntries = [],
}: {
  active: boolean
  node: GraphNode
  schema: GraphSchema | null
  hideFields: boolean
  labelInputRef: React.RefObject<HTMLInputElement>
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onSchemaPortHandleClick?: (args: { dir: 'in' | 'out'; portKey: string }) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void
  onRegistrySelectionChange?: (args: { entry: NodeQuickEditorRegistryEntry | null }) => void
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  registryEntry?: NodeQuickEditorRegistryEntry | null
  registryEntries?: ReadonlyArray<NodeQuickEditorRegistryEntry>
}) {
  const { panelTextClass, microLabelClass, monospaceTextClass, textSizeClass, keyValueInputClass, keyLabelClass } = usePanelTypography()
  void onSetType
  void onValidate
  const properties = (node.properties || {}) as Record<string, unknown>
  const nodeTypeId = pickString(node.type).trim()
  const idBase = React.useMemo(() => {
    const nodeId = cleanDomIdPart(node.id) || 'node'
    return `flow-node-quick-${nodeId}`
  }, [node.id])

  const ids = React.useMemo(() => {
    return {
      label: `${idBase}-label`,
      type: `${idBase}-type`,
      model: `${idBase}-model`,
      prompt: `${idBase}-prompt`,
      aspect: `${idBase}-aspect`,
      duration: `${idBase}-duration`,
      resolution: `${idBase}-resolution`,
      generateAudio: `${idBase}-generate-audio`,
      fast: `${idBase}-fast`,
      referenceImage: `${idBase}-reference-image`,
      registrySelect: `${idBase}-registry-select`,
      registryField: (fieldKey: string) => `${idBase}-registry-field-${cleanDomIdPart(fieldKey) || 'field'}`,
      portHandle: (portKey: string, dir: 'in' | 'out') => `${idBase}-port-${dir}-${cleanDomIdPart(portKey) || 'port'}`,
    }
  }, [idBase])

  const schemaFields = React.useMemo(() => readSchemaFieldSpecs(node), [node])
  const portHandlesEnabled = Boolean(schema?.behavior?.portHandles?.enabled)
  const { sizePx: dotSizePx, hitSizePx: dotHitPx } = React.useMemo(() => {
    const m = readPortHandleUiMetrics(schema)
    return { sizePx: Math.max(10, m.sizePx), hitSizePx: Math.max(18, m.hitSizePx + 2) }
  }, [schema])

  const model = pickString(properties.model)
  const prompt = pickString(properties.prompt)
  const aspectRatio = pickString(properties.aspect_ratio)
  const duration = pickNumber(properties.duration)
  const resolution = pickString(properties.resolution)
  const generateAudio = pickBool(properties.generate_audio)
  const fast = pickBool(properties.fast)
  const referenceImage = pickString(properties.reference_image)

  const normalizeRegistrySchemaPath = React.useCallback((schemaPath: string | undefined, fallbackKey: string) => {
    const raw = String(schemaPath || fallbackKey || '').trim()
    if (!raw) return ''
    if (raw.startsWith('properties') || raw.startsWith('metadata') || raw.startsWith('label') || raw.startsWith('type')) return raw
    return `properties.${raw}`
  }, [])

  const registryOptions = React.useMemo(
    () =>
      (registryEntries || []).filter(
        entry => entry && entry.isEnabled && entry.nodeTypeId === nodeTypeId,
      ),
    [nodeTypeId, registryEntries],
  )
  const registrySelectionId = registryEntry?.id || ''
  const hasRegistryOptions = registryOptions.length > 0

  const registryOptionIdsSig = React.useMemo(() => {
    return (registryOptions || []).map(e => String(e.id || '')).join('|')
  }, [registryOptions])

  const registryOptionIdSet = React.useMemo(() => {
    const parts = String(registryOptionIdsSig || '').split('|').map(s => s.trim()).filter(Boolean)
    return new Set(parts)
  }, [registryOptionIdsSig])

  React.useEffect(() => {
    if (!active) return
    if (!registrySelectionId) return
    if (registryOptionIdSet.has(registrySelectionId)) return
    onPatchProperties({
      [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: undefined,
      [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: undefined,
    })
    onRegistrySelectionChange?.({ entry: null })
  }, [active, onPatchProperties, onRegistrySelectionChange, registryOptionIdSet, registrySelectionId])
  const handleRegistrySelect = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextId = String(event.target.value || '').trim()
      if (nextId === registrySelectionId) return
      if (!nextId) {
        onPatchProperties({
          [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: undefined,
          [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: undefined,
        })
        onRegistrySelectionChange?.({ entry: null })
        return
      }
      const nextEntry = registryOptions.find(entry => entry.id === nextId)
      if (!nextEntry) return
      onPatchProperties({
        [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: nextEntry.quickEditorTypeId,
        [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: nextEntry.formId,
      })
      onRegistrySelectionChange?.({ entry: nextEntry })
    },
    [onPatchProperties, onRegistrySelectionChange, registryOptions, registrySelectionId],
  )

  return (
    <form
      className={cn('px-3 py-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden', panelTextClass)}
      aria-label={UI_LABELS.flowNodeQuickEditorForm}
      onSubmit={e => e.preventDefault()}
    >
      <section className="min-w-0" aria-label={UI_LABELS.flowNodeQuickEditorNodeLegend}>
        <NodeOverlayEditorKvTable
          ariaLabel={UI_LABELS.flowNodeQuickEditorNodeLegend}
          microLabelClass={microLabelClass}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          forcePortDots
          rows={[
            {
              rowKey: 'node-label',
              labelId: `${idBase}-kv-node-label`,
              keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.label}>{UI_LABELS.name}</label>,
              typeNode: <NodeOverlayEditorTypePill text="text" />,
              valueNode: (
                <input
                  ref={labelInputRef}
                  id={ids.label}
                  className={cn(
                    keyValueInputClass,
                    textSizeClass,
                    'text-left',
                    UI_THEME_TOKENS.input.bg,
                    UI_THEME_TOKENS.input.border,
                    UI_THEME_TOKENS.input.text,
                  )}
                  value={String(node.label || '')}
                  onChange={e => onSetLabel(e.target.value)}
                  disabled={!active}
                />
              ),
            },
          ]}
        />
      </section>

      {!hideFields && (
        <section className="min-w-0 mt-4" aria-label={UI_LABELS.flowNodeQuickEditorSmartFieldsLegend}>
          <NodeOverlayEditorKvTable
            ariaLabel={UI_LABELS.flowNodeQuickEditorSmartFieldsLegend}
            microLabelClass={microLabelClass}
            dotSizePx={dotSizePx}
            dotHitPx={dotHitPx}
            forcePortDots
            rows={[
              {
                rowKey: 'smart-model',
                labelId: `${idBase}-kv-smart-model`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.model}>{UI_LABELS.flowNodeQuickEditorModel}</label>,
                typeNode: <NodeOverlayEditorTypePill text="enum" />,
                valueNode: (
                  <select
                    id={ids.model}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={model}
                    onChange={e => onPatchProperties({ model: (e.target.value || undefined) as FlowEditorSmartNodeProperties['model'] })}
                    disabled={!active}
                  >
                    <option value="">{UI_COPY.flowNodeQuickEditorSelectPlaceholder}</option>
                    {FLOW_EDITOR_SMART_NODE_MODEL_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                rowKey: 'smart-prompt',
                labelId: `${idBase}-kv-smart-prompt`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.prompt}>{UI_LABELS.flowNodeQuickEditorPrompt}</label>,
                typeNode: <NodeOverlayEditorTypePill text="text" />,
                valueNode: (
                  <textarea
                    id={ids.prompt}
                    className={cn(
                      'w-full h-32 px-2 py-1 rounded-md border',
                      monospaceTextClass,
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={prompt}
                    onChange={e => onPatchProperties({ prompt: e.target.value })}
                    disabled={!active}
                  />
                ),
              },
              {
                rowKey: 'smart-aspect',
                labelId: `${idBase}-kv-smart-aspect`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.aspect}>{UI_LABELS.flowNodeQuickEditorAspectRatio}</label>,
                typeNode: <NodeOverlayEditorTypePill text="enum" />,
                valueNode: (
                  <select
                    id={ids.aspect}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={aspectRatio}
                    onChange={e =>
                      onPatchProperties({
                        aspect_ratio: (e.target.value || undefined) as FlowEditorSmartNodeProperties['aspect_ratio'],
                      })
                    }
                    disabled={!active}
                  >
                    <option value="">{UI_COPY.flowNodeQuickEditorSelectPlaceholder}</option>
                    {FLOW_EDITOR_ASPECT_RATIO_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                rowKey: 'smart-duration',
                labelId: `${idBase}-kv-smart-duration`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.duration}>{UI_LABELS.flowNodeQuickEditorDuration}</label>,
                typeNode: <NodeOverlayEditorTypePill text="int" />,
                valueNode: (
                  <select
                    id={ids.duration}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={duration === null ? '' : String(duration)}
                    onChange={e => {
                      const next = Number.parseInt(e.target.value, 10)
                      onPatchProperties({ duration: Number.isFinite(next) ? next : undefined })
                    }}
                    disabled={!active}
                  >
                    <option value="">{UI_COPY.flowNodeQuickEditorSelectPlaceholder}</option>
                    {FLOW_EDITOR_DURATION_SECONDS_OPTIONS.map(o => (
                      <option key={o.value} value={String(o.value)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                rowKey: 'smart-resolution',
                labelId: `${idBase}-kv-smart-resolution`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.resolution}>{UI_LABELS.flowNodeQuickEditorResolution}</label>,
                typeNode: <NodeOverlayEditorTypePill text="enum" />,
                valueNode: (
                  <select
                    id={ids.resolution}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={resolution}
                    onChange={e =>
                      onPatchProperties({ resolution: (e.target.value || undefined) as FlowEditorSmartNodeProperties['resolution'] })
                    }
                    disabled={!active}
                  >
                    <option value="">{UI_COPY.flowNodeQuickEditorSelectPlaceholder}</option>
                    {FLOW_EDITOR_RESOLUTION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                rowKey: 'smart-generate-audio',
                labelId: `${idBase}-kv-smart-generate-audio`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.generateAudio}>{UI_LABELS.flowNodeQuickEditorGenerateAudio}</label>,
                typeNode: <NodeOverlayEditorTypePill text="bool" />,
                valueNode: (
                <section className="w-full flex items-center">
                  <input
                    id={ids.generateAudio}
                    type="checkbox"
                    checked={generateAudio}
                    onChange={e => onPatchProperties({ generate_audio: e.target.checked })}
                    disabled={!active}
                  />
                </section>
                ),
              },
              {
                rowKey: 'smart-fast',
                labelId: `${idBase}-kv-smart-fast`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.fast}>{UI_LABELS.flowNodeQuickEditorFast}</label>,
                typeNode: <NodeOverlayEditorTypePill text="bool" />,
                valueNode: (
                <section className="w-full flex items-center">
                  <input
                    id={ids.fast}
                    type="checkbox"
                    checked={fast}
                    onChange={e => onPatchProperties({ fast: e.target.checked })}
                    disabled={!active}
                  />
                </section>
                ),
              },
              {
                rowKey: 'smart-reference-image',
                labelId: `${idBase}-kv-smart-reference-image`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.referenceImage}>{UI_LABELS.flowNodeQuickEditorReferenceImage}</label>,
                typeNode: <NodeOverlayEditorTypePill text="text" />,
                valueNode: (
                  <input
                    id={ids.referenceImage}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={referenceImage}
                    onChange={e => onPatchProperties({ reference_image: e.target.value || undefined })}
                    placeholder={UI_COPY.flowNodeQuickEditorReferenceImagePlaceholder}
                    disabled={!active}
                  />
                ),
              },
            ]}
          />
        </section>
      )}

      <section className="min-w-0 mt-4" aria-label={UI_LABELS.flowEditorMapping}>
        <NodeOverlayEditorKvTable
          ariaLabel={UI_LABELS.flowEditorMapping}
          microLabelClass={microLabelClass}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          forcePortDots
          rows={[
            {
              rowKey: 'mapping-registry',
              labelId: `${idBase}-kv-mapping-registry`,
              keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.registrySelect}>{UI_LABELS.flowNodeQuickEditor}</label>,
              typeNode: <NodeOverlayEditorTypePill text="mapping" />,
              valueNode: (
                <select
                  id={ids.registrySelect}
                  className={cn(
                    keyValueInputClass,
                    textSizeClass,
                    'text-left',
                    UI_THEME_TOKENS.input.bg,
                    UI_THEME_TOKENS.input.border,
                    UI_THEME_TOKENS.input.text,
                  )}
                  value={registrySelectionId}
                  onChange={handleRegistrySelect}
                  disabled={!active || !hasRegistryOptions}
                >
                  <option value="">{hasRegistryOptions ? UI_COPY.flowNodeQuickEditorSelectPlaceholder : UI_LABELS.noneLabel}</option>
                  {registryOptions.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.id}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      </section>

      {!hideFields && registryEntry && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={properties}
          registryEntry={registryEntry}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          normalizeRegistrySchemaPath={normalizeRegistrySchemaPath}
          ids={{ registryField: ids.registryField }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          portHandlesEnabled={portHandlesEnabled}
          connectedValuesBySchemaPath={connectedValuesBySchemaPath}
          onSetProperties={onSetProperties}
          onSchemaPortHandleClick={onSchemaPortHandleClick}
        />
      )}

      {(schemaFields.length > 0 || (registryEntry?.quickEditorTypeId || '').toLowerCase().includes('schema')) && (
        <section className="min-w-0 mt-4" aria-label={UI_LABELS.flowNodeQuickEditorSchemaLegend}>
          <NodeOverlayEditorSchemaTable
            active={active}
            schemaFields={schemaFields}
            portHandlesEnabled={portHandlesEnabled}
            dotSizePx={dotSizePx}
            dotHitPx={dotHitPx}
            microLabelClass={microLabelClass}
            textSizeClass={textSizeClass}
            keyValueInputClass={keyValueInputClass}
            onSchemaPortHandleClick={onSchemaPortHandleClick}
            onRenameSchemaFieldId={onRenameSchemaFieldId}
            onCommitSchemaFields={next => {
              onPatchProperties({ [FLOW_SCHEMA_FIELDS_PROPERTY_KEY]: next })
            }}
          />
        </section>
      )}

    </form>
  )
})
