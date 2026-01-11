import React from 'react'

export type MarkdownPreviewContextMenuState = {
  x: number
  y: number
  startLine: number
  endLine: number
}

export type MarkdownPreviewContextMenuProps = {
  contextMenu: MarkdownPreviewContextMenuState | null
  label: string
  onClickShowOnCanvas: (startLine: number, endLine: number) => void
  onClose: () => void
}

export function MarkdownPreviewContextMenu(props: MarkdownPreviewContextMenuProps) {
  const { contextMenu, label, onClickShowOnCanvas, onClose } = props
  if (!contextMenu) return null
  return (
    <div
      className="absolute z-10 bg-white border border-gray-200 rounded shadow-md text-xs text-gray-700"
      style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
    >
      <button
        type="button"
        className="block w-full px-3 py-1 text-left hover:bg-gray-100"
        onClick={() => {
          onClickShowOnCanvas(contextMenu.startLine, contextMenu.endLine)
          onClose()
        }}
      >
        {label}
      </button>
    </div>
  )
}

