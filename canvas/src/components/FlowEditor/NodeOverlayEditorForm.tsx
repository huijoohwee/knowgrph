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
import { FLOATING_PANEL_SCROLL_CLASSNAME } from '@/components/ui/FloatingPanel'
import { buildSchemaFieldPortKey, readSchemaFieldSpecs } from '@/lib/graph/flowPorts'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import {
  FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY,
  FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY,
} from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { getObjectPath, setObjectPath } from '@/lib/data/objectPath'
import { PORT_HANDLE_STROKE_CLASS, readPortHandleUiMetrics } from '@/components/FlowEditor/portHandleUi'

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
  onRegistrySelectionChange,
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
  onRegistrySelectionChange?: (args: { entry: NodeQuickEditorRegistryEntry | null }) => void
  registryEntry?: NodeQuickEditorRegistryEntry | null
  registryEntries?: ReadonlyArray<NodeQuickEditorRegistryEntry>
}) {
  const { panelTextClass, microLabelClass, monospaceTextClass, textSizeClass, keyValueInputClass, keyLabelClass } = usePanelTypography()
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

  const registryFields = registryEntry?.fields || []
  const registryPorts = registryEntry?.ports || []
  const registryOptions = React.useMemo(
    () =>
      (registryEntries || []).filter(
        entry => entry && entry.isEnabled && entry.nodeTypeId === nodeTypeId,
      ),
    [nodeTypeId, registryEntries],
  )
  const registrySelectionId = registryEntry?.id || ''
  const hasRegistryOptions = registryOptions.length > 0
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
      className={cn('p-3', panelTextClass, FLOATING_PANEL_SCROLL_CLASSNAME)}
      aria-label={UI_LABELS.flowNodeQuickEditorForm}
      onSubmit={e => e.preventDefault()}
    >
      <fieldset className="min-w-0">
        <legend className={cn(microLabelClass, 'font-medium', UI_THEME_TOKENS.text.secondary)}>
          {UI_LABELS.flowNodeQuickEditorNodeLegend}
        </legend>

        <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.label}>
          {UI_LABELS.name}
        </label>
        <input
          ref={labelInputRef}
          id={ids.label}
          className={cn(
            'mt-1 w-full h-8 rounded-md',
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

        <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.type}>
          {UI_LABELS.type}
        </label>
        <input
          id={ids.type}
          className={cn(
            'mt-1 w-full h-8 rounded-md',
            keyValueInputClass,
            textSizeClass,
            'text-left',
            UI_THEME_TOKENS.input.bg,
            UI_THEME_TOKENS.input.border,
            UI_THEME_TOKENS.input.text,
          )}
          value={String(node.type || 'Node')}
          onChange={e => onSetType(e.target.value)}
          disabled={!active}
        />
      </fieldset>

      {!hideFields && (
        <fieldset className="min-w-0 mt-4">
          <legend className={cn(microLabelClass, 'font-medium', UI_THEME_TOKENS.text.secondary)}>
            {UI_LABELS.flowNodeQuickEditorSmartFieldsLegend}
          </legend>

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.model}>
            {UI_LABELS.flowNodeQuickEditorModel}
          </label>
          <select
            id={ids.model}
            className={cn(
              'mt-1 w-full h-9 rounded-md',
              keyValueInputClass,
              textSizeClass,
              'text-left',
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={model}
            onChange={e =>
              onPatchProperties({ model: (e.target.value || undefined) as FlowEditorSmartNodeProperties['model'] })
            }
            disabled={!active}
          >
            <option value="">{UI_COPY.flowNodeQuickEditorSelectPlaceholder}</option>
            {FLOW_EDITOR_SMART_NODE_MODEL_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.prompt}>
            {UI_LABELS.flowNodeQuickEditorPrompt}
          </label>
          <textarea
            id={ids.prompt}
            className={cn(
              'mt-1 w-full h-32 px-2 py-1 rounded-md border',
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={prompt}
            onChange={e => onPatchProperties({ prompt: e.target.value })}
            disabled={!active}
          />

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.aspect}>
            {UI_LABELS.flowNodeQuickEditorAspectRatio}
          </label>
          <select
            id={ids.aspect}
            className={cn(
              'mt-1 w-full h-9 rounded-md',
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

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.duration}>
            {UI_LABELS.flowNodeQuickEditorDuration}
          </label>
          <select
            id={ids.duration}
            className={cn(
              'mt-1 w-full h-9 rounded-md',
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

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.resolution}>
            {UI_LABELS.flowNodeQuickEditorResolution}
          </label>
          <select
            id={ids.resolution}
            className={cn(
              'mt-1 w-full h-9 rounded-md',
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

          <label className={cn('mt-3 flex items-center gap-2', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.generateAudio}>
            <input
              id={ids.generateAudio}
              type="checkbox"
              checked={generateAudio}
              onChange={e => onPatchProperties({ generate_audio: e.target.checked })}
              disabled={!active}
            />
            {UI_LABELS.flowNodeQuickEditorGenerateAudio}
          </label>

          <label className={cn('mt-2 flex items-center gap-2', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.fast}>
            <input
              id={ids.fast}
              type="checkbox"
              checked={fast}
              onChange={e => onPatchProperties({ fast: e.target.checked })}
              disabled={!active}
            />
            {UI_LABELS.flowNodeQuickEditorFast}
          </label>

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.referenceImage}>
            {UI_LABELS.flowNodeQuickEditorReferenceImage}
          </label>
          <input
            id={ids.referenceImage}
            className={cn(
              'mt-1 w-full h-8 rounded-md',
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
        </fieldset>
      )}

      <fieldset className="min-w-0 mt-4" aria-label="Node Quick Editor Mapping">
        <legend className={cn(microLabelClass, 'font-medium', UI_THEME_TOKENS.text.secondary)}>
          {UI_LABELS.flowEditorMapping}
        </legend>
        <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.registrySelect}>
          {UI_LABELS.flowNodeQuickEditor}
        </label>
        <select
          id={ids.registrySelect}
          className={cn(
            'mt-1 w-full h-9 rounded-md',
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
              {entry.quickEditorTypeId} · {entry.formId}
            </option>
          ))}
        </select>
        {registryEntry ? (
          <p className={cn('mt-1', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
            {registryEntry.nodeTypeId} · {registryEntry.quickEditorTypeId} · {registryEntry.formId}
          </p>
        ) : null}
      </fieldset>

      {!hideFields && registryEntry && (registryFields.length > 0 || registryPorts.length > 0) && (
        <fieldset className="min-w-0 mt-4" aria-label="Node Quick Editor Registry">
          <legend className={cn(microLabelClass, 'font-medium', UI_THEME_TOKENS.text.secondary)}>
            Registry
          </legend>

          <p className={cn('mt-1', microLabelClass, UI_THEME_TOKENS.text.secondary)}>
            {registryEntry.nodeTypeId} · {registryEntry.quickEditorTypeId} · {registryEntry.formId}
          </p>

          {registryFields.length > 0 && (
            <section className="mt-2" aria-label="Registry fields">
              {registryFields.map((f, idx) => {
                const rowKey = `${String(f.fieldKey || '')}:${idx}`
                const path = normalizeRegistrySchemaPath(f.schemaPath, f.fieldKey)
                const cur = path ? getObjectPath({ properties }, path) : undefined
                const label = String(f.label || f.fieldKey)
                const fieldType = String(f.fieldType || '').trim().toLowerCase()
                const id = ids.registryField(String(f.fieldKey || idx))

                const setValue = (nextValue: unknown) => {
                  if (!path) return
                  const nextRoot = setObjectPath({ properties }, path, nextValue)
                  const nextProps = (nextRoot as { properties?: Record<string, unknown> }).properties || {}
                  onSetProperties(nextProps)
                }

                if (fieldType === 'boolean' || fieldType === 'bool') {
                  const checked = typeof cur === 'boolean' ? cur : false
                  return (
                    <React.Fragment key={rowKey}>
                      <label className={cn('mt-2 flex items-center gap-2', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={id}>
                        <input
                          id={id}
                          type="checkbox"
                          checked={checked}
                          onChange={e => setValue(e.target.checked)}
                          disabled={!active}
                        />
                        {label}
                      </label>
                    </React.Fragment>
                  )
                }

                if (fieldType === 'number' || fieldType === 'int' || fieldType === 'integer' || fieldType === 'float') {
                  const v = typeof cur === 'number' && Number.isFinite(cur) ? String(cur) : ''
                  return (
                    <React.Fragment key={rowKey}>
                      <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={id}>
                        {label}
                      </label>
                      <input
                        id={id}
                        type="number"
                        className={cn(
                          'mt-1 w-full h-8 rounded-md',
                          keyValueInputClass,
                          textSizeClass,
                          'text-left',
                          UI_THEME_TOKENS.input.bg,
                          UI_THEME_TOKENS.input.border,
                          UI_THEME_TOKENS.input.text,
                        )}
                        value={v}
                        onChange={e => {
                          const raw = e.target.value
                          if (!raw.trim()) {
                            setValue(undefined)
                            return
                          }
                          const num = Number.parseFloat(raw)
                          setValue(Number.isFinite(num) ? num : undefined)
                        }}
                        disabled={!active}
                      />
                    </React.Fragment>
                  )
                }

                if (fieldType === 'json') {
                  const v = typeof cur === 'string' ? cur : typeof cur === 'undefined' ? '' : JSON.stringify(cur)
                  return (
                    <React.Fragment key={rowKey}>
                      <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={id}>
                        {label}
                      </label>
                      <textarea
                        id={id}
                        className={cn(
                          'mt-1 w-full h-24 px-2 py-1 rounded-md border',
                          monospaceTextClass,
                          UI_THEME_TOKENS.input.bg,
                          UI_THEME_TOKENS.input.border,
                          UI_THEME_TOKENS.input.text,
                        )}
                        value={v}
                        onChange={e => setValue(e.target.value || undefined)}
                        disabled={!active}
                      />
                    </React.Fragment>
                  )
                }

                const v = typeof cur === 'string' ? cur : typeof cur === 'number' ? String(cur) : ''
                return (
                  <React.Fragment key={rowKey}>
                    <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={id}>
                      {label}
                    </label>
                    <input
                      id={id}
                      className={cn(
                        'mt-1 w-full h-8 rounded-md',
                        keyValueInputClass,
                        textSizeClass,
                        'text-left',
                        UI_THEME_TOKENS.input.bg,
                        UI_THEME_TOKENS.input.border,
                        UI_THEME_TOKENS.input.text,
                      )}
                      value={v}
                      onChange={e => {
                        const raw = e.target.value
                        setValue(raw.trim() ? raw : undefined)
                      }}
                      disabled={!active}
                    />
                  </React.Fragment>
                )
              })}
            </section>
          )}

          {registryPorts.length > 0 && (
            <section className={cn('mt-3 rounded-lg border', UI_THEME_TOKENS.input.border)} aria-label="Registry ports">
              <ul className="list-none m-0 p-0">
                {registryPorts.map((p, idx) => {
                  const portKey = String(p.portKey || '').trim()
                  if (!portKey) return null
                  const isIn = p.direction === 'input'
                  const aria = `${isIn ? 'Input' : 'Output'} port: ${portKey}`
                  return (
                    <li key={`${p.direction}:${portKey}:${idx}`} className={cn('relative flex items-center gap-2 px-3 py-2 border-b last:border-b-0', UI_THEME_TOKENS.panel.border)}>
                      {isIn ? (
                        <button
                          type="button"
                          aria-label={aria}
                          title={aria}
                          className={cn('absolute top-1/2 left-0', UI_THEME_TOKENS.button.text)}
                          style={{ width: `${dotHitPx}px`, height: `${dotHitPx}px`, transform: 'translate(-50%, -50%)' }}
                          onPointerDown={e => {
                            try { e.stopPropagation() } catch { void 0 }
                          }}
                          onClick={e => {
                            try { e.stopPropagation() } catch { void 0 }
                            if (!active || !portHandlesEnabled) return
                            onSchemaPortHandleClick?.({ dir: 'in', portKey })
                          }}
                          disabled={!active || !portHandlesEnabled}
                        >
                          <span aria-hidden={true} className={cn('absolute top-1/2 left-1/2 rounded-full border', UI_THEME_TOKENS.panel.bg, PORT_HANDLE_STROKE_CLASS)} style={{ width: `${dotSizePx}px`, height: `${dotSizePx}px`, transform: 'translate(-50%, -50%)' }} />
                        </button>
                      ) : null}

                      <span className={cn('min-w-0 flex-1 truncate', UI_THEME_TOKENS.text.primary)}>{portKey}</span>
                      <span className={cn('shrink-0 text-xs', UI_THEME_TOKENS.text.secondary)}>{isIn ? 'in' : 'out'}</span>

                      {!isIn ? (
                        <button
                          type="button"
                          aria-label={aria}
                          title={aria}
                          className={cn('absolute top-1/2 right-0', UI_THEME_TOKENS.button.text)}
                          style={{ width: `${dotHitPx}px`, height: `${dotHitPx}px`, transform: 'translate(50%, -50%)' }}
                          onPointerDown={e => {
                            try { e.stopPropagation() } catch { void 0 }
                          }}
                          onClick={e => {
                            try { e.stopPropagation() } catch { void 0 }
                            if (!active || !portHandlesEnabled) return
                            onSchemaPortHandleClick?.({ dir: 'out', portKey })
                          }}
                          disabled={!active || !portHandlesEnabled}
                        >
                          <span aria-hidden={true} className={cn('absolute top-1/2 left-1/2 rounded-full border', UI_THEME_TOKENS.panel.bg, PORT_HANDLE_STROKE_CLASS)} style={{ width: `${dotSizePx}px`, height: `${dotSizePx}px`, transform: 'translate(-50%, -50%)' }} />
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </fieldset>
      )}

      {schemaFields.length > 0 && (
        <fieldset className="min-w-0 mt-4" aria-label={UI_LABELS.flowNodeQuickEditorSchemaLegend}>
          <legend className={cn(microLabelClass, 'font-medium', UI_THEME_TOKENS.text.secondary)}>
            {UI_LABELS.flowNodeQuickEditorSchemaLegend}
          </legend>

          <section className={cn('mt-2 rounded-lg border', UI_THEME_TOKENS.input.border)} aria-label={UI_LABELS.flowNodeQuickEditorSchemaFieldsLegend}>
            <ul className="list-none m-0 p-0">
              {schemaFields.map((f, idx) => {
                const portKey = buildSchemaFieldPortKey(f.id)
                const label = f.label || f.id
                const type = f.type || ''
                const inAria = `Input port: ${label}`
                const outAria = `Output port: ${label}`

                return (
                  <li
                    key={`${f.id}:${idx}`}
                    className={cn('relative flex items-center gap-2 px-3 py-2 border-b last:border-b-0', UI_THEME_TOKENS.panel.border)}
                  >
                    <button
                      type="button"
                      aria-label={inAria}
                      title={inAria}
                      className={cn('absolute top-1/2 left-0', UI_THEME_TOKENS.button.text)}
                      style={{ width: `${dotHitPx}px`, height: `${dotHitPx}px`, transform: 'translate(-50%, -50%)' }}
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
                        onSchemaPortHandleClick?.({ dir: 'in', portKey })
                      }}
                      disabled={!active || !portHandlesEnabled}
                    >
                      <span
                        aria-hidden={true}
                        className={cn('absolute top-1/2 left-1/2 rounded-full border', UI_THEME_TOKENS.panel.bg, PORT_HANDLE_STROKE_CLASS)}
                        style={{ width: `${dotSizePx}px`, height: `${dotSizePx}px`, transform: 'translate(-50%, -50%)' }}
                      />
                    </button>

                    <span className={cn('min-w-0 flex-1 truncate', UI_THEME_TOKENS.text.primary)}>{label}</span>
                    {type ? (
                      <span className={cn('shrink-0 text-xs', UI_THEME_TOKENS.text.secondary)}>{type}</span>
                    ) : null}

                    <button
                      type="button"
                      aria-label={outAria}
                      title={outAria}
                      className={cn('absolute top-1/2 right-0', UI_THEME_TOKENS.button.text)}
                      style={{ width: `${dotHitPx}px`, height: `${dotHitPx}px`, transform: 'translate(50%, -50%)' }}
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
                        onSchemaPortHandleClick?.({ dir: 'out', portKey })
                      }}
                      disabled={!active || !portHandlesEnabled}
                    >
                      <span
                        aria-hidden={true}
                        className={cn('absolute top-1/2 left-1/2 rounded-full border', UI_THEME_TOKENS.panel.bg, PORT_HANDLE_STROKE_CLASS)}
                        style={{ width: `${dotSizePx}px`, height: `${dotSizePx}px`, transform: 'translate(-50%, -50%)' }}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </fieldset>
      )}

      <menu
        className="mt-4 flex list-none items-center justify-end gap-2 p-0"
        aria-label={UI_LABELS.flowNodeQuickEditorActions}
      >
        <li>
          <button
            type="button"
            className={cn(
              'rounded-lg border px-3 py-2 font-semibold disabled:opacity-50',
              UI_THEME_TOKENS.panel.border,
              UI_THEME_TOKENS.button.activeBg,
              UI_THEME_TOKENS.button.activeText,
            )}
            onClick={onValidate}
            disabled={!active}
          >
            {UI_LABELS.flowNodeQuickEditorValidate}
          </button>
        </li>
      </menu>
    </form>
  )
})
