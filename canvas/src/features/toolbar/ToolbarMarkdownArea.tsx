import React from 'react'
import type { ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

export function ToolbarMarkdownArea(props: ToolbarToolMenuAreasProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const buttonClassName = `App-toolbar__btn ${uiPanelKeyValueTextSizeClass} bg-gray-50 text-gray-700 px-1 py-0.5`
  const [isUrlInputOpen, setIsUrlInputOpen] = React.useState(false)
  const [urlInputValue, setUrlInputValue] = React.useState('')
  const urlInputRef = React.useRef<HTMLInputElement | null>(null)

  const markdownIngestionKind = useGraphStore(s => {
    const graphData = s.graphData
    if (!graphData) return null
    const meta = graphData.metadata
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
    const ingestionMetrics = (meta as Record<string, unknown>).ingestionMetrics
    if (!ingestionMetrics || typeof ingestionMetrics !== 'object' || Array.isArray(ingestionMetrics)) {
      return null
    }
    const record = ingestionMetrics as Record<string, unknown>
    const kind = record.kind
    return typeof kind === 'string' ? kind : null
  })

  const isMarkdownLargeSummary = markdownIngestionKind === 'markdown-large'

  React.useEffect(() => {
    if (!props.isMarkdownImportMenuOpen) {
      setIsUrlInputOpen(false)
      setUrlInputValue('')
    }
  }, [props.isMarkdownImportMenuOpen])

  React.useEffect(() => {
    if (isUrlInputOpen) {
      urlInputRef.current?.focus()
    }
  }, [isUrlInputOpen])

  return (
    <div className="flex flex-col gap-1">
      {props.isMarkdownImportMenuOpen && (
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                props.setIsMarkdownImportMenuOpen(false)
                props.onToolMenuAction('sourceFiles', 'importLocal', { format: 'markdown' })
              }}
            >
              {UI_COPY.toolbarMarkdownImportLocalDeviceButtonLabel}
            </button>
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                setIsUrlInputOpen(v => !v)
              }}
            >
              {UI_COPY.toolbarMarkdownImportUrlButtonLabel}
            </button>
          </div>
          {isUrlInputOpen && (
            <form
              className="flex items-center justify-end"
              onSubmit={(e) => {
                e.preventDefault()
                const url = urlInputValue.trim()
                if (!url) return
                props.setIsMarkdownImportMenuOpen(false)
                setIsUrlInputOpen(false)
                setUrlInputValue('')
                props.onToolMenuAction('sourceFiles', 'importUrl', { format: 'markdown', url })
              }}
            >
              <input
                ref={urlInputRef}
                value={urlInputValue}
                onChange={e => setUrlInputValue(e.target.value)}
                placeholder={UI_COPY.markdownImportUrlPrompt}
                className={`w-full h-7 px-2 border border-gray-300 rounded bg-white text-gray-700 text-left ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}
              />
            </form>
          )}
        </div>
      )}
      <div className="flex items-end justify-end gap-2 flex-col">
        {isMarkdownLargeSummary && (
        <div
          className={[
            uiPanelKeyValueTextSizeClass,
            'text-[10px] text-gray-400',
          ].join(' ')}
        >
          {UI_COPY.markdownLargeSummaryHelperText}
        </div>
      )}
      </div>
    </div>
  )
}
