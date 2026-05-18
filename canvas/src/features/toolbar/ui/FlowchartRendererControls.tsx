import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export const normalizeCompactControlsBreakpointPx = (value: unknown): number => {
  const fallback = 768
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(360, Math.min(1440, Math.round(value)))
}

export function useCompactControls(enabled: boolean, breakpointPx: number): boolean {
  const [compact, setCompact] = React.useState(false)

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setCompact(false)
      return
    }
    const mediaQuery = window.matchMedia(`(max-width: ${Math.max(1, breakpointPx)}px)`)
    const apply = (matches: boolean) => setCompact(matches)
    apply(mediaQuery.matches)
    const onChange = (event: MediaQueryListEvent) => apply(event.matches)
    try {
      mediaQuery.addEventListener('change', onChange)
      return () => mediaQuery.removeEventListener('change', onChange)
    } catch {
      mediaQuery.addListener(onChange)
      return () => mediaQuery.removeListener(onChange)
    }
  }, [breakpointPx, enabled])

  return compact
}

export function ToggleRow(props: { label: string; value: boolean; onChange: (next: boolean) => void; compact?: boolean }) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const compact = props.compact === true
  return (
    <div className={`flex gap-2 ${compact ? 'flex-col' : 'flex-row items-center'}`}>
      <label
        className={`${compact ? 'w-full' : 'w-[50%]'} ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
      >
        {props.label}
      </label>
      <div className={`${compact ? 'w-full' : 'w-[50%]'} flex items-center gap-1 ${compact ? '' : 'justify-end'}`}>
        <button
          type="button"
          className={`App-toolbar__btn min-h-[44px] flex-1 text-xs border ${UI_THEME_TOKENS.input.border} ${!props.value ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`}`}
          onClick={() => props.onChange(false)}
        >
          Off
        </button>
        <button
          type="button"
          className={`App-toolbar__btn min-h-[44px] flex-1 text-xs border ${UI_THEME_TOKENS.input.border} ${props.value ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`}`}
          onClick={() => props.onChange(true)}
        >
          On
        </button>
      </div>
    </div>
  )
}

export function NumberRow(props: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (next: number) => void
  compact?: boolean
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const uiPanelKeyValueInputClass = useGraphStore(
    s => s.uiPanelKeyValueInputClass || `w-full h-6 px-2 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded text-right`,
  )
  const compact = props.compact === true
  return (
    <div className={`flex gap-2 ${compact ? 'flex-col' : 'flex-row items-center'}`}>
      <label
        className={`${compact ? 'w-full' : 'w-[50%]'} ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
      >
        {props.label}
      </label>
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={typeof props.step === 'number' ? props.step : 1}
        value={props.value}
        onChange={e => {
          const raw = Number.parseFloat(e.target.value)
          if (!Number.isFinite(raw)) return
          props.onChange(Math.max(props.min, Math.min(props.max, raw)))
        }}
        className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} ${compact ? 'w-full' : 'w-[50%]'} min-h-[44px] text-right`}
      />
    </div>
  )
}

export function SelectRow(props: {
  label: string
  value: string
  options: string[]
  optionLabels?: Record<string, string>
  onChange: (next: string) => void
  compact?: boolean
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const compact = props.compact === true
  return (
    <div className={`flex gap-2 ${compact ? 'flex-col' : 'flex-row items-center'}`}>
      <label
        className={`${compact ? 'w-full' : 'w-[50%]'} ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
      >
        {props.label}
      </label>
      <select
        className={`App-toolbar__btn min-h-[44px] text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} ${compact ? 'w-full' : 'w-[50%]'}`}
        value={props.value}
        onChange={e => props.onChange(String(e.target.value || ''))}
      >
        {props.options.map(o => (
          <option key={o} value={o}>
            {props.optionLabels?.[o] || o}
          </option>
        ))}
      </select>
    </div>
  )
}
