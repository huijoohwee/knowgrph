import React from 'react'

import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { NodeOverlayEditorKvTable, NodeOverlayEditorTypePill } from '@/components/FlowEditor/NodeOverlayEditorKvTable'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'

function safeStableJson(v: unknown): string {
  if (v == null) return ''
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

export const NodeOverlayEditorParamsSection = React.memo(function NodeOverlayEditorParamsSection({
  active,
  properties,
  microLabelClass,
  monospaceTextClass,
  textSizeClass,
  keyValueInputClass,
  keyLabelClass,
  ids,
  dotSizePx,
  dotHitPx,
  onPatchProperties,
}: {
  active: boolean
  properties: Record<string, unknown>
  microLabelClass: string
  monospaceTextClass: string
  textSizeClass: string
  keyValueInputClass: string
  keyLabelClass: string
  ids: { paramsJson: string; paramsJsonInput: string }
  dotSizePx: number
  dotHitPx: number
  onPatchProperties: (patch: Record<string, unknown>) => void
}) {
  const params = properties.params
  const baseText = React.useMemo(() => safeStableJson(params), [params])
  const [draft, setDraft] = React.useState(baseText)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    setDraft(baseText)
    setError('')
  }, [baseText])

  if (params == null) return null

  const apply = () => {
    const raw = String(draft || '')
    if (!raw.trim()) {
      onPatchProperties({ params: undefined })
      setError('')
      return
    }
    try {
      const next = JSON.parse(raw) as unknown
      onPatchProperties({ params: next })
      setError('')
    } catch {
      setError(UI_COPY.flowNodeQuickEditorParamsInvalidJson)
    }
  }

  return (
    <section className="min-w-0 mt-4" aria-label={UI_LABELS.flowNodeQuickEditorParamsLegend}>
      <NodeOverlayEditorKvTable
        ariaLabel={UI_LABELS.flowNodeQuickEditorParamsLegend}
        microLabelClass={microLabelClass}
        dotSizePx={dotSizePx}
        dotHitPx={dotHitPx}
        forcePortDots={false}
        rows={[
          {
            rowKey: 'params-json',
            labelId: ids.paramsJson,
            keyNode: (
              <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.paramsJsonInput}>
                {UI_LABELS.flowNodeQuickEditorParamsJsonLabel}
              </label>
            ),
            typeNode: <NodeOverlayEditorTypePill text="json" />,
            valueNode: (
              <section className="w-full">
                <PlainTextInputEditor
                  id={ids.paramsJsonInput}
                  className={cn(
                    keyValueInputClass,
                    textSizeClass,
                    monospaceTextClass,
                    'min-h-[140px] w-full resize-y text-left',
                    UI_THEME_TOKENS.input.bg,
                    UI_THEME_TOKENS.input.border,
                    UI_THEME_TOKENS.input.text,
                  )}
                  multiline
                  value={draft}
                  onChange={setDraft}
                  placeholder={UI_COPY.flowNodeQuickEditorParamsPlaceholder}
                  disabled={!active}
                  spellCheck={false}
                />
                <section className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className={cn('shrink-0 rounded border px-2 py-1', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.button.text)}
                    onClick={apply}
                    disabled={!active}
                    aria-label={UI_LABELS.apply}
                    title={UI_LABELS.apply}
                  >
                    {UI_LABELS.apply}
                  </button>
                  {error ? <p className={cn('min-w-0 truncate text-xs', UI_THEME_TOKENS.status.error)}>{error}</p> : <span />}
                </section>
              </section>
            ),
          },
        ]}
      />
    </section>
  )
})
