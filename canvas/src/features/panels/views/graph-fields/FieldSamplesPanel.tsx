import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import type { GraphField, GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { computeFieldValueFrequencies } from '@/features/panels/views/graph-fields/fieldSamples'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type FieldSamplesPanelProps = {
  graphData: GraphData | null
  selectedField: GraphField | null
  selectedSettings?: GraphFieldSettingsResolved | null
  onApplyAsSelectOptions?: (values: ReadonlyArray<string>) => void
  onStatusChange?: (msg: string) => void
}

export default function FieldSamplesPanel({
  graphData,
  selectedField,
  selectedSettings,
  onApplyAsSelectOptions,
  onStatusChange,
}: FieldSamplesPanelProps) {
  const samples = React.useMemo(
    () => computeFieldValueFrequencies(graphData, selectedField),
    [graphData, selectedField],
  )
  const totalSampleCount = React.useMemo(
    () => samples.reduce((acc, s) => acc + s.count, 0),
    [samples],
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  const displayedSamples = samples
  const [selectedByValue, setSelectedByValue] = React.useState<Set<string>>(
    () => new Set(),
  )

  React.useEffect(() => {
    setSelectedByValue(new Set())
  }, [selectedField?.id])

  const selectedValues = React.useMemo(() => {
    const next: string[] = []
    for (const s of displayedSamples) {
      if (selectedByValue.has(s.value)) next.push(s.value)
    }
    return next
  }, [displayedSamples, selectedByValue])
  const selectedCount = selectedValues.length

  const canApplySelectOptions =
    !!onApplyAsSelectOptions &&
    !!selectedSettings &&
    (selectedSettings.fieldType === 'Multi-select' || selectedSettings.fieldType === 'Single-select')

  const lastSingleSelectValueRef = React.useRef<string | null>(null)

  const displayedAllSelected = React.useMemo(() => {
    if (displayedSamples.length === 0) return false
    for (const s of displayedSamples) {
      if (!selectedByValue.has(s.value)) return false
    }
    return true
  }, [displayedSamples, selectedByValue])

  const displayedSomeSelected = React.useMemo(() => {
    if (displayedSamples.length === 0) return false
    for (const s of displayedSamples) {
      if (selectedByValue.has(s.value)) return true
    }
    return false
  }, [displayedSamples, selectedByValue])

  const selectAllRef = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate = displayedSomeSelected && !displayedAllSelected
  }, [displayedAllSelected, displayedSomeSelected])

  React.useEffect(() => {
    const value = lastSingleSelectValueRef.current
    if (!value) return
    if (!canApplySelectOptions) return
    if (!selectedValues.includes(value)) return
    onApplyAsSelectOptions?.([value])
    lastSingleSelectValueRef.current = null
  }, [canApplySelectOptions, onApplyAsSelectOptions, selectedValues])

  const onToggleValue = React.useCallback((value: string) => {
    const willSelect = !selectedByValue.has(value)
    lastSingleSelectValueRef.current = willSelect ? value : null
    setSelectedByValue(prev => {
      const next = new Set(prev)
      if (willSelect) next.add(value)
      else next.delete(value)
      return next
    })
  }, [selectedByValue])

  const onSelectAllDisplayed = React.useCallback(() => {
    if (canApplySelectOptions) {
      onApplyAsSelectOptions?.(displayedSamples.map(s => s.value))
    }
    setSelectedByValue(prev => {
      const next = new Set(prev)
      for (const s of displayedSamples) next.add(s.value)
      return next
    })
  }, [canApplySelectOptions, displayedSamples, onApplyAsSelectOptions])

  const onClearDisplayed = React.useCallback(() => {
    setSelectedByValue(prev => {
      if (displayedSamples.length === 0) return prev
      const next = new Set(prev)
      for (const s of displayedSamples) next.delete(s.value)
      return next
    })
  }, [displayedSamples])

  const onClearSelection = React.useCallback(() => setSelectedByValue(new Set()), [])

  const onCopySelected = React.useCallback(async () => {
    if (selectedCount === 0) return
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      onStatusChange?.(UI_COPY.graphFieldsClipboardNotAvailable)
      return
    }
    try {
      const text = selectedValues.join('\n')
      await navigator.clipboard.writeText(text)
      onStatusChange?.(UI_COPY.graphFieldsSamplesCopiedStatus(selectedCount))
    } catch {
      onStatusChange?.(UI_COPY.graphFieldsCopyFailed)
    }
  }, [onStatusChange, selectedCount, selectedValues])

  return (
    <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} overflow-hidden flex flex-col min-h-0 min-w-0`}>
      <div className={`h-9 border-b ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} px-2 ${UI_THEME_TOKENS.text.primary} flex items-center justify-between gap-2`}>
        <div className={uiPanelKeyValueTextSizeClass}>{UI_LABELS.samples}</div>
        <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} whitespace-nowrap max-w-[65%] truncate text-right`}>
          {selectedField
            ? `${selectedField.scope === 'node' ? 'Node' : 'Edge'} · ${selectedField.key}${
                typeof selectedField.samples === 'number'
                  ? ` · ${selectedField.samples.toLocaleString()} samples`
                  : ''
              }`
            : '—'}
        </div>
      </div>
      <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2 ${UI_THEME_TOKENS.panel.bg}`}>
        {!selectedField ? (
          <div className={`px-3 py-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{UI_COPY.graphFieldsSelectFieldToViewSamples}</div>
        ) : samples.length === 0 ? (
          <div className={`px-3 py-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{UI_COPY.graphFieldsNoSamplesFound}</div>
        ) : (
          <div className="px-3 space-y-1">
            <div className="flex items-center justify-between mb-1 gap-2">
              <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                {samples.length.toLocaleString()} values · {totalSampleCount.toLocaleString()} occurrences
                {selectedCount > 0 ? ` · ${selectedCount.toLocaleString()} selected` : ''}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <label className={`flex items-center gap-1 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={displayedAllSelected}
                    onChange={e => {
                      if (e.target.checked) onSelectAllDisplayed()
                      else onClearDisplayed()
                    }}
                    className={`h-3 w-3 rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`}
                  />
                  <span>{UI_LABELS.selectAll}</span>
                </label>
                <button
                  type="button"
                  className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}
                  onClick={onCopySelected}
                  disabled={selectedCount === 0}
                >
                  {UI_LABELS.copy}
                </button>
                <button
                  type="button"
                  className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg}`}
                  onClick={onClearSelection}
                  disabled={selectedCount === 0}
                >
                  {UI_LABELS.clear}
                </button>
              </div>
            </div>
            {displayedSamples.map(sample => {
              const selected = selectedByValue.has(sample.value)
              return (
                <button
                  key={sample.value}
                  type="button"
                  className={`w-full flex items-center justify-between gap-2 rounded px-1 py-1 text-left ${selected ? UI_THEME_TOKENS.table.rowSelected : UI_THEME_TOKENS.table.rowHoverHighlight}`}
                  onClick={() => onToggleValue(sample.value)}
                >
                  <span className="min-w-0 flex-1 inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      tabIndex={-1}
                      className={`h-4 w-4 rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`}
                    />
                    <span className={`min-w-0 flex-1 ${uiPanelKeyValueTextSizeClass} ${selected ? 'text-blue-900 dark:text-blue-100' : UI_THEME_TOKENS.text.primary} truncate`}>
                      {sample.value}
                    </span>
                  </span>
                  <span className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} shrink-0`}>×{sample.count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
