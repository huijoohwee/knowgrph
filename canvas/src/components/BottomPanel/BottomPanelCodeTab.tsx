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
      <textarea
        ref={codeRef}
        value={codeText}
        readOnly={readOnly}
        onChange={handlers.onChange}
        onSelect={handlers.onSelect}
        onDoubleClick={handlers.onDoubleClick}
        onKeyUp={handlers.onKeyUp}
        onClick={handlers.onClick}
        onBlur={handlers.onBlur}
        className={`w-full flex-1 min-h-0 px-2 py-2 border border-gray-300 rounded resize-none bg-transparent ${uiPanelMonospaceTextClass}`}
      />
      {footer && (
        <div className="mt-2 shrink-0">
          {footer}
        </div>
      )}
    </div>
  )
}
