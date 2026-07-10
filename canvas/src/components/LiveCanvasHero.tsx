import React from 'react'
import {
  buildAgenticOsInvocationChipAttrs,
  buildAgenticOsInvocationChipTitle,
} from '@/features/agentic-os/agenticOsInvocationChips'
import {
  appendLiveCanvasHeroToken,
  buildLiveCanvasHeroModel,
  liveCanvasHeroQueryHasToken,
  type LiveCanvasHeroModel,
} from '@/features/agentic-os/liveCanvasHeroModel'
import { handoffLiveCanvasHeroQuery } from '@/features/canvas/liveCanvasHeroHandoff'
import type { LiveCanvasHeroSource } from '@/features/canvas/useKnowgrphLiveCanvasHero'
import { useGraphStore } from '@/hooks/useGraphStore'
import { normalizeInvocationTokenSpacing } from '@/lib/markdown/invocationTokens'
import { resolveLiveCanvasHeroEnterHref } from '@/lib/routing/basePath'

export type LiveCanvasHeroProps = {
  onHandoffComplete?: () => void
  handoff?: (query: string) => Promise<void> | void
}

type LiveCanvasHeroShellProps = LiveCanvasHeroProps & {
  source: LiveCanvasHeroSource
}

type ReadyLiveCanvasHeroModel = Extract<LiveCanvasHeroModel, { status: 'ready' }>

export function LiveCanvasHeroEditorial(props: LiveCanvasHeroProps & { model: ReadyLiveCanvasHeroModel }) {
  const { model } = props
  const [draft, setDraft] = React.useState(model.defaultQuery)
  const [handoffState, setHandoffState] = React.useState<'idle' | 'opening' | 'error'>('idle')
  const [errorText, setErrorText] = React.useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = normalizeInvocationTokenSpacing(draft.trim())
    if (!query) {
      setHandoffState('error')
      setErrorText('Enter an agent-ready query before opening Chat.')
      return
    }
    setHandoffState('opening')
    setErrorText('')
    try {
      await (props.handoff || handoffLiveCanvasHeroQuery)(query)
      props.onHandoffComplete?.()
    } catch (error) {
      setHandoffState('error')
      setErrorText(error instanceof Error ? error.message : 'Chat handoff failed.')
    }
  }

  return (
    <section
      className="pointer-events-none absolute inset-0 z-[40] overflow-hidden text-[var(--kg-text-primary)]"
      aria-labelledby="knowgrph-live-canvas-hero-title"
      data-kg-live-canvas-hero="true"
      data-kg-live-canvas-hero-state="ready"
      data-kg-live-canvas-hero-layout="overlay-on-canvas"
    >
      <section
        className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--kg-canvas-bg)_14%,transparent)_25%,color-mix(in_srgb,var(--kg-canvas-bg)_92%,transparent)_56%,var(--kg-canvas-bg)_100%)] md:hidden"
        aria-hidden="true"
      />
      <section
        className="absolute inset-0 hidden bg-[linear-gradient(90deg,color-mix(in_srgb,var(--kg-canvas-bg)_96%,transparent)_0%,color-mix(in_srgb,var(--kg-canvas-bg)_82%,transparent)_34%,color-mix(in_srgb,var(--kg-canvas-bg)_16%,transparent)_60%,transparent_72%)] md:block"
        aria-hidden="true"
      />
      <section
        className="absolute -left-48 bottom-[-18rem] h-[38rem] w-[38rem] rounded-full bg-[color-mix(in_srgb,var(--kg-canvas-accent)_10%,transparent)] blur-3xl md:bottom-auto md:top-1/2 md:h-[46rem] md:w-[46rem] md:-translate-y-1/2"
        aria-hidden="true"
      />

      <article
        className="pointer-events-auto absolute bottom-[calc(var(--kg-safe-bottom,0px)+var(--kg-canvas-viewport-edge-gap,12px)+var(--kg-toolbar-compact-surface-height,38px)+12px)] left-4 right-4 flex max-h-[calc(100dvh-var(--kg-main-toolbar-height,38px)-var(--kg-toolbar-compact-surface-height,38px)-4rem)] flex-col overflow-y-auto pr-1 md:bottom-auto md:left-8 md:right-auto md:top-1/2 md:w-[min(34rem,calc(100%-4rem))] md:max-h-[calc(100dvh-var(--kg-main-toolbar-height,38px)-2.5rem)] md:-translate-y-1/2 lg:left-12 lg:w-[34rem]"
        data-kg-live-canvas-hero-editorial="overlay"
      >
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--kg-text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-[var(--kg-canvas-accent)] shadow-[0_0_18px_var(--kg-canvas-accent)]" aria-hidden="true" />
          Knowgrph · Live canvas
        </p>
        <h1 id="knowgrph-live-canvas-hero-title" className="mt-3 text-balance text-3xl font-semibold leading-[1.02] tracking-[-0.045em] md:mt-4 md:text-5xl lg:text-[3.5rem]">
          <span className="block">Map intent.</span>
          <span className="block">Orchestrate agents.</span>
          <span className="block text-[var(--kg-canvas-accent)]">Prove outcomes.</span>
        </h1>
        <p className="mt-4 max-w-[34rem] text-sm leading-6 text-[var(--kg-text-secondary)] sm:text-base">
          A source-backed canvas where <span className="font-mono text-[var(--kg-text-primary)]">/</span> routes work,
          {' '}<span className="font-mono text-[var(--kg-text-primary)]">#</span> sets meaning, and
          {' '}<span className="font-mono text-[var(--kg-text-primary)]">@</span> binds context.
        </p>

        <form
          className="mt-4 rounded-2xl border border-[color:var(--kg-border)] bg-[color-mix(in_srgb,var(--kg-panel-bg)_72%,transparent)] p-3 shadow-[0_18px_64px_color-mix(in_srgb,var(--kg-canvas-bg)_72%,transparent)] backdrop-blur-xl md:mt-6 md:p-4"
          onSubmit={handleSubmit}
          data-kg-live-canvas-hero-command-deck="true"
        >
          <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--kg-text-secondary)]" htmlFor="knowgrph-live-canvas-hero-query">
            Agent-ready query
          </label>
          <textarea
            id="knowgrph-live-canvas-hero-query"
            className="mt-2 min-h-16 w-full resize-none rounded-xl border border-[color:var(--kg-border)] bg-[color-mix(in_srgb,var(--kg-code-bg)_88%,transparent)] px-3 py-2.5 font-mono text-xs leading-5 text-[var(--kg-code-text)] outline-none transition-colors focus:border-[var(--kg-canvas-accent)] focus:ring-1 focus:ring-[var(--kg-canvas-accent)] md:resize-y"
            value={draft}
            spellCheck={false}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }}
            data-kg-live-canvas-hero-query="true"
          />

          <nav className="-mx-1 mt-3 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 md:flex-wrap" aria-label="Live Canvas Hero invocation grammar">
            {model.invocations.map(invocation => {
              const active = liveCanvasHeroQueryHasToken(draft, invocation.token)
              const attrs = buildAgenticOsInvocationChipAttrs(invocation.token) || {}
              return (
                <button
                  key={invocation.token}
                  type="button"
                  className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kg-canvas-accent)] ${active ? 'border-[var(--kg-canvas-accent)] bg-[color-mix(in_srgb,var(--kg-canvas-accent)_16%,transparent)] text-[var(--kg-text-primary)]' : 'border-[color:var(--kg-border)] bg-[color:var(--kg-panel-bg)]/70 text-[var(--kg-text-secondary)] hover:text-[var(--kg-text-primary)]'}`}
                  aria-pressed={active}
                  title={buildAgenticOsInvocationChipTitle(invocation.token)}
                  onClick={() => setDraft(current => appendLiveCanvasHeroToken(current, invocation.token))}
                  {...attrs}
                >
                  {invocation.token}
                </button>
              )
            })}
          </nav>

          <section className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={resolveLiveCanvasHeroEnterHref(import.meta.env.BASE_URL)}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[var(--kg-canvas-accent)] bg-[var(--kg-canvas-accent)] px-4 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kg-canvas-accent)]"
              data-kg-live-canvas-hero-enter="true"
            >
              Enter Knowgrph
            </a>
            <button
              type="submit"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--kg-border)] bg-[color-mix(in_srgb,var(--kg-panel-bg)_72%,transparent)] px-4 text-sm font-semibold text-[var(--kg-text-primary)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kg-canvas-accent)] disabled:cursor-wait disabled:opacity-60"
              disabled={handoffState === 'opening'}
              data-kg-live-canvas-hero-start="true"
            >
              {handoffState === 'opening' ? 'Opening Chat…' : 'Start locally'}
            </button>
            <span className="text-[11px] text-[var(--kg-text-secondary)]">Ctrl/⌘ + Enter</span>
          </section>
          {errorText ? <p className="mt-2 text-xs text-red-500" role="alert">{errorText}</p> : null}
        </form>

        <ul className="mt-3 hidden flex-wrap gap-2 text-[10px] text-[var(--kg-text-secondary)] md:flex" aria-label="Agent-ready execution posture">
          {['0 model calls before Run', 'Frontmatter SSOT', 'Approval-gated'].map(label => (
            <li key={label} className="rounded-full border border-[color:var(--kg-border)] bg-[color-mix(in_srgb,var(--kg-panel-bg)_54%,transparent)] px-2.5 py-1 backdrop-blur-md">
              {label}
            </li>
          ))}
        </ul>
      </article>
    </section>
  )
}

export function LiveCanvasHero(props: LiveCanvasHeroShellProps) {
  const model = React.useMemo(buildLiveCanvasHeroModel, [])
  const requestZoom = useGraphStore(state => state.requestZoom)
  React.useEffect(() => {
    let secondFrameId = 0
    const firstFrameId = requestAnimationFrame(() => {
      secondFrameId = requestAnimationFrame(() => {
        requestZoom('fit', { intent: 'fitToView' })
      })
    })
    return () => {
      cancelAnimationFrame(firstFrameId)
      if (secondFrameId) cancelAnimationFrame(secondFrameId)
    }
  }, [props.source.sourceLayerHash, requestZoom])
  if (model.status === 'blocked') {
    return (
      <aside
        className="absolute inset-x-4 bottom-4 z-[40] rounded-lg border border-amber-400/50 bg-[var(--kg-panel-bg)] px-4 py-3 text-sm text-[var(--kg-text-primary)] shadow-lg"
        aria-label="Knowgrph Live Canvas Hero unavailable"
        data-kg-live-canvas-hero-state="blocked"
      >
        Agent-ready landing sources are unavailable: {model.missingTokens.join(', ')}
      </aside>
    )
  }

  return (
    <section
      className="pointer-events-none absolute inset-0 z-[40] overflow-hidden"
      aria-label="Knowgrph Live Canvas Hero"
      data-kg-live-canvas-hero-shell="full-bleed"
      data-kg-live-canvas-hero-source={props.source.sourcePath}
      data-kg-live-canvas-hero-source-graph-id={props.source.graphId || undefined}
      data-kg-live-canvas-hero-source-revision={props.source.graphRevision}
      data-kg-live-canvas-hero-source-schema={props.source.schema || undefined}
    >
      <LiveCanvasHeroEditorial {...props} model={model} />
    </section>
  )
}
