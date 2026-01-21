import React from 'react'
import type { ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

export function ToolbarYouTubeArea(props: ToolbarToolMenuAreasProps) {
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
    if (!props.isYouTubeImportMenuOpen) {
      setIsUrlInputOpen(false)
      setUrlInputValue('')
    }
  }, [props.isYouTubeImportMenuOpen])

  React.useEffect(() => {
    if (isUrlInputOpen) {
      urlInputRef.current?.focus()
    }
  }, [isUrlInputOpen])

  return (
    <div className="flex flex-col gap-1">
      {props.isYouTubeImportMenuOpen && (
        <div className="flex flex-col gap-1 px-1" data-floating-panel-no-drag="true">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                setIsUrlInputOpen(v => !v)
              }}
            >
              {UI_COPY.toolbarYouTubeImportUrlButtonLabel}
            </button>
          </div>
          {isUrlInputOpen && (
            <form
              className="flex items-center justify-end"
              data-floating-panel-no-drag="true"
              onSubmit={(e) => {
                e.preventDefault()
                const url = urlInputValue.trim()
                if (!url) return
                props.setIsYouTubeImportMenuOpen(false)
                setIsUrlInputOpen(false)
                setUrlInputValue('')
                props.onToolMenuAction('sourceFiles', 'importUrl', { format: 'youtube', url })
              }}
            >
              <div className="flex w-full flex-col gap-1">
                <input
                  ref={urlInputRef}
                  value={urlInputValue}
                  onChange={e => setUrlInputValue(e.target.value)}
                  placeholder={UI_COPY.youtubeImportUrlPrompt}
                  className={`w-full h-7 px-2 border border-gray-300 rounded bg-white text-gray-700 text-left ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}
                />
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
