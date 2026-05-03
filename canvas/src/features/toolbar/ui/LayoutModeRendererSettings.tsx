import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import {
  FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO,
  FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MAX,
  FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MIN,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_DESKTOP,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_LAPTOP,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MAX,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MIN,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_PHONE,
  FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_TABLET,
} from '@/components/FlowCanvas/frontmatterLayoutConfig'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { readLayoutMode2d, type LayoutMode2d } from '@/lib/graph/layoutMode'

const LAYOUT_MODE_OPTIONS: Array<{ value: LayoutMode2d; label: string }> = [
  { value: 'radial', label: 'Radial (default)' },
  { value: 'block', label: 'Block' },
]

export function LayoutModeRendererSettings(props: {
  selectedLayoutMode?: LayoutMode2d
  onSelectLayoutMode?: (next: LayoutMode2d) => void
  disabled?: boolean
}) {
  const onSelectLayoutModeProp = props.onSelectLayoutMode
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled === true)
  const frontmatterFlowInitialFitFillRatio = useGraphStore(s => s.frontmatterFlowInitialFitFillRatio)
  const setFrontmatterFlowInitialFitFillRatio = useGraphStore(s => s.setFrontmatterFlowInitialFitFillRatio)
  const frontmatterFlowOverlayFitProxyScalePhone = useGraphStore(s => s.frontmatterFlowOverlayFitProxyScalePhone)
  const setFrontmatterFlowOverlayFitProxyScalePhone = useGraphStore(s => s.setFrontmatterFlowOverlayFitProxyScalePhone)
  const frontmatterFlowOverlayFitProxyScaleTablet = useGraphStore(s => s.frontmatterFlowOverlayFitProxyScaleTablet)
  const setFrontmatterFlowOverlayFitProxyScaleTablet = useGraphStore(s => s.setFrontmatterFlowOverlayFitProxyScaleTablet)
  const frontmatterFlowOverlayFitProxyScaleLaptop = useGraphStore(s => s.frontmatterFlowOverlayFitProxyScaleLaptop)
  const setFrontmatterFlowOverlayFitProxyScaleLaptop = useGraphStore(s => s.setFrontmatterFlowOverlayFitProxyScaleLaptop)
  const frontmatterFlowOverlayFitProxyScaleDesktop = useGraphStore(s => s.frontmatterFlowOverlayFitProxyScaleDesktop)
  const setFrontmatterFlowOverlayFitProxyScaleDesktop = useGraphStore(s => s.setFrontmatterFlowOverlayFitProxyScaleDesktop)
  const layoutMode = readLayoutMode2d(schema)
  const selectedLayoutMode = props.selectedLayoutMode ?? layoutMode
  const disabled = props.disabled === true
  const showFrontmatterFlowControls = canvas2dRenderer === 'flowEditor' || frontmatterModeEnabled
  const frontmatterProxyFields = React.useMemo(() => ([
    {
      key: 'phone',
      label: 'Phone proxy',
      hint: '<=430px',
      value: frontmatterFlowOverlayFitProxyScalePhone,
      setValue: setFrontmatterFlowOverlayFitProxyScalePhone,
      defaultValue: FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_PHONE,
    },
    {
      key: 'tablet',
      label: 'Tablet proxy',
      hint: '<=768px',
      value: frontmatterFlowOverlayFitProxyScaleTablet,
      setValue: setFrontmatterFlowOverlayFitProxyScaleTablet,
      defaultValue: FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_TABLET,
    },
    {
      key: 'laptop',
      label: 'Laptop proxy',
      hint: '<=1280px',
      value: frontmatterFlowOverlayFitProxyScaleLaptop,
      setValue: setFrontmatterFlowOverlayFitProxyScaleLaptop,
      defaultValue: FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_LAPTOP,
    },
    {
      key: 'desktop',
      label: 'Desktop proxy',
      hint: '>1280px',
      value: frontmatterFlowOverlayFitProxyScaleDesktop,
      setValue: setFrontmatterFlowOverlayFitProxyScaleDesktop,
      defaultValue: FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_DESKTOP,
    },
  ]), [
    frontmatterFlowOverlayFitProxyScaleDesktop,
    frontmatterFlowOverlayFitProxyScaleLaptop,
    frontmatterFlowOverlayFitProxyScalePhone,
    frontmatterFlowOverlayFitProxyScaleTablet,
    setFrontmatterFlowOverlayFitProxyScaleDesktop,
    setFrontmatterFlowOverlayFitProxyScaleLaptop,
    setFrontmatterFlowOverlayFitProxyScalePhone,
    setFrontmatterFlowOverlayFitProxyScaleTablet,
  ])

  const setLayoutMode = React.useCallback((next: LayoutMode2d) => {
    const current = useGraphStore.getState().schema as GraphSchema
    const layout = current.layout || {}
    setSchema({
      ...current,
      layout: {
        ...layout,
        mode: next,
      },
    })
  }, [setSchema])

  const onSelectLayoutMode = React.useCallback((next: LayoutMode2d) => {
    if (onSelectLayoutModeProp) {
      onSelectLayoutModeProp(next)
      return
    }
    setLayoutMode(next)
  }, [onSelectLayoutModeProp, setLayoutMode])

  return (
    <CollapsibleSection title="Layout" defaultCollapsed={false} stickyHeader={false} headerClassName={`px-2 ${uiPanelTextFontClass}`}>
      <div className="px-3 py-2 space-y-2">
        <div className={`text-[10px] ${UI_THEME_TOKENS.text.secondary} leading-snug`}>
          Global layout mode shared across 2D/3D renderers and semantic views.
        </div>
        <div className="flex items-center gap-2">
          <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
            Mode
          </label>
          <select
            className={`w-[50%] h-6 px-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded`}
            value={selectedLayoutMode}
            disabled={disabled}
            onChange={e => onSelectLayoutMode((String(e.target.value || '').trim().toLowerCase() === 'block' ? 'block' : 'radial'))}
          >
            {LAYOUT_MODE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {showFrontmatterFlowControls ? (
          <div className="pt-2 border-t border-[color:var(--kg-border)] space-y-2">
            <div className={`text-[10px] ${UI_THEME_TOKENS.text.secondary} leading-snug`}>
              Frontmatter Flow Editor fit controls. Lower proxy values fit a denser overlay footprint and make the on-screen collective larger.
            </div>
            <div className="flex items-center gap-2">
              <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
                Initial fit fill
              </label>
              <input
                type="number"
                step={0.01}
                min={FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MIN}
                max={FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MAX}
                value={frontmatterFlowInitialFitFillRatio}
                disabled={disabled}
                onChange={e => {
                  const next = Number.parseFloat(e.target.value)
                  if (Number.isFinite(next)) setFrontmatterFlowInitialFitFillRatio(next)
                }}
                className={`w-[50%] h-6 px-2 text-right ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded`}
              />
            </div>
            {frontmatterProxyFields.map(field => (
              <div key={field.key} className="flex items-center gap-2">
                <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
                  {field.label}
                </label>
                <div className="w-[50%] flex items-center gap-2">
                  <input
                    type="number"
                    step={0.01}
                    min={FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MIN}
                    max={FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_MAX}
                    value={field.value}
                    disabled={disabled}
                    onChange={e => {
                      const next = Number.parseFloat(e.target.value)
                      if (Number.isFinite(next)) field.setValue(next)
                    }}
                    className={`flex-1 h-6 px-2 text-right ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded`}
                  />
                  <span className={`min-w-12 text-right text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>
                    {field.hint}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>
                Adaptive frontmatter defaults
              </span>
              <button
                type="button"
                className={`App-toolbar__btn text-[11px] px-2 py-1 rounded ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
                disabled={disabled}
                onClick={() => {
                  setFrontmatterFlowInitialFitFillRatio(FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO)
                  setFrontmatterFlowOverlayFitProxyScalePhone(FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_PHONE)
                  setFrontmatterFlowOverlayFitProxyScaleTablet(FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_TABLET)
                  setFrontmatterFlowOverlayFitProxyScaleLaptop(FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_LAPTOP)
                  setFrontmatterFlowOverlayFitProxyScaleDesktop(FLOW_FRONTMATTER_OVERLAY_FIT_PROXY_SCALE_DESKTOP)
                }}
              >
                Reset frontmatter
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </CollapsibleSection>
  )
}
