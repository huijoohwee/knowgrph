import React from 'react'

import type { GraphNode } from '@/lib/graph/types'
import {
  FLOW_EDITOR_ASPECT_RATIO_OPTIONS,
  FLOW_EDITOR_DURATION_SECONDS_OPTIONS,
  FLOW_EDITOR_RESOLUTION_OPTIONS,
  FLOW_EDITOR_SMART_NODE_MODEL_OPTIONS,
  type FlowEditorSmartNodeProperties,
} from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'

type ZoomState = { k: number; x: number; y: number }

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function pickBool(v: unknown): boolean {
  return typeof v === 'boolean' ? v : false
}

function pickNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export default function NodeOverlayEditor({
  active,
  node,
  zoomState,
  viewportW,
  viewportH,
  onSetLabel,
  onSetType,
  onPatchProperties,
  onValidate,
}: {
  active: boolean
  node: GraphNode
  zoomState: ZoomState | null
  viewportW: number
  viewportH: number
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Partial<FlowEditorSmartNodeProperties>) => void
  onValidate: () => void
}) {
  const { panelTextClass, microLabelClass, monospaceTextClass, textSizeClass, keyValueInputClass } = usePanelTypography()
  const properties = (node.properties || {}) as Record<string, unknown>
  const k = zoomState && Number.isFinite(zoomState.k) ? Math.max(0.001, zoomState.k) : 1
  const tx = zoomState && Number.isFinite(zoomState.x) ? zoomState.x : 0
  const ty = zoomState && Number.isFinite(zoomState.y) ? zoomState.y : 0
  const screenX = Number.isFinite(node.x) ? node.x * k + tx : 0
  const screenY = Number.isFinite(node.y) ? node.y * k + ty : 0

  const overlayW = 360
  const overlayH = 520
  const left = clamp(screenX + 16, 8, Math.max(8, viewportW - overlayW - 8))
  const top = clamp(screenY - 12, 8, Math.max(8, viewportH - overlayH - 8))

  const model = pickString(properties.model)
  const prompt = pickString(properties.prompt)
  const aspectRatio = pickString(properties.aspect_ratio)
  const duration = pickNumber(properties.duration)
  const resolution = pickString(properties.resolution)
  const generateAudio = pickBool(properties.generate_audio)
  const fast = pickBool(properties.fast)
  const referenceImage = pickString(properties.reference_image)

  return (
    <aside
      aria-label="Node quick editor"
      className="absolute z-[240]"
      style={{ left, top, width: overlayW }}
    >
      <article
        className={cn(
          'rounded-xl border shadow-lg',
          UI_THEME_TOKENS.panel.bg,
          UI_THEME_TOKENS.input.border,
          UI_THEME_TOKENS.text.primary,
          panelTextClass,
        )}
      >
        <header className="px-3 py-2 border-b border-[color:var(--kg-border)]">
          <h3 className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>{String(node.label || node.id)}</h3>
          <p className={cn('mt-0.5', microLabelClass, UI_THEME_TOKENS.text.secondary)}>{String(node.id || '')}</p>
        </header>

        <form className={cn('p-3', panelTextClass)} aria-label="Quick edit form" onSubmit={e => e.preventDefault()}>
          <fieldset className="min-w-0">
            <legend className={cn(microLabelClass, 'font-medium', UI_THEME_TOKENS.text.secondary)}>Node</legend>

            <label className={cn('mt-2 block', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-label">
              Label
            </label>
            <input
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

            <label className={cn('mt-2 block', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-type">
              Type
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

          <fieldset className="min-w-0 mt-4">
            <legend className={cn(microLabelClass, 'font-medium', UI_THEME_TOKENS.text.secondary)}>Smart fields</legend>

            <label className={cn('mt-2 block', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-model">
              Model
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
              onChange={e => onPatchProperties({ model: (e.target.value || undefined) as FlowEditorSmartNodeProperties['model'] })}
              disabled={!active}
            >
              <option value="">Search or select…</option>
              {FLOW_EDITOR_SMART_NODE_MODEL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <label className={cn('mt-2 block', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-prompt">
              Prompt
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

            <label className={cn('mt-2 block', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-aspect">
              Aspect ratio
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
                onPatchProperties({ aspect_ratio: (e.target.value || undefined) as FlowEditorSmartNodeProperties['aspect_ratio'] })
              }
              disabled={!active}
            >
              <option value="">Search or select…</option>
              {FLOW_EDITOR_ASPECT_RATIO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <label className={cn('mt-2 block', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-duration">
              Duration
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
              <option value="">Search or select…</option>
              {FLOW_EDITOR_DURATION_SECONDS_OPTIONS.map(o => (
                <option key={o.value} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>

            <label className={cn('mt-2 block', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-resolution">
              Resolution
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
              <option value="">Search or select…</option>
              {FLOW_EDITOR_RESOLUTION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <label className={cn('mt-3 flex items-center gap-2', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-audio">
              <input
                id="flow-node-quick-audio"
                type="checkbox"
                checked={generateAudio}
                onChange={e => onPatchProperties({ generate_audio: e.target.checked })}
                disabled={!active}
              />
              Generate audio
            </label>

            <label className={cn('mt-2 flex items-center gap-2', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-fast">
              <input
                id="flow-node-quick-fast"
                type="checkbox"
                checked={fast}
                onChange={e => onPatchProperties({ fast: e.target.checked })}
                disabled={!active}
              />
              Fast
            </label>

            <label className={cn('mt-2 block', microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-node-quick-ref">
              Reference image
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
              placeholder="Enter URL to desired file"
              disabled={!active}
            />
          </fieldset>

          <menu className="mt-4 flex items-center justify-end gap-2" aria-label="Quick edit actions">
            <button
              type="button"
              className={`rounded-lg bg-teal-500 px-3 py-2 font-semibold text-white hover:bg-teal-400 disabled:opacity-50`}
              onClick={onValidate}
              disabled={!active}
            >
              Validate
            </button>
          </menu>
        </form>
      </article>
    </aside>
  )
}
