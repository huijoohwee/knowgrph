import React from 'react'
import { Eye, SlidersHorizontal, SquareTerminal, type LucideIcon } from 'lucide-react'
import {
  useAgenticOsRemoteGrammarCatalog,
  type AgenticOsRemoteGrammarCatalogEntry,
  type AgenticOsRemoteGrammarSigil,
} from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import {
  FLOATING_PANEL_CATALOG_THREE_ROW_LAYOUT,
  floatingPanelCatalogThreeRowClassName,
  floatingPanelCatalogThreeRowThumbnailFrameClassName,
} from '@/lib/ui/floatingPanelCatalogLayout'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { UI_INLINE_CHIP_GROUP_CLASSNAME } from '@/lib/ui/textLayout'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { inspectLocalCamera } from './cameraMcpRuntime'

const CAMERA_GRAMMAR_SIGILS: readonly AgenticOsRemoteGrammarSigil[] = ['/', '#', '@']
const CAMERA_TOKEN_LIMIT = 12

type CameraCatalogCardProps = {
  Icon: LucideIcon
  title: string
  description: string
  metadata: string
  footer: React.ReactNode
  dataAttributes?: Record<`data-${string}`, string | undefined>
}

const cameraCatalogEntryText = (entry: AgenticOsRemoteGrammarCatalogEntry): string => [
  entry.token,
  entry.label,
  entry.summary,
  entry.intent,
  ...(entry.keywords || []),
].join(' ').toLowerCase()

const cameraCatalogEntrySigilOrder = (entry: AgenticOsRemoteGrammarCatalogEntry): number => {
  const index = CAMERA_GRAMMAR_SIGILS.indexOf(entry.token[0] as AgenticOsRemoteGrammarSigil)
  return index < 0 ? CAMERA_GRAMMAR_SIGILS.length : index
}

function CameraCatalogCard({
  Icon,
  title,
  description,
  metadata,
  footer,
  dataAttributes,
}: CameraCatalogCardProps) {
  const invocationTitle = /^[#/@]/.test(title)
  return (
    <article
      className={floatingPanelCatalogThreeRowClassName('cursor-default')}
      data-kg-camera-card-layout={FLOATING_PANEL_CATALOG_THREE_ROW_LAYOUT}
      {...dataAttributes}
    >
      <span
        className={floatingPanelCatalogThreeRowThumbnailFrameClassName('items-center justify-center')}
        role="img"
        aria-label={`${title} Camera runtime card`}
      >
        <Icon className={cn('size-7', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.6} aria-hidden />
      </span>
      <section className="grid min-w-0 grid-rows-[auto_auto_auto] gap-1" aria-label={`${title} Camera runtime summary`}>
        <header className="flex min-w-0 items-center justify-between gap-2" data-kg-floating-panel-card-row="title">
          <h4
            className={cn(invocationTitle ? UI_INLINE_CHIP_GROUP_CLASSNAME : 'truncate', 'text-xs font-semibold')}
            title={title}
            data-kg-camera-invocation-chip-renderer={invocationTitle ? 'shared-markdown-sigil' : undefined}
          >
            {renderMarkdownSigilInlineText(title)}
          </h4>
        </header>
        <section className="grid min-w-0 gap-0.5" data-kg-floating-panel-card-row="meta">
          <p className={cn('m-0 line-clamp-2 text-[11px]', UI_THEME_TOKENS.text.secondary)} title={description}>{description}</p>
          <p className={cn('m-0 truncate text-[10px] uppercase tracking-wide', UI_THEME_TOKENS.text.tertiary)} title={metadata}>{metadata}</p>
        </section>
        <footer className="flex min-w-0 items-center gap-1 overflow-hidden" data-kg-floating-panel-card-row="description">{footer}</footer>
      </section>
    </article>
  )
}

function CameraInvocationTokenCard({ entry }: { entry: AgenticOsRemoteGrammarCatalogEntry }) {
  const source = entry.sourceUrl || entry.sourcePath || entry.fileName || 'Agentic Canvas OS dictionary'
  const kind = String(entry.kind || 'invocation').trim() || 'invocation'
  return (
    <CameraCatalogCard
      Icon={SquareTerminal}
      title={entry.token}
      description={entry.summary || entry.intent || entry.label || 'Canonical Camera invocation token.'}
      metadata={`${kind} · ${entry.label || 'Camera'}`}
      footer={<code className={cn('block min-w-0 truncate text-[9px]', UI_THEME_TOKENS.text.tertiary)} title={source}>{source}</code>}
      dataAttributes={{
        'data-kg-camera-invocation-token': entry.token,
        'data-kg-camera-invocation-kind': kind,
        'data-kg-camera-invocation-source': source,
      }}
    />
  )
}

export function CameraMcpInvocationSection() {
  const grammar = useAgenticOsRemoteGrammarCatalog({ sigils: CAMERA_GRAMMAR_SIGILS })
  const camera = inspectLocalCamera()
  const cameraEntries = React.useMemo(() => grammar.entries
    .filter(entry => cameraCatalogEntryText(entry).includes('camera'))
    .sort((left, right) => cameraCatalogEntrySigilOrder(left) - cameraCatalogEntrySigilOrder(right) || left.token.localeCompare(right.token))
    .slice(0, CAMERA_TOKEN_LIMIT), [grammar.entries])

  return (
    <section
      className="grid gap-2"
      aria-label="Camera WebMCP and invocation catalog"
      data-kg-camera-webmcp-invocations="1"
      data-kg-camera-grammar-status={grammar.hydration.status}
      data-kg-camera-grammar-revision={grammar.sourceRevision || undefined}
    >
      <section className="grid gap-1" aria-label="Camera WebMCP tools">
        <CameraCatalogCard
          Icon={Eye}
          title="Inspect Local Camera"
          description="Read shared framing, XR motion, panel, and BottomPanel Timeline state without mutation."
          metadata="WebMCP · read-only"
          footer={<code className="block min-w-0 truncate text-[9px]" title={camera.webMcpTools.inspect}>{camera.webMcpTools.inspect}</code>}
          dataAttributes={{ 'data-kg-camera-webmcp-tool': camera.webMcpTools.inspect }}
        />
        <CameraCatalogCard
          Icon={SlidersHorizontal}
          title="Control Local Camera"
          description="Frame, apply subject-bound moves, play, pause, and scrub through structured input or canonical invocation tokens."
          metadata="WebMCP · local mutation"
          footer={<code className="block min-w-0 truncate text-[9px]" title={camera.webMcpTools.control}>{camera.webMcpTools.control}</code>}
          dataAttributes={{ 'data-kg-camera-webmcp-tool': camera.webMcpTools.control }}
        />
      </section>

      <section className="grid gap-1" aria-label="Canonical Camera invocation tokens">
        {cameraEntries.length > 0 ? cameraEntries.map(entry => <CameraInvocationTokenCard key={entry.token} entry={entry} />) : (
          <p className={cn('m-0 rounded border px-2 py-1 text-[10px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.tertiary)}>
            Camera `/`, `#`, and `@` tokens are {grammar.hydration.status === 'loading' ? 'loading from' : 'resolved by'} the Agentic Canvas OS dictionaries.
          </p>
        )}
      </section>
    </section>
  )
}
