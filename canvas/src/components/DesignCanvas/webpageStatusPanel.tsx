import React from 'react'
import type { WebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import type { WebpageStatusUiState, WebpageStatusUiStore } from '@/components/DesignCanvas/webpageStatusStore'

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
    <div className="pointer-events-none absolute left-3 top-3 z-50 max-w-[min(720px,calc(100%-24px))] rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-3 py-2 text-xs text-[var(--kg-text)] shadow">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">Webpage Wireframe</div>
          {documentUrl ? <div className="truncate opacity-80">{documentUrl}</div> : <div className="opacity-80">No webpage URL found for this graph</div>}
          {documentUrl ? (
            <div className="mt-1 flex items-center gap-2 opacity-80">
              <div>Fidelity: {webpageFrontmatter?.fidelityLevel || 3}</div>
              {webpageWorkspacePath ? (
                <div className="flex gap-1">
                  <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-0.5 text-xs" onClick={onDecreaseFidelity}>
                    -
                  </button>
                  <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-0.5 text-xs" onClick={onIncreaseFidelity}>
                    +
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 opacity-70">Import a URL-based document or add kgWebpageUrl frontmatter.</div>
          )}
        </div>
        {webpageLayoutStatus === 'loading' ? <div className="shrink-0 tabular-nums">{Math.max(0, Math.min(100, Math.floor(progress)))}%</div> : null}
      </div>
      {webpageLayoutStatus === 'loading' ? (
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded bg-[var(--kg-border)]/40">
            <div className="h-full bg-[var(--kg-canvas-accent)]" style={{ width: `${Math.max(0, Math.min(100, Math.floor(progress)))}%` }} />
          </div>
          {message ? <div className="mt-1 opacity-80">{message}</div> : null}
        </div>
      ) : webpageLayoutStatus === 'error' ? (
        <div className="mt-2">
          <div className="text-[var(--kg-danger,#c0392b)]">{message || 'Export failed'}</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="pointer-events-auto rounded border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-2 py-1 text-xs"
              onClick={onRetry}
            >
              Retry
            </button>
          </div>
        </div>
      ) : webpageLayoutStatus === 'ready' ? (
        message ? <div className="mt-2 opacity-70">{message}</div> : null
      ) : null}
    </div>
  )
})
