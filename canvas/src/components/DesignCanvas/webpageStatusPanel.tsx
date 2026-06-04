import React from 'react'
import type { WebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import type { WebpageStatusUiState, WebpageStatusUiStore } from '@/components/DesignCanvas/webpageStatusStore'
import { UI_RESPONSIVE_CANVAS_STATUS_PANEL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

function useWebpageStatusUi(store: WebpageStatusUiStore): WebpageStatusUiState {
  return React.useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

export const DesignCanvasWebpageStatusPanel = React.memo(function DesignCanvasWebpageStatusPanel(props: {
  active: boolean
  documentUrl: string | null
  webpageFrontmatter: WebpageFrontmatterMeta | null
  webpageWorkspacePath: string
  webpageLayoutStatus: 'idle' | 'loading' | 'ready' | 'error'
  webpageStatusStore: WebpageStatusUiStore
  onDecreaseFidelity: () => void
  onIncreaseFidelity: () => void
  onRetry: () => void
}) {
  const {
    active,
    documentUrl,
    webpageFrontmatter,
    webpageWorkspacePath,
    webpageLayoutStatus,
    webpageStatusStore,
    onDecreaseFidelity,
    onIncreaseFidelity,
    onRetry,
  } = props
  const { progress, message } = useWebpageStatusUi(webpageStatusStore)
  if (!active) return null
  return (
    <section className={`pointer-events-none absolute left-3 top-3 z-50 ${UI_RESPONSIVE_CANVAS_STATUS_PANEL_CLASSNAME} rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-3 py-2 text-xs text-[var(--kg-text)] shadow`}>
      <section className="flex items-center justify-between gap-3">
        <section className="min-w-0">
          <section className="font-semibold">Webpage Wireframe</section>
          {documentUrl ? <section className="truncate opacity-80">{documentUrl}</section> : <section className="opacity-80">No webpage URL found for this graph</section>}
          {documentUrl ? (
            <section className="mt-1 flex items-center gap-2 opacity-80">
              <section>Fidelity: {webpageFrontmatter?.fidelityLevel || 3}</section>
              {webpageWorkspacePath ? (
                <section className="flex gap-1">
                  <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-0.5 text-xs" onClick={onDecreaseFidelity}>
                    -
                  </button>
                  <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-0.5 text-xs" onClick={onIncreaseFidelity}>
                    +
                  </button>
                </section>
              ) : null}
            </section>
          ) : (
            <section className="mt-2 opacity-70">Import a URL-based document or add kgWebpageUrl frontmatter.</section>
          )}
        </section>
        {webpageLayoutStatus === 'loading' ? <section className="shrink-0 tabular-nums">{Math.max(0, Math.min(100, Math.floor(progress)))}%</section> : null}
      </section>
      {webpageLayoutStatus === 'loading' ? (
        <section className="mt-2">
          <section className="h-2 w-full overflow-hidden rounded bg-[var(--kg-border)]/40">
            <section className="h-full bg-[var(--kg-canvas-accent)]" style={{ width: `${Math.max(0, Math.min(100, Math.floor(progress)))}%` }} />
          </section>
          {message ? <section className="mt-1 opacity-80">{message}</section> : null}
        </section>
      ) : webpageLayoutStatus === 'error' ? (
        <section className="mt-2">
          <section className="text-[var(--kg-danger,#c0392b)]">{message || 'Export failed'}</section>
          <section className="mt-2 flex gap-2">
            <button
              type="button"
              className="pointer-events-auto rounded border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-2 py-1 text-xs"
              onClick={onRetry}
            >
              Retry
            </button>
          </section>
        </section>
      ) : webpageLayoutStatus === 'ready' ? (
        message ? <section className="mt-2 opacity-70">{message}</section> : null
      ) : null}
    </section>
  )
})
