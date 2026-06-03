import React from 'react'
import { CanvasPreviewDock } from '@/components/CanvasPreviewDock'
import { UI_RESPONSIVE_EMBEDDED_WORKSPACE_LEFT_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

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
    <section className="kg-embedded-workspace-shell flex-1 min-h-0 flex overflow-hidden" aria-label="Embedded Workspace">
      <main className={`kg-embedded-workspace-main flex-1 min-w-0 min-h-0 flex ${props.panelTextClass || ''}`.trim()} aria-label="Workspace and Preview">
        <section className={`${UI_RESPONSIVE_EMBEDDED_WORKSPACE_LEFT_CLASSNAME} flex-1 min-h-0 overflow-hidden flex flex-col`} aria-label={props.leftAriaLabel}>
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
