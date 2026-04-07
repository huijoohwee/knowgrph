import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import {
  uiDangerButtonClassName,
  uiToolbarToggleActiveClassName,
  UI_COLOR_DANGER_RED_BORDER,
} from '@/features/toolbar/ui/toolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  buildSettingsAreaTooltip,
  buildSettingsKeyTooltip,
  buildSettingsValueTooltip,
} from '@/lib/config'
import { useSettingsView } from './useSettingsView'
import { WorkspaceTableModeControl } from '@/features/workspace-table/ui/WorkspaceTableModeControl'
import { CHAT_DEFAULT_ENDPOINT_URL, CHAT_DEFAULT_MODEL } from '@/lib/chatEndpoint'

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
    uiPanelKeyValueTextSizeClass,
    setValues,
    dirtyRef,
  } = useSettingsView({ searchQuery, onRegisterActions })
  const applyUiPanelDensityPreset = React.useCallback(
    (preset: 'comfortable' | 'compact') => {
      const patches: Record<string, string> =
        preset === 'comfortable'
          ? {
              uiPanelKeyValueTextSizeClass: 'text-sm',
              uiPanelTextFontClass: 'font-sans',
              uiPanelKeyValueInputClass: 'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
              uiPanelRowDensityDefaultClass: 'py-1',
              uiPanelMonospaceTextClass: 'font-mono text-xs',
              uiPanelMicroLabelTextSizeClass: 'text-xs',
            }
          : {
              uiPanelKeyValueTextSizeClass: 'text-xs',
              uiPanelTextFontClass: 'font-sans',
              uiPanelKeyValueInputClass: 'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right',
              uiPanelRowDensityDefaultClass: 'py-0.5',
              uiPanelMonospaceTextClass: 'font-mono text-xs',
              uiPanelMicroLabelTextSizeClass: 'text-[9px]',
            }
      Object.keys(patches).forEach(key => dirtyRef.current.add(key))
      setValues(prev => ({ ...prev, ...patches }))
    },
    [dirtyRef, setValues],
  )

  const applyChatPreset = React.useCallback(
    (preset: 'primary' | 'secondary') => {
      const primaryEndpoint = CHAT_DEFAULT_ENDPOINT_URL
      const primaryModel = CHAT_DEFAULT_MODEL
      const secondaryEndpoint = primaryEndpoint
      const secondaryModel = primaryModel
      const patch: Record<string, string> =
        preset === 'primary'
          ? {
              chatEndpointUrl: primaryEndpoint,
              chatModel: primaryModel,
            }
          : {
              chatEndpointUrl: secondaryEndpoint,
              chatModel: secondaryModel,
            }
      Object.keys(patch).forEach(key => dirtyRef.current.add(key))
      setValues(prev => ({ ...prev, ...patch }))
    },
    [dirtyRef, setValues],
  )

  return (
    <article className="min-h-full flex flex-col space-y-0">
      <section className="space-y-0">
        <header className={`sticky top-0 z-10 border-b ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}>
          <KeyTypeValueRow
            keyNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Key</span>}
            typeNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Type</span>}
            valueNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Value</span>}
            density="compact"
            className="h-9 py-0"
          />
        </header>
        <section className="p-2 border-b border-white/10">
          <WorkspaceTableModeControl />
        </section>
        {groupByArea.map(([area, entries]) => {
          const collapsed = collapsedByArea[area] ?? true
          const responsibilities = entries.map(e => e.details.responsibility).filter(Boolean)
          const firstResponsibility = responsibilities[0]
          const tooltipContent = buildSettingsAreaTooltip(area, firstResponsibility)
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
                {area === 'UI Density: Panels' && (
                  <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                    <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Presets</span>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                      onClick={() => {
                        applyUiPanelDensityPreset('comfortable')
                      }}
                    >
                      Comfortable
                    </button>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                      onClick={() => {
                        applyUiPanelDensityPreset('compact')
                      }}
                    >
                      Compact
                    </button>
                  </li>
                )}
                {area === 'Chat' && (
                  <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                    <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>LM Studio profiles</span>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                      onClick={() => {
                        applyChatPreset('primary')
                      }}
                    >
                      Primary
                    </button>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                      onClick={() => {
                        applyChatPreset('secondary')
                      }}
                    >
                      Secondary
                    </button>
                  </li>
                )}
                {entries.map(({ meta: s, details, writable, anchorId }) => {
                  const isExpanded = expanded === s.key
                  const hasOptions = Array.isArray(s.options) && s.options.length > 0
                  const keyTooltip = buildSettingsKeyTooltip({
                    area: details.area,
                    key: s.key,
                    responsibility: details.responsibility,
                  })
                  const valueTooltip = buildSettingsValueTooltip({
                    type: s.type,
                    key: s.key,
                    defaultValue: s.default ? s.default() : null,
                    options: s.options,
                    notes: details.notes,
                    impact: details.notes || details.responsibility,
                  })
                  const pillButtonClassName = `inline-flex items-center justify-center h-6 rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.secondary} px-2 text-xs whitespace-nowrap`
                  const statusPillClassName = `inline-flex items-center h-6 max-w-[14rem] rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.tertiary} px-2 text-xs`
                  return (
                    <li key={s.key}>
                      <KeyTypeValueRow
                        id={anchorId}
                        dataKgAnchor={anchorId}
                        keyNode={(
                          <Tooltip
                            content={keyTooltip}
                            maxWidthPx={250}
                            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <span className="truncate">{s.key}</span>
                            </span>
                          </Tooltip>
                        )}
                        typeNode={s.type}
                        valueNode={(
                          <div className="flex-1">
                            {(() => {
                              const valueWrapperBaseClass = 'inline-flex w-full min-w-0 items-center min-h-[24px]'
                              const valueWrapperClass = s.type === 'boolean'
                                ? `${valueWrapperBaseClass} justify-end`
                                : valueWrapperBaseClass
                              const inputNode = (writable || hasOptions) && valueTooltip.trim().length > 0
                                ? (
                                  <Tooltip
                                    content={valueTooltip}
                                    maxWidthPx={260}
                                    contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                                    className="w-full"
                                  >
                                    <span
                                      className={valueWrapperClass}
                                      onClick={e => e.stopPropagation()}
                                    >
                                      {renderInput(s.key, s.type, writable, s.options)}
                                    </span>
                                  </Tooltip>
                                )
                                : (
                                  <span
                                    className={valueWrapperClass}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {renderInput(s.key, s.type, writable, s.options)}
                                  </span>
                                )
                              if (s.key !== 'chatSystemPrompt') return inputNode
                              return (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    {inputNode}
                                  </div>
                                  {chatHealthStatus && (
                                    <span className={statusPillClassName} title={chatHealthStatus}>
                                      <span className="truncate overflow-hidden whitespace-nowrap">
                                        {chatHealthStatus}
                                      </span>
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation()
                                      checkChatHealth()
                                    }}
                                    disabled={isCheckingHealth}
                                    className={pillButtonClassName}
                                  >
                                    {isCheckingHealth ? 'Checking...' : 'Check Health'}
                                  </button>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                        onClick={() => setExpanded(isExpanded ? null : s.key)}
                      />
                      {isExpanded && (
                        <div className={`mt-0 mb-0 text-xs ${UI_THEME_TOKENS.text.primary} border-l pl-2`}>
                          <table className={`w-full text-left border-collapse ${uiPanelKeyValueTextSizeClass || ''}`}>
                            <thead>
                              <tr>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Modules</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Classes/Objects</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Functions/Methods</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.modules || []).join(', ') || '—'}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.classes || []).join(', ') || '—'}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.functions || []).join(', ') || '—'}</td>
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
