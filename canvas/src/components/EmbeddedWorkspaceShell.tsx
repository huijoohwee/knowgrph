import React from 'react'
import { CanvasPreviewDock } from '@/components/CanvasPreviewDock'

export type EmbeddedWorkspaceShellProps = {
  left: React.ReactNode
  leftAriaLabel: string
  preview: React.ReactNode

  previewCollapsed: boolean
  setPreviewCollapsed?: (next: boolean) => void
  previewWidthPx: number
  setPreviewWidthPx: (next: number) => void

  panelTextClass?: string
  previewResizeAriaLabel?: string
  previewAriaLabel?: string
  previewFrameAriaLabel?: string
}

export function EmbeddedWorkspaceShell(props: EmbeddedWorkspaceShellProps) {
  return (
    <section className="flex-1 min-h-0 flex overflow-hidden" aria-label="Embedded Workspace">
      <main className={`flex-1 min-w-0 min-h-0 flex ${props.panelTextClass || ''}`.trim()} aria-label="Workspace and Preview">
        <section className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col min-w-[280px]" aria-label={props.leftAriaLabel}>
          {props.left}
        </section>

        <CanvasPreviewDock
          collapsed={props.previewCollapsed}
          setCollapsed={props.setPreviewCollapsed}
          widthPx={props.previewWidthPx}
          setWidthPx={props.setPreviewWidthPx}
          resizeAriaLabel={props.previewResizeAriaLabel}
          ariaLabel={props.previewAriaLabel}
          frameAriaLabel={props.previewFrameAriaLabel}
        >
          {props.preview}
        </CanvasPreviewDock>
      </main>
    </section>
  )
}
