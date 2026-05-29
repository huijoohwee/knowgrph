import React from 'react'
import { Clapperboard, Film, LocateFixed, Play, RefreshCw } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import { generateRunVideoWithBytePlus } from '@/features/chat/byteplusRunGeneration'
import { CHAT_PROVIDER_BYTEPLUS, getChatDefaultEndpointUrlForProvider, normalizeChatProviderId } from '@/lib/chatEndpoint'
import { getStrybldrImageFile } from './strybldrImageFileRegistry'
import { buildStrybldrVideoHandoffFromGraphData, buildStrybldrVideoHandoffMarkdown, mergeStrybldrElementsIntoGraphData } from './strybldrStoryboard'
import { runStrybldrDetrObjectDetection } from './strybldrLocalVision'

const readString = (value: unknown): string => String(value ?? '').trim()

const readStrybldrSourceUnitIds = (graphData: ReturnType<typeof useGraphStore.getState>['graphData']): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  for (const node of Array.isArray(graphData?.nodes) ? graphData.nodes : []) {
    const props = node.properties || {}
    const id = readString(props.strybldrSourceUnitId)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function StorybldrFloatingPanelView() {
  const {
    graphData,
    graphDataRevision,
    setCanvasRenderMode,
    setCanvas2dRenderer,
    setFloatingPanelView,
    setGraphDataPreservingLayout,
    pushUiToast,
    addHistory,
    chatProvider,
    chatEndpointUrl,
    chatApiKey,
    chatAuthMode,
  } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      graphDataRevision: s.graphDataRevision,
      setCanvasRenderMode: s.setCanvasRenderMode,
      setCanvas2dRenderer: s.setCanvas2dRenderer,
      setFloatingPanelView: s.setFloatingPanelView,
      setGraphDataPreservingLayout: s.setGraphDataPreservingLayout,
      pushUiToast: s.pushUiToast,
      addHistory: s.addHistory,
      chatProvider: s.chatProvider,
      chatEndpointUrl: s.chatEndpointUrl,
      chatApiKey: s.chatApiKey,
      chatAuthMode: s.chatAuthMode,
    })),
  )
  const [running, setRunning] = React.useState(false)
  const [videoRunning, setVideoRunning] = React.useState(false)
  const board = React.useMemo(() => buildStoryboardBoardModel({ graphData, graphRevision: graphDataRevision }), [graphData, graphDataRevision])
  const sourceUnitIds = React.useMemo(() => readStrybldrSourceUnitIds(graphData), [graphData])
  const availableSourceUnitId = sourceUnitIds.find(id => !!getStrybldrImageFile(id)) || ''

  const runLocalAnalysis = React.useCallback(async () => {
    if (!graphData || !availableSourceUnitId) {
      pushUiToast({
        id: 'strybldr:local-analysis:missing',
        kind: 'warning',
        message: 'Import an image in this session before running local analysis.',
      })
      return
    }
    const registered = getStrybldrImageFile(availableSourceUnitId)
    if (!registered) return
    setRunning(true)
    try {
      const elements = await runStrybldrDetrObjectDetection({
        input: registered.file,
        sourceUnitId: availableSourceUnitId,
        threshold: 0.45,
      })
      if (elements.length === 0) {
        pushUiToast({
          id: 'strybldr:local-analysis:none',
          kind: 'warning',
          message: 'No local objects detected.',
        })
        return
      }
      addHistory('Storybldr local analysis')
      setGraphDataPreservingLayout(mergeStrybldrElementsIntoGraphData({ graphData, elements }))
      pushUiToast({
        id: 'strybldr:local-analysis:done',
        kind: 'success',
        message: `Detected ${elements.length} storyboard element(s).`,
      })
    } catch (e) {
      pushUiToast({
        id: 'strybldr:local-analysis:error',
        kind: 'error',
        message: `Storybldr analysis failed: ${String((e as { message?: unknown })?.message ?? e)}`,
        dismissible: true,
      })
    } finally {
      setRunning(false)
    }
  }, [addHistory, availableSourceUnitId, graphData, pushUiToast, setGraphDataPreservingLayout])

  const runVideoHandoff = React.useCallback(async () => {
    const handoff = buildStrybldrVideoHandoffFromGraphData(graphData)
    if (handoff.cards.length === 0 || !handoff.prompt) {
      pushUiToast({ id: 'strybldr:video:empty', kind: 'warning', message: 'No approved Storybldr cards to send.' })
      return
    }
    const started = performance.now()
    const provider = normalizeChatProviderId(chatProvider)
    let paidCallCount = 0
    let status: 'generated' | 'fallback' = 'fallback'
    let model: string | null = null
    let renderUrl: string | null = null
    let sourceUrl: string | null = null
    let errorReason: string | null = null
    setVideoRunning(true)
    try {
      if (provider !== CHAT_PROVIDER_BYTEPLUS) {
        errorReason = 'BytePlus ModelArk is not the active provider.'
      } else {
        paidCallCount = 1
        const asset = await generateRunVideoWithBytePlus({
          config: {
            provider,
            endpointUrl: chatEndpointUrl || getChatDefaultEndpointUrlForProvider(provider),
            apiKey: chatAuthMode === 'byok' ? chatApiKey : null,
          },
          prompt: handoff.prompt,
          options: {
            referenceImageUrl: handoff.referenceImageUrl,
          },
        })
        if (asset) {
          status = 'generated'
          model = asset.model
          renderUrl = asset.renderUrl
          sourceUrl = asset.sourceUrl || null
        } else {
          errorReason = 'BytePlus returned no video asset.'
        }
      }
    } catch (e) {
      errorReason = String((e as { message?: unknown })?.message ?? e)
    }
    try {
      const fs = await getWorkspaceFs()
      await fs.ensureSeed()
      await fs.createFile({
        parentPath: WORKSPACE_ROOT_PATH,
        name: `${status === 'generated' ? 'storybldr-video' : 'storybldr-video-fallback'}-${Date.now().toString(36)}.md`,
        text: buildStrybldrVideoHandoffMarkdown({
          handoff,
          status,
          provider,
          model,
          renderUrl,
          sourceUrl,
          errorReason,
          elapsedMs: performance.now() - started,
          paidCallCount,
          cacheHit: false,
        }),
      })
      addHistory(status === 'generated' ? 'Storybldr video generated' : 'Storybldr video fallback')
      pushUiToast({
        id: 'strybldr:video:done',
        kind: status === 'generated' ? 'success' : 'warning',
        message: status === 'generated' ? 'Storybldr video handoff saved.' : 'Storybldr fallback artifact saved.',
        dismissible: status !== 'generated',
      })
    } catch (e) {
      pushUiToast({
        id: 'strybldr:video:write-error',
        kind: 'error',
        message: `Storybldr handoff save failed: ${String((e as { message?: unknown })?.message ?? e)}`,
        dismissible: true,
      })
    } finally {
      setVideoRunning(false)
    }
  }, [addHistory, chatApiKey, chatAuthMode, chatEndpointUrl, chatProvider, graphData, pushUiToast])

  return (
    <section className="h-full flex flex-col" aria-label="Storybldr panel">
      <header className={cn('flex items-center justify-between gap-2 px-1 py-1', UI_THEME_TOKENS.panel.divider)}>
        <div className="flex min-w-0 items-center gap-2">
          <Film className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden={true} />
          <div className="min-w-0 text-xs font-semibold">Storybldr</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
            title="Switch to Storybldr Mode"
            onClick={() => {
              setCanvasRenderMode('2d')
              setCanvas2dRenderer('storybldr')
              setFloatingPanelView('storybldr')
            }}
          >
            <LocateFixed className="h-4 w-4" strokeWidth={1.7} aria-hidden={true} />
          </button>
          <button
            type="button"
            className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
            title="Analyze locally"
            disabled={running || videoRunning || !availableSourceUnitId}
            onClick={() => {
              void runLocalAnalysis()
            }}
          >
            {running ? <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={1.7} aria-hidden={true} /> : <Play className="h-4 w-4" strokeWidth={1.7} aria-hidden={true} />}
          </button>
          <button
            type="button"
            className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
            title="Generate Video"
            disabled={running || videoRunning || board.totalCards < 1}
            onClick={() => {
              void runVideoHandoff()
            }}
          >
            {videoRunning ? <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={1.7} aria-hidden={true} /> : <Clapperboard className="h-4 w-4" strokeWidth={1.7} aria-hidden={true} />}
          </button>
        </div>
      </header>
      <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-2">
        {board.totalCards < 1 ? (
          <div className={cn('py-3 text-xs', UI_THEME_TOKENS.text.secondary)}>No Storybldr graph loaded.</div>
        ) : (
          <div className="space-y-2 py-1">
            {board.lanes.map(lane => (
              <section key={lane.id} className="space-y-1" aria-label={lane.label}>
                <div className={cn('text-[11px] font-semibold uppercase tracking-normal', UI_THEME_TOKENS.text.tertiary)}>
                  {lane.label}
                </div>
                {lane.cards.map(card => (
                  <article key={card.id} className={cn('rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.headerBg)}>
                    <div className="min-w-0 text-xs font-semibold">{card.title}</div>
                    {card.summary ? <p className={cn('mt-1 text-xs', UI_THEME_TOKENS.text.secondary)}>{card.summary}</p> : null}
                    {card.prompt ? <p className={cn('mt-1 text-[11px]', UI_THEME_TOKENS.text.tertiary)}>{card.prompt}</p> : null}
                  </article>
                ))}
              </section>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
