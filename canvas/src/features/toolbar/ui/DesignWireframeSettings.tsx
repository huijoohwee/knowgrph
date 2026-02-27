import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useDesignWireframeSettings } from '@/features/toolbar/hooks/useDesignWireframeSettings'

function ToggleRow(props: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  return (
    <div className="flex items-center gap-2">
      <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
        {props.label}
      </label>
      <div className="w-[50%] flex items-center gap-1 justify-end">
        <button
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${!props.value ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`}`}
          onClick={() => props.onChange(false)}
        >
          Off
        </button>
        <button
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${props.value ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`}`}
          onClick={() => props.onChange(true)}
        >
          On
        </button>
      </div>
    </div>
  )
}

function NumberRow(props: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (next: number) => void
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const uiPanelKeyValueInputClass = useGraphStore(
    s => s.uiPanelKeyValueInputClass || `w-full h-6 px-2 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded text-right`,
  )
  return (
    <div className="flex items-center gap-2">
      <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
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
        className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[50%] text-right`}
      />
    </div>
  )
}

export function DesignWireframeSettings() {
  const { settings, setSettings, resetSettings } = useDesignWireframeSettings()
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')

  return (
    <CollapsibleSection title="Design wireframe" defaultCollapsed={false} stickyHeader={false} headerClassName={`px-2 ${uiPanelTextFontClass}`}>
      <div className="px-3 py-2 space-y-2">
        <div className={`text-[10px] ${UI_THEME_TOKENS.text.secondary} leading-snug`}>
          Controls for webpage source-url wireframes (layout fidelity, grouping cues, label readability).
        </div>
        <ToggleRow label="Show edges" value={settings.showEdges} onChange={v => setSettings({ showEdges: v })} />
        <ToggleRow label="Show labels" value={settings.showLabelChips} onChange={v => setSettings({ showLabelChips: v })} />
        <ToggleRow label="Show label meta" value={settings.showMetaChips} onChange={v => setSettings({ showMetaChips: v })} />
        <ToggleRow label="Avoid label collisions" value={settings.avoidLabelCollisions} onChange={v => setSettings({ avoidLabelCollisions: v })} />
        <ToggleRow label="Show text preview" value={settings.showTextPreview} onChange={v => setSettings({ showTextPreview: v })} />
        <ToggleRow label="Show media preview" value={settings.showMediaPreview} onChange={v => setSettings({ showMediaPreview: v })} />
        <ToggleRow label="Depth fade" value={settings.depthFade} onChange={v => setSettings({ depthFade: v })} />
        <NumberRow label="Max edges" value={settings.maxEdges} min={0} max={5000} onChange={v => setSettings({ maxEdges: v })} />
        <NumberRow label="Max label chars" value={settings.maxLabelChars} min={8} max={140} onChange={v => setSettings({ maxLabelChars: v })} />
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass}`}
            onClick={resetSettings}
          >
            Reset
          </button>
        </div>
      </div>
    </CollapsibleSection>
  )
}

