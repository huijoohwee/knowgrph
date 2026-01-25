import React from 'react'
import { Database, Download, Eraser, MonitorPlay, PlayCircle, Plus, Upload } from 'lucide-react'
import Tooltip from '@/features/panels/ui/Tooltip'
import { TOOL_MENU_ACTION_LABELS, TOOL_MENU_AREAS } from '@/features/toolbar/toolMenu'
import { TOOLBAR_AREA_RENDERERS, type ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function ToolbarToolMenuAreas(props: ToolbarToolMenuAreasProps) {
  const {
    dataLoadOk,
    setIsSourceFilesImportMenuOpen,
    setIsSourceFilesExportMenuOpen,
    setIsParserExportMenuOpen,
    setIsMarkdownImportMenuOpen,
    setIsHtmlImportMenuOpen,
    setIsPdfImportMenuOpen,
    setIsYouTubeImportMenuOpen,
    setIsJsonImportMenuOpen,
    setIsJsonLdImportMenuOpen,
    setIsSchemaExportMenuOpen,
    setIsGraphFieldsExportMenuOpen,
    setIsSettingsExportMenuOpen,
    setIsHistoryExportMenuOpen,
    setIsValidationExportMenuOpen,
    onToolMenuAction,
    onOpenData,
    onRunPipeline,
    onRunDemo,
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

  type MenuToggleKey =
    | 'sourceFilesImport'
    | 'sourceFilesExport'
    | 'parserExport'
    | 'markdownImport'
    | 'htmlImport'
    | 'pdfImport'
    | 'youTubeImport'
    | 'jsonImport'
    | 'jsonLdImport'
    | 'schemaExport'
    | 'graphFieldsExport'
    | 'settingsExport'
    | 'historyExport'
    | 'validationExport'

  const closeAllMenusExcept = React.useCallback(
    (except: MenuToggleKey | null) => {
      if (except !== 'sourceFilesImport') setIsSourceFilesImportMenuOpen(false)
      if (except !== 'sourceFilesExport') setIsSourceFilesExportMenuOpen(false)
      if (except !== 'parserExport') setIsParserExportMenuOpen(false)
      if (except !== 'markdownImport') setIsMarkdownImportMenuOpen(false)
      if (except !== 'htmlImport') setIsHtmlImportMenuOpen(false)
      if (except !== 'pdfImport') setIsPdfImportMenuOpen(false)
      if (except !== 'youTubeImport') setIsYouTubeImportMenuOpen(false)
      if (except !== 'jsonImport') setIsJsonImportMenuOpen(false)
      if (except !== 'jsonLdImport') setIsJsonLdImportMenuOpen(false)
      if (except !== 'schemaExport') setIsSchemaExportMenuOpen(false)
      if (except !== 'graphFieldsExport') setIsGraphFieldsExportMenuOpen(false)
      if (except !== 'settingsExport') setIsSettingsExportMenuOpen(false)
      if (except !== 'historyExport') setIsHistoryExportMenuOpen(false)
      if (except !== 'validationExport') setIsValidationExportMenuOpen(false)
    },
    [
      setIsGraphFieldsExportMenuOpen,
      setIsHistoryExportMenuOpen,
      setIsHtmlImportMenuOpen,
      setIsJsonImportMenuOpen,
      setIsJsonLdImportMenuOpen,
      setIsMarkdownImportMenuOpen,
      setIsParserExportMenuOpen,
      setIsPdfImportMenuOpen,
      setIsSchemaExportMenuOpen,
      setIsSettingsExportMenuOpen,
      setIsSourceFilesExportMenuOpen,
      setIsSourceFilesImportMenuOpen,
      setIsValidationExportMenuOpen,
      setIsYouTubeImportMenuOpen,
    ],
  )

  const areaActionButtonClassName =
    `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 px-1 py-0.5`

  return (
    <>
      <div className={`flex items-center justify-between gap-1 px-0.5 pb-1 border-b ${UI_THEME_TOKENS.panel.divider}`}>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary} disabled:opacity-50 inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded transition-colors`}
          onClick={onOpenData}
          disabled={dataLoadOk !== true}
        >
          <Database className={iconSizeClass} aria-hidden="true" />
          <span>Open Data</span>
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary} inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded transition-colors`}
          onClick={onRunPipeline}
        >
          <PlayCircle className={iconSizeClass} aria-hidden="true" />
          <span>Run pipeline</span>
        </button>
        {onRunDemo && (
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.primary} inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded transition-colors`}
            onClick={onRunDemo}
          >
            <MonitorPlay className={iconSizeClass} aria-hidden="true" />
            <span>Demo</span>
          </button>
        )}
      </div>
      {visibleAreas.map(area => (
        <section
          key={area.key}
          className={`flex flex-col gap-1 px-0.5 py-1 border-b ${UI_THEME_TOKENS.panel.divider} last:border-b-0`}
        >
          <header className="flex items-center justify-between gap-2">
            <h3 className={`text-xs font-medium ${UI_THEME_TOKENS.text.secondary} truncate min-w-0`}>
              {area.description ? (
                <Tooltip
                  content={area.description}
                  maxWidthPx={280}
                  contentClassName={UI_THEME_TOKENS.tooltip.bg}
                >
                  <span>{area.label}</span>
                </Tooltip>
              ) : (
                area.label
              )}
            </h3>
            <div className="flex items-center gap-1" role="toolbar" aria-label={`${area.label} actions`}>
              {area.actions.map(action => {
                const handleClick =
                  area.key === 'sourceFiles' && action === 'import'
                    ? () => {
                        closeAllMenusExcept('sourceFilesImport')
                        setIsSourceFilesImportMenuOpen(v => !v)
                      }
                    : area.key === 'sourceFiles' && action === 'export'
                    ? () => {
                        closeAllMenusExcept('sourceFilesExport')
                        setIsSourceFilesExportMenuOpen(v => !v)
                      }
                    : area.key === 'parser' && action === 'export'
                      ? () => {
                        closeAllMenusExcept('parserExport')
                        setIsParserExportMenuOpen(v => !v)
                      }
                    : area.key === 'markdown' && action === 'import'
                      ? () => {
                        closeAllMenusExcept('markdownImport')
                        setIsMarkdownImportMenuOpen(v => !v)
                      }
                    : area.key === 'html' && action === 'import'
                      ? () => {
                        closeAllMenusExcept('htmlImport')
                        setIsHtmlImportMenuOpen(v => !v)
                      }
                    : area.key === 'pdf' && action === 'import'
                      ? () => {
                          closeAllMenusExcept('pdfImport')
                          setIsPdfImportMenuOpen(v => !v)
                        }
                    : area.key === 'schemaConfig' && action === 'export'
                      ? () => {
                        closeAllMenusExcept('schemaExport')
                        setIsSchemaExportMenuOpen(v => !v)
                      }
                    : area.key === 'graphFields' && action === 'export'
                      ? () => {
                        closeAllMenusExcept('graphFieldsExport')
                        setIsGraphFieldsExportMenuOpen(v => !v)
                      }
                    : area.key === 'settings' && action === 'export'
                      ? () => {
                        closeAllMenusExcept('settingsExport')
                        setIsSettingsExportMenuOpen(v => !v)
                      }
                    : area.key === 'history' && action === 'export'
                      ? () => {
                        closeAllMenusExcept('historyExport')
                        setIsHistoryExportMenuOpen(v => !v)
                      }
                    : area.key === 'validation' && action === 'export'
                      ? () => {
                        closeAllMenusExcept('validationExport')
                        setIsValidationExportMenuOpen(v => !v)
                      }
                    : () => {
                        closeAllMenusExcept(null)
                        onToolMenuAction(area.key, action)
                      }
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
                    className={areaActionButtonClassName}
                    onClick={handleClick}
                    aria-label={`${TOOL_MENU_ACTION_LABELS[action]} ${area.label}`}
                  >
                    {icon}
                  </button>
                )
              })}
            </div>
          </header>
          {(() => {
            const renderArea = TOOLBAR_AREA_RENDERERS[area.key]
            if (renderArea) {
              return renderArea(props)
            }
            return null
          })()}
        </section>
      ))}
    </>
  )
}
