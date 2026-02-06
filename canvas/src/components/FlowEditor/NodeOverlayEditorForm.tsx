import React from 'react'

import type { GraphNode } from '@/lib/graph/types'
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

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function pickBool(v: unknown): boolean {
  return typeof v === 'boolean' ? v : false
}

function pickNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export const NodeOverlayEditorForm = React.memo(function NodeOverlayEditorForm({
  active,
  node,
  hideFields,
  labelInputRef,
  onSetLabel,
  onSetType,
  onPatchProperties,
  onValidate,
}: {
  active: boolean
  node: GraphNode
  hideFields: boolean
  labelInputRef: React.RefObject<HTMLInputElement>
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Partial<FlowEditorSmartNodeProperties>) => void
  onValidate: () => void
}) {
  const { panelTextClass, microLabelClass, monospaceTextClass, textSizeClass, keyValueInputClass, keyLabelClass } = usePanelTypography()
  const properties = (node.properties || {}) as Record<string, unknown>

  const model = pickString(properties.model)
  const prompt = pickString(properties.prompt)
  const aspectRatio = pickString(properties.aspect_ratio)
  const duration = pickNumber(properties.duration)
  const resolution = pickString(properties.resolution)
  const generateAudio = pickBool(properties.generate_audio)
  const fast = pickBool(properties.fast)
  const referenceImage = pickString(properties.reference_image)

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

        <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-label">
          {UI_LABELS.name}
        </label>
        <input
          ref={labelInputRef}
          id="flow-node-quick-label"
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

        <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-type">
          {UI_LABELS.type}
        </label>
        <input
          id="flow-node-quick-type"
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

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-model">
            {UI_LABELS.flowNodeQuickEditorModel}
          </label>
          <select
            id="flow-node-quick-model"
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

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-prompt">
            {UI_LABELS.flowNodeQuickEditorPrompt}
          </label>
          <textarea
            id="flow-node-quick-prompt"
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

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-aspect">
            {UI_LABELS.flowNodeQuickEditorAspectRatio}
          </label>
          <select
            id="flow-node-quick-aspect"
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

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-duration">
            {UI_LABELS.flowNodeQuickEditorDuration}
          </label>
          <select
            id="flow-node-quick-duration"
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

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-resolution">
            {UI_LABELS.flowNodeQuickEditorResolution}
          </label>
          <select
            id="flow-node-quick-resolution"
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

          <label className={cn('mt-3 flex items-center gap-2', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-audio">
            <input
              id="flow-node-quick-audio"
              type="checkbox"
              checked={generateAudio}
              onChange={e => onPatchProperties({ generate_audio: e.target.checked })}
              disabled={!active}
            />
            {UI_LABELS.flowNodeQuickEditorGenerateAudio}
          </label>

          <label className={cn('mt-2 flex items-center gap-2', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-fast">
            <input
              id="flow-node-quick-fast"
              type="checkbox"
              checked={fast}
              onChange={e => onPatchProperties({ fast: e.target.checked })}
              disabled={!active}
            />
            {UI_LABELS.flowNodeQuickEditorFast}
          </label>

          <label className={cn('mt-2 block', keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-ref">
            {UI_LABELS.flowNodeQuickEditorReferenceImage}
          </label>
          <input
            id="flow-node-quick-ref"
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
