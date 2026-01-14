import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import {
  uiDangerButtonClassName,
  uiToolbarToggleActiveClassName,
  UI_COLOR_DANGER_RED_BORDER,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useSettingsView } from './useSettingsView'
import { useGraphStore } from '@/hooks/useGraphStore'

export default function SettingsView({
  searchQuery,
  onRegisterActions,
}: {
  searchQuery: string
  onRegisterActions?: (a: {
    apply: () => void
    reset: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }) => void
}) {
  const {
    expanded,
    setExpanded,
    chatHealthStatus,
    isCheckingHealth,
    checkChatHealth,
    onGlobalReset,
    renderInput,
    collapsedByArea,
    groupByArea,
    toggleArea,
    setUiPanelKeyValueTextSizeClass,
    setUiPanelTextFontClass,
    setUiPanelKeyValueInputClass,
    setUiPanelRowDensityDefaultClass,
    setUiPanelMonospaceTextClass,
    setUiPanelMicroLabelTextSizeClass,
    uiPanelKeyValueTextSizeClass,
  } = useSettingsView({ searchQuery, onRegisterActions })

  const themeMode = useGraphStore(s => s.themeMode)
  const setThemeMode = useGraphStore(s => s.setThemeMode)

  return (
    <article className="h-full min-h-0 flex flex-col space-y-0">
      <section className="flex-1 min-h-0 overflow-auto space-y-0">
        <header className={`sticky top-0 z-10 border-b ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}>
          <KeyTypeValueRow
            keyNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Key</span>}
            typeNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Type</span>}
            valueNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Value</span>}
            density="compact"
            className="h-9 py-0"
          />
        </header>
        {groupByArea.map(([area, entries]) => {
          const collapsed = collapsedByArea[area] ?? true
          const responsibilities = entries.map(e => e.details.responsibility).filter(Boolean)
          const firstResponsibility = responsibilities[0]
          let tooltipContent = firstResponsibility
            ? `Settings area for ${firstResponsibility.toLowerCase()} keys. Expand to see modules, functions, and notes.`
            : 'Settings area grouping related keys. Expand to see modules, functions, and notes.'
          if (area === 'UI Density: Icons') {
            tooltipContent = `${tooltipContent} Use uiIconScale to switch between compact and default icon sizes across toolbars and panels.`
          }
          return (
            <CollapsibleSection
              key={area}
              title={(
                <Tooltip
                  content={tooltipContent}
                  maxWidthPx={250}
                  contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                >
                  <span className="inline-flex items-center gap-1">
                    <span>{area}</span>
                    <span className={`text-xs uppercase tracking-wide ${UI_THEME_TOKENS.text.tertiary} ml-1`}>
                      {entries.length}
                      {' '}
                      items
                    </span>
                  </span>
                </Tooltip>
              )}
              collapsed={collapsed}
              onToggle={next => toggleArea(area, next)}
            >
              <ul>
                {area === 'UI Appearance' && (
                  <li className={`mb-2 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                    <span className={`font-semibold ${UI_THEME_TOKENS.text.primary} mr-1`}>Theme Mode</span>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs h-6 px-2 border rounded ${
                        themeMode === 'light'
                          ? uiToolbarToggleActiveClassName
                          : `${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
                      }`}
                      onClick={() => setThemeMode('light')}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs h-6 px-2 border rounded ${
                        themeMode === 'dark'
                          ? uiToolbarToggleActiveClassName
                          : `${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
                      }`}
                      onClick={() => setThemeMode('dark')}
                    >
                      Dark
                    </button>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs h-6 px-2 border rounded ${
                        themeMode === 'system'
                          ? uiToolbarToggleActiveClassName
                          : `${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
                      }`}
                      onClick={() => setThemeMode('system')}
                    >
                      System
                    </button>
                  </li>
                )}
                {area === 'UI Density: Panels' && (
                  <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                    <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Presets</span>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                      onClick={() => {
                        setUiPanelKeyValueTextSizeClass('text-sm')
                        setUiPanelTextFontClass('font-sans')
                        setUiPanelKeyValueInputClass('w-full h-6 px-2 text-sm border border-gray-300 rounded text-right')
                        setUiPanelRowDensityDefaultClass('py-1')
                        setUiPanelMonospaceTextClass('font-mono text-xs')
                        setUiPanelMicroLabelTextSizeClass('text-xs')
                      }}
                    >
                      Comfortable
                    </button>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                      onClick={() => {
                        setUiPanelKeyValueTextSizeClass('text-xs')
                        setUiPanelTextFontClass('font-sans')
                        setUiPanelKeyValueInputClass('w-full h-6 px-2 text-xs border border-gray-300 rounded text-right')
                        setUiPanelRowDensityDefaultClass('py-0.5')
                        setUiPanelMonospaceTextClass('font-mono text-xs')
                        setUiPanelMicroLabelTextSizeClass('text-[9px]')
                      }}
                    >
                      Compact
                    </button>
                  </li>
                )}
                {entries.map(({ meta: s, details, writable, anchorId }) => {
                  const isExpanded = expanded === s.key
                  const hasOptions = Array.isArray(s.options) && s.options.length > 0
                  const hint = details.notes || details.responsibility || ''
                  return (
                    <li key={s.key}>
                      <KeyTypeValueRow
                        id={anchorId}
                        dataKgAnchor={anchorId}
                        keyNode={hasOptions && hint ? (
                          <Tooltip
                            content={hint}
                            maxWidthPx={250}
                            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <span className="truncate">{s.key}</span>
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="truncate">{s.key}</span>
                        )}
                        typeNode={s.type}
                        valueNode={(
                          <div className="flex-1">
                            {renderInput(s.key, s.type, writable, s.options)}
                            {s.key === 'chatSystemPrompt' && (
                              <div className="mt-2">
                                <button
                                  onClick={checkChatHealth}
                                  disabled={isCheckingHealth}
                                  className={`text-xs ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.button.text} px-2 py-1 rounded`}
                                >
                                  {isCheckingHealth ? 'Checking...' : 'Check Health'}
                                </button>
                                {chatHealthStatus && (
                                  <div className={`mt-1 text-xs ${UI_THEME_TOKENS.text.tertiary}`}>
                                    {chatHealthStatus}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        onClick={() => setExpanded(isExpanded ? null : s.key)}
                      />
                      {isExpanded && (
                        <div className={`mt-0 mb-0 text-xs ${UI_THEME_TOKENS.text.primary} border-l pl-2`}>
                          <table className={`w-full text-left border-collapse ${uiPanelKeyValueTextSizeClass || ''}`}>
                            <thead>
                              <tr>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Area</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Modules</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Classes/Objects</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Functions/Methods</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Responsibility</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Dependencies / Imports</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{details.area}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.modules || []).join(', ') || '—'}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.classes || []).join(', ') || '—'}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.functions || []).join(', ') || '—'}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{details.responsibility}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.imports || []).join(', ') || '—'}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{details.notes || '—'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CollapsibleSection>
          )
        })}
        <CollapsibleSection
          title="Resets and data"
          collapsed={false}
          onToggle={() => void 0}
          className={`mt-2 pt-2 border-t ${UI_COLOR_DANGER_RED_BORDER}`}
        >
          <div className={`space-y-1 text-xs ${UI_THEME_TOKENS.text.primary}`}>
            <div>
              Reset all settings to defaults and clear canvas data. This action cannot be undone.
            </div>
            <button
              type="button"
              className={uiDangerButtonClassName}
              onClick={onGlobalReset}
            >
              Global Reset
            </button>
          </div>
        </CollapsibleSection>
      </section>
    </article>
  )
}
