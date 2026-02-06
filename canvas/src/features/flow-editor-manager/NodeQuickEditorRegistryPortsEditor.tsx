import React from 'react'

import { X } from 'lucide-react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { getIconSizeClass } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useGraphStore } from '@/hooks/useGraphStore'

import type { NodeQuickEditorRegistryPort } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'

export default function NodeQuickEditorRegistryPortsEditor({
  ports,
  onChange,
}: {
  ports: NodeQuickEditorRegistryPort[]
  onChange: (next: NodeQuickEditorRegistryPort[]) => void
}) {
  const panelTypography = usePanelTypography()
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <section aria-label="Ports" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className={cn('text-xs font-semibold uppercase tracking-wider', UI_THEME_TOKENS.text.secondary)}>Ports</h4>
        <button
          type="button"
          className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          onClick={() => onChange([...(ports || []), { direction: 'input', portKey: '', schemaPath: '' }])}
        >
          {UI_LABELS.add} port
        </button>
      </div>

      <div className="space-y-2">
        {(ports || []).map((p, idx) => (
          <div key={`${idx}:${p.direction}:${p.portKey}`} className={cn('rounded border p-2', UI_THEME_TOKENS.panel.border)}>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Direction</label>
                <select
                  value={p.direction}
                  onChange={e => onChange(ports.map((x, i) => (i === idx ? { ...x, direction: e.target.value === 'output' ? 'output' : 'input' } : x)))}
                  className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                >
                  <option value="input">input</option>
                  <option value="output">output</option>
                </select>
              </div>
              <div>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Port key</label>
                <input
                  value={p.portKey}
                  onChange={e => onChange(ports.map((x, i) => (i === idx ? { ...x, portKey: e.target.value } : x)))}
                  className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text, panelTypography.monospaceTextClass)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Schema path (optional)</label>
                <input
                  value={p.schemaPath || ''}
                  onChange={e => onChange(ports.map((x, i) => (i === idx ? { ...x, schemaPath: e.target.value } : x)))}
                  className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text, panelTypography.monospaceTextClass)}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                onClick={() => onChange(ports.filter((_, i) => i !== idx))}
                aria-label="Remove port"
              >
                <X className={iconSizeClass} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        {(ports || []).length === 0 && (
          <div className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.tertiary)}>No ports.</div>
        )}
      </div>
    </section>
  )
}

