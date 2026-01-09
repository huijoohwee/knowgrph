import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'

type CodeTextareaHandlers = {
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void
  onDoubleClick: (e: React.MouseEvent<HTMLTextAreaElement>) => void
  onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onClick: (e: React.MouseEvent<HTMLTextAreaElement>) => void
  onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void
}

interface BottomPanelCodeTabProps {
  codeText: string
  codeError: string
  codeRef: React.RefObject<HTMLTextAreaElement | null>
  handlers: CodeTextareaHandlers
  readOnly?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
}

export default function BottomPanelCodeTab({
  codeText,
  codeError,
  codeRef,
  handlers,
  readOnly = false,
  header,
  footer,
}: BottomPanelCodeTabProps) {
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const selectionFlashOpacity = useGraphStore(s => s.selectionFlashOpacity || 0.18)
  const flashAlpha = Math.max(0, Math.min(1, selectionFlashOpacity))

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [selectionOverlayStyle, setSelectionOverlayStyle] = React.useState<{
    top: number
    height: number
    active: boolean
  }>({ top: 0, height: 0, active: false })

  React.useEffect(() => {
    if (!codeRef.current) return
    textareaRef.current = codeRef.current
  }, [codeRef])

  const handleSelect = React.useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      handlers.onSelect(e)
      const el = e.target as HTMLTextAreaElement
      const start = el.selectionStart
      const lineIndex = el.value.slice(0, start).split('\n').length - 1
      const lineHeight = 16
      const top = lineIndex * lineHeight
      const height = lineHeight
      setSelectionOverlayStyle({
        top,
        height,
        active: true,
      })
    },
    [handlers],
  )

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      handlers.onClick(e)
      setSelectionOverlayStyle(prev => (prev.active ? prev : prev))
    },
    [handlers],
  )

  return (
    <div className="h-full min-h-0 flex flex-col">
      {header && (
        <div className="mb-2 shrink-0">
          {header}
        </div>
      )}
      {codeError && (
        <div className={`mt-2 ${uiPanelMicroLabelTextSizeClass} text-red-600 shrink-0`}>
          {codeError}
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        {selectionOverlayStyle.active && (
          <div
            className="pointer-events-none absolute left-0 right-0"
            style={{
              top: selectionOverlayStyle.top,
              height: selectionOverlayStyle.height,
              backgroundColor: `rgba(249,115,22,${flashAlpha})`,
            }}
          />
        )}
        <textarea
          ref={codeRef}
          value={codeText}
          readOnly={readOnly}
          onChange={handlers.onChange}
          onSelect={handleSelect}
          onDoubleClick={handlers.onDoubleClick}
          onKeyUp={handlers.onKeyUp}
          onClick={handleClick}
          onBlur={handlers.onBlur}
          className={`w-full h-full px-2 py-2 border border-gray-300 rounded resize-none bg-transparent relative ${uiPanelMonospaceTextClass}`}
        />
      </div>
      {footer && (
        <div className="mt-2 shrink-0">
          {footer}
        </div>
      )}
    </div>
  )
}
