import React from 'react'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import type { ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

export function ToolbarPdfArea(props: ToolbarToolMenuAreasProps) {
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

  React.useEffect(() => {
    if (!props.isPdfImportMenuOpen) {
      setIsUrlInputOpen(false)
      setUrlInputValue('')
    }
  }, [props.isPdfImportMenuOpen])

  React.useEffect(() => {
    if (isUrlInputOpen) {
      urlInputRef.current?.focus()
    }
  }, [isUrlInputOpen])

  return (
    <div className="flex flex-col gap-1">
      {props.isPdfImportMenuOpen && (
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                props.setIsPdfImportMenuOpen(false)
                props.onToolMenuAction('sourceFiles', 'importLocal', { format: 'pdf' })
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
              {UI_COPY.toolbarPdfImportUrlButtonLabel}
            </button>
          </div>
          {isUrlInputOpen && (
            <form
              className="flex items-center justify-end"
              onSubmit={(e) => {
                e.preventDefault()
                const url = urlInputValue.trim()
                if (!url) return
                props.setIsPdfImportMenuOpen(false)
                setIsUrlInputOpen(false)
                setUrlInputValue('')
                props.onToolMenuAction('sourceFiles', 'importUrl', { format: 'pdf', url })
              }}
            >
              <input
                ref={urlInputRef}
                value={urlInputValue}
                onChange={e => setUrlInputValue(e.target.value)}
                placeholder={UI_COPY.pdfImportUrlPrompt}
                className={`w-full h-7 px-2 border border-gray-300 rounded bg-white text-gray-700 text-left ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}
              />
            </form>
          )}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <StatusBadge
          label={UI_LABELS.pdf}
          ok={props.dataLoadOk}
          msg={props.dataLoadMsg}
        />
      </div>
    </div>
  )
}
