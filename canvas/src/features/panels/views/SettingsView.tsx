import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import { useSettingsView } from './useSettingsView'

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
    schema,
    setSchema,
    uiPanelKeyValueInputClass,
    uiPanelMonospaceTextClass,
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
  } = useSettingsView({ searchQuery, onRegisterActions })

  return (
    <div className="h-full min-h-0 flex flex-col space-y-0">
      <div className="flex-1 min-h-0 overflow-auto space-y-0">
        <div className="px-0 py-2 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-700 mb-1">
            Graph
          </div>
          <KeyTypeValueRow
            layout="keyValue"
            density="compact"
            keyNode={<span className={uiPanelMonospaceTextClass}>schema.layers.mode</span>}
            valueNode={(
              <div className="flex w-full justify-end">
                <select
                  className={uiPanelKeyValueInputClass}
                  value={(schema?.layers?.mode ?? 'property') as 'property' | 'document-structure' | 'semantic'}
                  disabled={!schema}
                  onChange={e => {
                    if (!schema) return
                    const raw = e.target.value
                    const nextMode: 'property' | 'document-structure' | 'semantic' =
                      raw === 'document-structure' || raw === 'semantic' ? raw : 'property'
                    const baseLayers = schema.layers || {}
                    setSchema({
                      ...schema,
                      layers: {
                        ...baseLayers,
                        mode: nextMode,
                      },
                    })
                  }}
                >
                  <option value="property">property</option>
                  <option value="document-structure">document-structure</option>
                  <option value="semantic">semantic</option>
                </select>
              </div>
            )}
          />
        </div>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <KeyTypeValueRow
            keyNode={<span className="font-semibold text-gray-600">Key</span>}
            typeNode={<span className="font-semibold text-gray-600">Type</span>}
            valueNode={<span className="font-semibold text-gray-600">Value</span>}
            density="compact"
            className="h-9 py-0"
          />
        </div>
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
                  contentClassName="bg-gray-800/90"
                >
                  <span className="inline-flex items-center gap-1">
                    <span>{area}</span>
                    <span className="text-xs uppercase tracking-wide text-gray-400 ml-1">
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
              <div>
                {area === 'UI Density: Panels' && (
                  <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-gray-600">
                    <span className="font-semibold text-gray-700">Presets</span>
                    <button
                      type="button"
                      className="App-toolbar__btn text-xs border border-gray-300 bg-white text-gray-700"
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
                      className="App-toolbar__btn text-xs border border-blue-400 bg-blue-50 text-blue-700"
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
                  </div>
                )}
                {entries.map(({ meta: s, details, writable, anchorId }) => {
                  const isExpanded = expanded === s.key
                  const hasOptions = Array.isArray(s.options) && s.options.length > 0
                  const hint = details.notes || details.responsibility || ''
                  return (
                    <div key={s.key}>
                      <KeyTypeValueRow
                        id={anchorId}
                        dataKgAnchor={anchorId}
                        keyNode={hasOptions && hint ? (
                          <Tooltip
                            content={hint}
                            maxWidthPx={250}
                            contentClassName="bg-gray-800/90"
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
                                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded"
                                >
                                  {isCheckingHealth ? 'Checking...' : 'Check Health'}
                                </button>
                                {chatHealthStatus && (
                                  <div className="mt-1 text-xs text-gray-500">
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
                        <div className="mt-0 mb-0 text-xs text-gray-700 border-l pl-2">
                          <div className="grid grid-cols-7 gap-1">
                            <div className="font-medium">Area</div>
                            <div className="font-medium">Modules</div>
                            <div className="font-medium">Classes/Objects</div>
                            <div className="font-medium">Functions/Methods</div>
                            <div className="font-medium">Responsibility</div>
                            <div className="font-medium">Dependencies / Imports</div>
                            <div className="font-medium">Notes</div>
                            <div>{details.area}</div>
                            <div>{(details.modules || []).join(', ') || '—'}</div>
                            <div>{(details.classes || []).join(', ') || '—'}</div>
                            <div>{(details.functions || []).join(', ') || '—'}</div>
                            <div>{details.responsibility}</div>
                            <div>{(details.imports || []).join(', ') || '—'}</div>
                            <div>{details.notes || '—'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          )
        })}
        <CollapsibleSection
          title="Resets and data"
          collapsed={false}
          onToggle={() => void 0}
          className="mt-2 pt-2 border-t border-red-200"
        >
          <div className="space-y-1 text-xs text-gray-700">
            <div>
              Reset all settings to defaults and clear canvas data. This action cannot be undone.
            </div>
            <button
              type="button"
              className="App-toolbar__btn text-xs border border-red-300 bg-red-50 text-red-700"
              onClick={onGlobalReset}
            >
              Global Reset
            </button>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}
