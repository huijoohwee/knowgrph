import React from 'react'
import { Database, Download, Eraser, PlayCircle, Plus, Upload } from 'lucide-react'
import Tooltip from '@/features/panels/ui/Tooltip'
import { TOOL_MENU_ACTION_LABELS, TOOL_MENU_AREAS } from '@/features/toolbar/toolMenu'
import { TOOLBAR_AREA_RENDERERS, type ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'

export function ToolbarToolMenuAreas(props: ToolbarToolMenuAreasProps) {
  const {
    dataLoadOk,
    setIsCuratorExportMenuOpen,
    setIsParserExportMenuOpen,
    setIsMarkdownImportMenuOpen,
    setIsSchemaExportMenuOpen,
    setIsGraphFieldsExportMenuOpen,
    setIsSettingsExportMenuOpen,
    setIsHistoryExportMenuOpen,
    setIsValidationExportMenuOpen,
    onToolMenuAction,
    onOpenData,
    onRunPipeline,
    searchQuery,
  } = props
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const normalizedSearchQuery = (searchQuery || '').trim().toLowerCase()
  const visibleAreas = React.useMemo(() => {
    if (!normalizedSearchQuery) return TOOL_MENU_AREAS
    return TOOL_MENU_AREAS.filter(area => {
      const actionLabels = area.actions.map(action => TOOL_MENU_ACTION_LABELS[action]).join(' ')
      const haystack = `${area.key} ${area.label} ${area.description} ${actionLabels}`.toLowerCase()
      return haystack.includes(normalizedSearchQuery)
    })
  }, [normalizedSearchQuery])
  return (
    <>
      <div className="flex items-center justify-between gap-1 px-0.5 pb-1 border-b border-gray-100">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 disabled:opacity-50 inline-flex items-center gap-1`}
          onClick={onOpenData}
          disabled={dataLoadOk !== true}
        >
          <Database className={iconSizeClass} aria-hidden="true" />
          <span>Open Data</span>
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 inline-flex items-center gap-1`}
          onClick={onRunPipeline}
        >
          <PlayCircle className={iconSizeClass} aria-hidden="true" />
          <span>Run pipeline</span>
        </button>
      </div>
      {visibleAreas.map(area => (
        <div
          key={area.key}
          className="flex flex-col gap-1 px-0.5 py-1 border-b border-gray-100 last:border-b-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate">
                {area.description ? (
                  <Tooltip
                    content={area.description}
                    maxWidthPx={280}
                    contentClassName="bg-gray-800/90"
                  >
                    <span>{area.label}</span>
                  </Tooltip>
                ) : (
                  area.label
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {area.actions.map(action => {
                const handleClick =
                  area.key === 'curator' && action === 'export'
                    ? () => {
                      setIsMarkdownImportMenuOpen(false)
                      setIsCuratorExportMenuOpen(v => !v)
                    }
                    : area.key === 'parser' && action === 'export'
                      ? () => {
                        setIsMarkdownImportMenuOpen(false)
                        setIsParserExportMenuOpen(v => !v)
                      }
                      : area.key === 'markdown' && action === 'import'
                        ? () => setIsMarkdownImportMenuOpen(v => !v)
                      : area.key === 'schemaConfig' && action === 'export'
                        ? () => {
                          setIsMarkdownImportMenuOpen(false)
                          setIsSchemaExportMenuOpen(v => !v)
                        }
                        : area.key === 'graphFields' && action === 'export'
                          ? () => {
                            setIsMarkdownImportMenuOpen(false)
                            setIsGraphFieldsExportMenuOpen(v => !v)
                          }
                          : area.key === 'settings' && action === 'export'
                            ? () => {
                              setIsMarkdownImportMenuOpen(false)
                              setIsSettingsExportMenuOpen(v => !v)
                            }
                            : area.key === 'history' && action === 'export'
                              ? () => {
                                setIsMarkdownImportMenuOpen(false)
                                setIsHistoryExportMenuOpen(v => !v)
                              }
                              : area.key === 'validation' && action === 'export'
                                ? () => {
                                  setIsMarkdownImportMenuOpen(false)
                                  setIsValidationExportMenuOpen(v => !v)
                                }
                                : () => onToolMenuAction(area.key, action)
                const icon = (() => {
                  if (action === 'new') {
                    return (
                      <Plus
                        className={iconSizeClass}
                        strokeWidth={uiIconStrokeWidth}
                        aria-hidden="true"
                      />
                    )
                  }
                  if (action === 'import') {
                    return (
                      <Upload
                        className={iconSizeClass}
                        strokeWidth={uiIconStrokeWidth}
                        aria-hidden="true"
                      />
                    )
                  }
                  if (action === 'export') {
                    return (
                      <Download
                        className={iconSizeClass}
                        strokeWidth={uiIconStrokeWidth}
                        aria-hidden="true"
                      />
                    )
                  }
                  return (
                    <Eraser
                      className={iconSizeClass}
                      strokeWidth={uiIconStrokeWidth}
                      aria-hidden="true"
                    />
                  )
                })()
                return (
                  <button
                    key={action}
                    type="button"
                    className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 px-1 py-0.5`}
                    onClick={handleClick}
                    aria-label={`${TOOL_MENU_ACTION_LABELS[action]} ${area.label}`}
                  >
                    {icon}
                  </button>
                )
              })}
            </div>
          </div>
          {(() => {
            const renderArea = TOOLBAR_AREA_RENDERERS[area.key]
            if (renderArea) {
              return renderArea(props)
            }
            return null
          })()}
        </div>
      ))}
    </>
  )
}
