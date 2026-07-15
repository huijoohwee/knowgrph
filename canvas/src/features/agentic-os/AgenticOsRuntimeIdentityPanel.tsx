import React from 'react'
import {
  refreshAgenticOsRemoteGrammarCatalog,
  type AgenticOsRemoteGrammarSnapshot,
} from './agenticOsRemoteGrammarClient'
import {
  buildKnowgrphRuntimeIdentity,
  isKnowgrphRuntimeIdentityFresh,
  serializeKnowgrphRuntimeIdentity,
} from './agenticOsRuntimeIdentity'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

const revisionText = (value: string): string => value || 'unavailable'

export function AgenticOsRuntimeIdentityPanel({ snapshot }: { snapshot: AgenticOsRemoteGrammarSnapshot }) {
  const [copyStatus, setCopyStatus] = React.useState('')
  const identity = React.useMemo(() => buildKnowgrphRuntimeIdentity(snapshot), [snapshot])
  const fresh = isKnowgrphRuntimeIdentityFresh(identity)
  const serializedIdentity = React.useMemo(() => serializeKnowgrphRuntimeIdentity(identity), [identity])

  const copyIdentity = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(serializedIdentity)
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy unavailable')
    }
  }, [serializedIdentity])

  return (
    <section
      className={cn('mb-2 grid min-w-0 gap-1 border-b pb-2 text-xs', UI_THEME_TOKENS.panel.border)}
      aria-label="Runtime identity"
      data-kg-runtime-identity="knowgrph-runtime-identity/v1"
      data-kg-runtime-identity-status={fresh ? 'fresh' : snapshot.hydration.status}
      data-kg-runtime-knowgrph-revision={identity.knowgrphRevision}
      data-kg-runtime-agentic-canvas-os-revision={identity.agenticCanvasOsRevision}
      data-kg-runtime-catalog-revision={identity.catalogRevision}
    >
      <header className="flex min-w-0 items-center justify-between gap-2">
        <strong className={UI_THEME_TOKENS.text.primary}>Runtime identity</strong>
        <span className={fresh ? 'text-emerald-400' : 'text-amber-400'} data-kg-runtime-hydration-status={snapshot.hydration.status}>
          {snapshot.hydration.status}
        </span>
      </header>
      <dl className={cn('grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1', UI_THEME_TOKENS.text.secondary)}>
        <dt>Device</dt><dd className="min-w-0 break-all font-mono">{identity.device}</dd>
        <dt>Branch</dt><dd className="min-w-0 break-all font-mono">{identity.branch}</dd>
        <dt>Knowgrph SHA</dt><dd className="min-w-0 break-all font-mono">{revisionText(identity.knowgrphRevision)}</dd>
        <dt>Docs SHA</dt><dd className="min-w-0 break-all font-mono">{revisionText(identity.agenticCanvasOsRevision)}</dd>
        <dt>Catalog SHA</dt><dd className="min-w-0 break-all font-mono">{revisionText(identity.catalogRevision)}</dd>
        <dt>Catalog</dt>
        <dd className="font-mono" data-kg-runtime-catalog-counts={`${identity.catalogCounts.slash}/${identity.catalogCounts.hash}/${identity.catalogCounts.at}`}>
          / {identity.catalogCounts.slash} · # {identity.catalogCounts.hash} · @ {identity.catalogCounts.at}
        </dd>
        <dt>Attempts</dt><dd className="font-mono">{identity.catalogHydration.attempts}/2</dd>
      </dl>
      {snapshot.hydration.error ? <p className="m-0 text-amber-400">{snapshot.hydration.error}</p> : null}
      <section className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="App-toolbar__btn text-xs"
          disabled={snapshot.hydration.status === 'loading'}
          onClick={() => void refreshAgenticOsRemoteGrammarCatalog()}
        >
          Refresh catalog
        </button>
        <button type="button" className="App-toolbar__btn text-xs" onClick={() => void copyIdentity()}>
          Copy identity JSON
        </button>
        {copyStatus ? <output className={UI_THEME_TOKENS.text.tertiary}>{copyStatus}</output> : null}
      </section>
    </section>
  )
}
