import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ExternalLink,
  FileText,
  Hash,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  PanelsTopLeft,
  Sparkles,
  Video,
  Wand2,
} from 'lucide-react'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { DataViewStatusChip, DataViewTagChip } from '@/features/markdown/ui/MarkdownDataViewChips'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { buildStoryboardBoardModel, type StoryboardCardModel, type StoryboardCardReference } from '@/components/StoryboardCanvas/storyboardModel'

type StoryboardDisplayMedia = {
  kind: 'image' | 'svg' | 'video' | 'iframe'
  url: string
}

function resolveStoryboardDisplayMedia(card: StoryboardCardModel): StoryboardDisplayMedia | null {
  if (card.media) return card.media
  const firstReference = card.references.find(reference => reference.kind !== 'link')
  if (!firstReference || firstReference.kind === 'link') return null
  return {
    kind: firstReference.kind,
    url: firstReference.url,
  }
}

function StoryboardMediaPreview(props: {
  title: string
  href: string
  media: StoryboardDisplayMedia | null
}) {
  const { title, href, media } = props
  if (media?.kind === 'image' || media?.kind === 'svg') {
    return (
      <img
        src={media.url}
        alt={title}
        className="h-full w-full object-cover"
        loading="lazy"
        draggable={false}
      />
    )
  }
  if (media?.kind === 'video') {
    return (
      <video
        src={media.url}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
    )
  }
  return (
    <div className={['flex h-full w-full items-center justify-center gap-2 text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>
      {href ? <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span className="truncate">{href ? 'Open reference' : 'No preview'}</span>
    </div>
  )
}

function StoryboardDetailRow(props: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  const displayValue = readMarkdownSigilDisplayText(props.value)
  if (!displayValue) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-black/5 bg-black/[0.025] px-2.5 py-2">
      <span className={['mt-0.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')}>{props.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={['m-0 text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
          {props.label}
        </p>
        <p className={['m-0 mt-1 text-xs leading-5', UI_THEME_TOKENS.text.secondary].join(' ')} title={displayValue}>
          {renderMarkdownSigilInlineText(props.value)}
        </p>
      </div>
    </div>
  )
}

function StoryboardReferenceStrip(props: {
  cardId: string
  references: StoryboardCardReference[]
}) {
  if (props.references.length === 0) return null
  const visible = props.references.slice(0, 3)
  return (
    <section className="rounded-lg border border-black/5 bg-black/[0.025] px-2.5 py-2" aria-label="Reference pack">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ImageIcon className={['h-3.5 w-3.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')} aria-hidden="true" />
          <span className={['text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
            Reference Pack
          </span>
        </div>
        <span className={['inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {props.references.length}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visible.map((reference, index) => {
          const key = `${props.cardId}:reference:${index}`
          if (reference.kind === 'image' || reference.kind === 'svg') {
            return (
              <a
                key={key}
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-white"
                title={reference.url}
              >
                <img src={reference.url} alt="Reference" className="h-full w-full object-cover" loading="lazy" draggable={false} />
              </a>
            )
          }
          return (
            <a
              key={key}
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              className={['inline-flex h-14 min-w-14 max-w-[8rem] shrink-0 items-center justify-center rounded-lg border px-2 text-center text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}
              title={reference.url}
            >
              {reference.kind === 'video' ? 'Video ref' : 'Open ref'}
            </a>
          )
        })}
      </div>
    </section>
  )
}

export default function StoryboardCanvas({
  active = true,
}: {
  active?: boolean
}) {
  const graphData = useActiveGraphRenderData(active)
  const { graphRevision, selectedNodeId, selectNode } = useGraphStore(
    useShallow(s => ({
      graphRevision: s.graphDataRevision || 0,
      selectedNodeId: String(s.selectedNodeId || '').trim(),
      selectNode: s.selectNode,
    })),
  )
  const board = React.useMemo(() => {
    return buildStoryboardBoardModel({
      graphData,
      graphRevision,
    })
  }, [graphData, graphRevision])
  const laneCount = board.lanes.length
  const mediaCount = board.lanes.reduce((sum, lane) => sum + lane.cards.filter(card => card.media !== null).length, 0)
  const referenceCount = board.lanes.reduce((sum, lane) => sum + lane.cards.reduce((laneSum, card) => laneSum + card.references.length, 0), 0)

  return (
    <section className={['relative flex h-full w-full flex-col overflow-hidden', UI_THEME_TOKENS.panel.bg].join(' ')} aria-label="Storyboard canvas">
      <header className={['flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3', UI_THEME_TOKENS.panel.border].join(' ')}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PanelsTopLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <h2 className={['m-0 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>Storyboard</h2>
            <span className={['inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
              {board.totalCards}
            </span>
          </div>
          <p className={['m-0 mt-1 text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>
            Native storyboard board derived from the active graph and shaped with the shared kanban system.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={['inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
            <Hash className="h-3 w-3" aria-hidden="true" />
            {laneCount} lanes
          </span>
          <span className={['inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
            <ImageIcon className="h-3 w-3" aria-hidden="true" />
            {mediaCount} media
          </span>
          <span className={['inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
            <Link2 className="h-3 w-3" aria-hidden="true" />
            {referenceCount} refs
          </span>
          <span className={['hidden text-[10px] sm:inline font-mono', UI_THEME_TOKENS.text.tertiary].join(' ')} title={board.semanticKey}>
            {board.semanticKey ? board.semanticKey.slice(0, 10) : 'empty'}
          </span>
        </div>
      </header>

      {board.totalCards > 0 ? (
        <section className="flex-1 overflow-x-auto overflow-y-hidden p-4" aria-label="Storyboard lanes">
          <div className="flex h-full min-w-fit items-start gap-4">
            {board.lanes.map(lane => (
              <section
                key={lane.id}
                className={[
                  'flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border shadow-sm',
                  UI_THEME_TOKENS.panel.border,
                  UI_THEME_TOKENS.kanban.groupBg,
                ].join(' ')}
                aria-label={`Storyboard lane ${readMarkdownSigilDisplayText(lane.label)}`}
              >
                <header className={['sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-3 backdrop-blur-sm', UI_THEME_TOKENS.panel.divider, UI_THEME_TOKENS.kanban.groupBg].join(' ')}>
                  <div className="min-w-0">
                    <h3 className={['m-0 text-sm font-medium truncate', UI_THEME_TOKENS.text.primary].join(' ')} title={readMarkdownSigilDisplayText(lane.label)}>
                      {renderMarkdownSigilInlineText(lane.label)}
                    </h3>
                    <p className={['m-0 mt-1 text-[11px]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                      {lane.cards.length} storyboard cards
                    </p>
                  </div>
                  <span className={['inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
                    {lane.cards.length}
                  </span>
                </header>

                <ol className="flex-1 space-y-3 overflow-y-auto p-3 list-none m-0" aria-label={`${readMarkdownSigilDisplayText(lane.label)} cards`}>
                  {lane.cards.map((card, cardIndex) => {
                    const selected = selectedNodeId === card.id
                    const displayTitle = readMarkdownSigilDisplayText(card.title)
                    const displaySummary = readMarkdownSigilDisplayText(card.summary)
                    const displayIndex = card.indexLabel || String(cardIndex + 1)
                    const displayMedia = resolveStoryboardDisplayMedia(card)
                    return (
                      <li key={card.id} className="list-none">
                        <article
                          className={[
                            'group overflow-hidden rounded-2xl border bg-white shadow-sm transition-transform duration-150',
                            UI_THEME_TOKENS.kanban.cardHoverBg,
                            selected ? 'border-black/30 ring-1 ring-black/10' : UI_THEME_TOKENS.panel.border,
                            'hover:-translate-y-[1px]',
                          ].join(' ')}
                        >
                          <button
                            type="button"
                            className="block w-full text-left"
                            onClick={() => {
                              selectNode(card.id)
                            }}
                            aria-pressed={selected}
                            aria-label={`Select storyboard card ${displayTitle}`}
                          >
                            <div className="border-b border-black/5 px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex items-center gap-2">
                                    <span className="inline-flex min-w-[2rem] items-center justify-center rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-[10px] font-semibold text-black/70">
                                      {displayIndex}
                                    </span>
                                    <DataViewTagChip value={card.typeLabel} />
                                    <DataViewStatusChip value={card.lane} checked={selected} hideIcon />
                                  </div>
                                  <h4 className={['m-0 truncate text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')} title={displayTitle}>
                                    {renderMarkdownSigilInlineText(card.title)}
                                  </h4>
                                  {card.slugline ? (
                                    <p className={['m-0 mt-1 text-[11px] uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                      {renderMarkdownSigilInlineText(card.slugline)}
                                    </p>
                                  ) : null}
                                </div>
                                {displayMedia?.kind === 'video' ? (
                                  <Video className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                                ) : displayMedia ? (
                                  <ImageIcon className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                                ) : null}
                              </div>
                            </div>

                            <div className={['aspect-[16/9] overflow-hidden border-b border-black/5', selected ? 'bg-black/10' : 'bg-black/5'].join(' ')}>
                              <StoryboardMediaPreview title={displayTitle} href={card.href} media={displayMedia} />
                            </div>

                            <div className="space-y-3 px-3 py-3">
                              {card.summary ? (
                                <div>
                                  <p className={['m-0 text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                    Summary
                                  </p>
                                  <p className={['m-0 mt-1 text-xs leading-5', UI_THEME_TOKENS.text.secondary].join(' ')} title={displaySummary}>
                                    {renderMarkdownSigilInlineText(card.summary)}
                                  </p>
                                </div>
                              ) : null}

                              <StoryboardDetailRow
                                icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
                                label="Action"
                                value={card.action}
                              />
                              <StoryboardDetailRow
                                icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />}
                                label="Dialogue"
                                value={card.dialogue}
                              />

                              {card.prompt || card.style || card.references.length > 0 ? (
                                <section className="rounded-xl border border-black/5 bg-black/[0.025] p-2.5" aria-label="Visual brief">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className={['h-3.5 w-3.5 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')} aria-hidden="true" />
                                      <span className={['text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                        Visual Brief
                                      </span>
                                    </div>
                                    {card.style ? <DataViewTagChip value={card.style} /> : null}
                                  </div>
                                  {card.prompt ? (
                                    <p className={['m-0 mt-2 text-xs leading-5', UI_THEME_TOKENS.text.secondary].join(' ')}>
                                      {renderMarkdownSigilInlineText(card.prompt)}
                                    </p>
                                  ) : null}
                                  <div className="mt-2 flex items-center gap-2">
                                    {card.references.length > 0 ? (
                                      <span className={['inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>
                                        <ImageIcon className="h-3 w-3" aria-hidden="true" />
                                        {card.references.length} refs
                                      </span>
                                    ) : null}
                                    {card.href ? (
                                      <a
                                        href={card.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={['inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary].join(' ')}
                                        onClick={event => {
                                          event.stopPropagation()
                                        }}
                                        title={card.href}
                                      >
                                        <Wand2 className="h-3 w-3" aria-hidden="true" />
                                        Open brief
                                      </a>
                                    ) : null}
                                  </div>
                                </section>
                              ) : null}

                              <StoryboardReferenceStrip cardId={card.id} references={card.references} />

                              {card.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {card.tags.slice(0, 4).map(tag => (
                                    <DataViewTagChip key={`${card.id}:tag:${tag}`} value={tag} />
                                  ))}
                                </div>
                              ) : null}

                              {card.meta.length > 0 ? (
                                <div className={['flex flex-wrap gap-1 text-[11px]', UI_THEME_TOKENS.text.tertiary].join(' ')}>
                                  {card.meta.map(item => (
                                    <span key={`${card.id}:meta:${item}`} className={['rounded px-2 py-1', UI_THEME_TOKENS.badge.chip].join(' ')}>
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              ) : null}

                              {card.href ? (
                                <div className="flex items-center justify-end">
                                  <a
                                    href={card.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={['inline-flex max-w-full items-center gap-1 text-xs underline underline-offset-2', UI_THEME_TOKENS.text.secondary].join(' ')}
                                    onClick={event => {
                                      event.stopPropagation()
                                    }}
                                    title={card.href}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span className="truncate">Open source</span>
                                  </a>
                                </div>
                              ) : null}
                            </div>
                          </button>
                        </article>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex flex-1 items-center justify-center p-6" aria-label="Storyboard empty state">
          <div className="max-w-md text-center">
            <PanelsTopLeft className="mx-auto h-8 w-8" aria-hidden="true" />
            <h3 className={['mb-2 mt-3 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>No storyboard cards yet</h3>
            <p className={['m-0 text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>
              Add scene-like nodes, stage fields, summaries, script beats, prompts, or media references to project the active graph into storyboard lanes.
            </p>
          </div>
        </section>
      )}
    </section>
  )
}
