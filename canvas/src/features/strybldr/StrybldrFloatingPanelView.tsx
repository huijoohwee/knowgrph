import React from 'react'
import { Check, Clapperboard, Film, Heart, LocateFixed, Lock, Play, RefreshCw, Wand2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME, UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME, UI_RESPONSIVE_STORYBOARD_FILTER_ACTION_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { cn } from '@/lib/utils'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import type { JSONValue } from '@/lib/graph/types'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { notifyWorkspaceFsChanged } from '@/features/workspace-fs/workspaceFsEvents'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import { BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS, generateRunVideoWithBytePlus } from '@/features/chat/byteplusRunGeneration'
import { CHAT_PROVIDER_BYTEPLUS, getChatDefaultEndpointUrlForProvider, normalizeChatProviderId } from '@/lib/chatEndpoint'
import { WORKFLOW_RUN_ALL_EVENT } from '@/features/canvas/utils'
import { getStrybldrImageFile } from './strybldrImageFileRegistry'
import { buildStrybldrVideoHandoffFromGraphData, buildStrybldrVideoHandoffMarkdown, mergeStrybldrElementsIntoGraphData } from './strybldrStoryboard'
import type { StrybldrElement } from './strybldrTypes'
import { runStrybldrDetrObjectDetection } from './strybldrLocalVision'
import {
  createStrytreeCandidateRunAction,
  createStrytreeContinuationDraftAction,
  toggleStrytreeLikeAction,
  unlockStrytreeNodeAction,
  type StrytreeWorkflowResult,
} from './strytreeWorkflow'

const readString = (value: unknown): string => String(value ?? '').trim()
const LOCAL_ANALYSIS_SOURCE_TIMEOUT_MS = 12000
const LOCAL_ANALYSIS_DETR_BATCH_BYTE_LIMIT = 8 * 1024 * 1024
const VIDEO_HANDOFF_PROVIDER_TIMEOUT_MS = BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS + 60000
const STRYBLDR_RUN_ALL_DEDUPE_WINDOW_MS = 1000
const STRYTREE_PANEL_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'hot', label: 'Hot' },
  { id: 'active', label: 'Active' },
  { id: 'protected', label: 'Protected' },
  { id: 'draft', label: 'Draft' },
  { id: 'dropped', label: 'Dropped' },
] as const
export const STRYBLDR_STORYTREE_ACTION_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-4'
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

const runStrybldrDetectionWithTimeout = (promise: Promise<StrybldrElement[]>, timeoutMs: number, message: string): Promise<StrybldrElement[]> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return Promise.race([
    promise,
    new Promise<StrybldrElement[]>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

const runStrybldrProviderWithTimeout = <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

const readBoolean = (value: unknown): boolean => value === true || String(value || '').trim().toLowerCase() === 'true'

const storytreeCardMatchesPanelFilter = (card: ReturnType<typeof buildStoryboardBoardModel>['lanes'][number]['cards'][number], filter: string): boolean => {
  if (filter === 'all') return true
  const tags = card.tags.map(tag => tag.toLowerCase())
  if (filter === 'protected') return tags.includes('protected') || tags.includes('unlock-ready') || tags.includes('unlock-needs-credits')
  return tags.includes(filter)
}

export function StrybldrFloatingPanelView({
  runAllRequestSeq,
}: {
  runAllRequestSeq?: number
} = {}) {
  const {
    graphData: rawGraphData,
    graphDataRevision,
    canvas2dRenderer,
    setCanvasRenderMode,
    setCanvas2dRenderer,
    setFloatingPanelView,
    setGraphDataPreservingLayout,
    updateNode,
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
      canvas2dRenderer: s.canvas2dRenderer,
      setCanvasRenderMode: s.setCanvasRenderMode,
      setCanvas2dRenderer: s.setCanvas2dRenderer,
      setFloatingPanelView: s.setFloatingPanelView,
      setGraphDataPreservingLayout: s.setGraphDataPreservingLayout,
      updateNode: s.updateNode,
      pushUiToast: s.pushUiToast,
      addHistory: s.addHistory,
      chatProvider: s.chatProvider,
      chatEndpointUrl: s.chatEndpointUrl,
      chatApiKey: s.chatApiKey,
      chatAuthMode: s.chatAuthMode,
    })),
  )
  const activeGraphData = useActiveGraphRenderData(true)
  const graphData = activeGraphData || rawGraphData
  const [running, setRunning] = React.useState(false)
  const [videoRunning, setVideoRunning] = React.useState(false)
  const lastRunAllAtRef = React.useRef(0)
  const lastMountedRunAllRequestSeqRef = React.useRef<number | undefined>(undefined)
  const [selectedCardId, setSelectedCardId] = React.useState('')
  const [selectedStorytreeCardId, setSelectedStorytreeCardId] = React.useState('')
  const [storytreePanelFilter, setStorytreePanelFilter] = React.useState('all')
  const [draft, setDraft] = React.useState({ title: '', summary: '', action: '', prompt: '', order: '' })
  const board = React.useMemo(() => buildStoryboardBoardModel({ graphData, graphRevision: graphDataRevision }), [graphData, graphDataRevision])
  const sourceUnitIds = React.useMemo(() => readStrybldrSourceUnitIds(graphData), [graphData])
  const availableSourceUnitIds = React.useMemo(() => sourceUnitIds.filter(id => !!getStrybldrImageFile(id)), [sourceUnitIds])
  const cards = React.useMemo(() => board.lanes.flatMap(lane => lane.cards), [board])
  const editableCards = React.useMemo(() => {
    const elementCards = cards.filter(card => card.lane === 'Elements')
    return elementCards.length > 0 ? elementCards : cards
  }, [cards])
  const storytreeCards = React.useMemo(() => cards.filter(card => card.lane === 'Storytree'), [cards])
  const visibleStorytreeCards = React.useMemo(() => {
    return storytreeCards.filter(card => storytreeCardMatchesPanelFilter(card, storytreePanelFilter))
  }, [storytreeCards, storytreePanelFilter])
  const selectedCard = React.useMemo(
    () => editableCards.find(card => card.id === selectedCardId) || editableCards[0] || null,
    [editableCards, selectedCardId],
  )
  const selectedStorytreeCard = React.useMemo(
    () => visibleStorytreeCards.find(card => card.id === selectedStorytreeCardId) || visibleStorytreeCards[0] || storytreeCards[0] || null,
    [selectedStorytreeCardId, storytreeCards, visibleStorytreeCards],
  )
  const selectedCardSignature = selectedCard
    ? [selectedCard.id, selectedCard.title, selectedCard.summary, selectedCard.action, selectedCard.prompt, String(selectedCard.order)].join('\u0000')
    : ''

  React.useEffect(() => {
    if (selectedCard?.id && selectedCard.id !== selectedCardId) setSelectedCardId(selectedCard.id)
  }, [selectedCard?.id, selectedCardId])

  React.useEffect(() => {
    if (selectedStorytreeCard?.id && selectedStorytreeCard.id !== selectedStorytreeCardId) setSelectedStorytreeCardId(selectedStorytreeCard.id)
  }, [selectedStorytreeCard?.id, selectedStorytreeCardId])

  React.useEffect(() => {
    if (!selectedCard) return
    setDraft({
      title: selectedCard.title,
      summary: selectedCard.summary,
      action: selectedCard.action,
      prompt: selectedCard.prompt,
      order: String(selectedCard.order),
    })
  }, [selectedCardSignature, selectedCard])

  const runLocalAnalysis = React.useCallback(async () => {
    if (!graphData || availableSourceUnitIds.length === 0) {
      pushUiToast({
        id: 'strybldr:local-analysis:missing',
        kind: 'warning',
        message: 'Import an image in this session before running local analysis.',
      })
      return
    }
    setRunning(true)
    try {
      const registeredSources = availableSourceUnitIds
        .map((sourceUnitId, sourceIndex) => ({ sourceUnitId, sourceIndex, registered: getStrybldrImageFile(sourceUnitId) }))
        .filter((item): item is { sourceUnitId: string; sourceIndex: number; registered: NonNullable<ReturnType<typeof getStrybldrImageFile>> } => !!item.registered)
      const totalBytes = registeredSources.reduce((sum, item) => sum + Math.max(0, Number(item.registered.file.size || 0)), 0)
      if (registeredSources.length > 1 && totalBytes > LOCAL_ANALYSIS_DETR_BATCH_BYTE_LIMIT) {
        addHistory('Strybldr local analysis fallback')
        setGraphDataPreservingLayout(mergeStrybldrElementsIntoGraphData({ graphData, elements: [] }))
        pushUiToast({
          id: 'strybldr:local-analysis:batch-fallback',
          kind: 'warning',
          message: `Large image batch kept ${board.totalCards} existing Strybldr card(s); select one image to run DETR locally.`,
          dismissible: true,
        })
        return
      }
      const elements: StrybldrElement[] = []
      const failures: string[] = []
      for (const { sourceIndex, sourceUnitId, registered } of registeredSources) {
        try {
          const detected = await runStrybldrDetectionWithTimeout(
            runStrybldrDetrObjectDetection({
              input: registered.file,
              sourceUnitId,
              threshold: 0.45,
            }),
            LOCAL_ANALYSIS_SOURCE_TIMEOUT_MS,
            `Local DETR timed out for ${registered.file.name || sourceUnitId}.`,
          )
          elements.push(
            ...detected.map((element, elementIndex) => ({
              ...element,
              order: sourceIndex * 100 + 2 + elementIndex,
            })),
          )
        } catch (e) {
          const message = String((e as { message?: unknown })?.message ?? e)
          failures.push(message)
          if (/timed out/i.test(message)) break
        }
      }
      if (elements.length === 0) {
        pushUiToast({
          id: 'strybldr:local-analysis:none',
          kind: 'warning',
          message: failures.length > 0
            ? `Local analysis kept existing cards after ${failures.length} failed source(s).`
            : 'No local objects detected; existing source cards remain available.',
          dismissible: failures.length > 0,
        })
        return
      }
      addHistory('Strybldr local analysis')
      setGraphDataPreservingLayout(mergeStrybldrElementsIntoGraphData({ graphData, elements }))
      pushUiToast({
        id: 'strybldr:local-analysis:done',
        kind: failures.length > 0 ? 'warning' : 'success',
        message: `Detected ${elements.length} storyboard element(s) from ${registeredSources.length - failures.length}/${registeredSources.length} source image(s).`,
        dismissible: failures.length > 0,
      })
    } catch (e) {
      pushUiToast({
        id: 'strybldr:local-analysis:error',
        kind: 'error',
        message: `Strybldr analysis failed: ${String((e as { message?: unknown })?.message ?? e)}`,
        dismissible: true,
      })
    } finally {
      setRunning(false)
    }
  }, [addHistory, availableSourceUnitIds, board.totalCards, graphData, pushUiToast, setGraphDataPreservingLayout])

  const saveSelectedCardUpdate = React.useCallback(() => {
    if (!graphData || !selectedCard) return
    const currentNode = (Array.isArray(graphData.nodes) ? graphData.nodes : []).find(node => node.id === selectedCard.id) || null
    const currentProps = currentNode?.properties && typeof currentNode.properties === 'object' && !Array.isArray(currentNode.properties)
      ? currentNode.properties as Record<string, JSONValue>
      : {}
    const order = Number(draft.order)
    const title = readString(draft.title) || selectedCard.title
    const nextProps: Record<string, JSONValue> = {
      ...currentProps,
      title,
      summary: readString(draft.summary),
      action: readString(draft.action),
      prompt: readString(draft.prompt),
      order: Number.isFinite(order) ? order : selectedCard.order,
      evidenceKind: 'user-edit',
      strybldrUserApprovedAtMs: Date.now(),
    }
    updateNode(selectedCard.id, {
      label: title,
      properties: nextProps,
    })
    addHistory('Strybldr card update')
    pushUiToast({
      id: 'strybldr:card:update',
      kind: 'success',
      message: 'Strybldr card updated.',
    })
  }, [addHistory, draft.action, draft.order, draft.prompt, draft.summary, draft.title, graphData, pushUiToast, selectedCard, updateNode])

  const commitStrytreeResult = React.useCallback((result: StrytreeWorkflowResult, history: string) => {
    if (result.changed) {
      setGraphDataPreservingLayout(result.graphData)
      addHistory(history)
      if (result.createdNodeId) setSelectedStorytreeCardId(result.createdNodeId)
    }
    pushUiToast({
      id: `strybldr:${history.toLowerCase().replace(/\s+/g, '-')}`,
      kind: result.kind,
      message: result.message,
      dismissible: result.kind !== 'success',
    })
  }, [addHistory, pushUiToast, setGraphDataPreservingLayout])

  const likeSelectedStorytreeCard = React.useCallback(() => {
    if (!graphData || !selectedStorytreeCard) return
    commitStrytreeResult(toggleStrytreeLikeAction(graphData, selectedStorytreeCard.id), 'Strybldr storytree like')
  }, [commitStrytreeResult, graphData, selectedStorytreeCard])

  const unlockSelectedStorytreeCard = React.useCallback(() => {
    if (!graphData || !selectedStorytreeCard) return
    commitStrytreeResult(unlockStrytreeNodeAction(graphData, selectedStorytreeCard.id), 'Strybldr storytree unlock')
  }, [commitStrytreeResult, graphData, selectedStorytreeCard])

  const draftSelectedStorytreeContinuation = React.useCallback(() => {
    if (!graphData || !selectedStorytreeCard) return
    commitStrytreeResult(
      createStrytreeContinuationDraftAction(graphData, selectedStorytreeCard.id, { prompt: selectedStorytreeCard.prompt }),
      'Strybldr storytree continuation',
    )
  }, [commitStrytreeResult, graphData, selectedStorytreeCard])

  const compareSelectedStorytreeCandidates = React.useCallback(() => {
    if (!graphData || !selectedStorytreeCard) return
    commitStrytreeResult(
      createStrytreeCandidateRunAction(graphData, selectedStorytreeCard.id),
      'Strybldr ForkCompare candidates',
    )
  }, [commitStrytreeResult, graphData, selectedStorytreeCard])

  const runVideoHandoff = React.useCallback(async () => {
    if (videoRunning) return
    const handoff = buildStrybldrVideoHandoffFromGraphData(graphData)
    if (handoff.cards.length === 0 || !handoff.prompt) {
      pushUiToast({ id: 'strybldr:video:empty', kind: 'warning', message: 'No approved Strybldr cards to send.' })
      return
    }
    const started = performance.now()
    const provider = normalizeChatProviderId(chatProvider)
    let artifactProvider: string = provider
    let paidCallCount = 0
    let status: 'generated' | 'copied' | 'fallback' = 'fallback'
    let model: string | null = null
    let renderUrl: string | null = null
    let sourceUrl: string | null = null
    let errorReason: string | null = null
    let copyReason: string | null = null
    const hasLocalAnimatic = !!readString(handoff.localAnimaticHtml)
    setVideoRunning(true)
    try {
      if (provider === CHAT_PROVIDER_BYTEPLUS && !(chatAuthMode === 'byok' && !readString(chatApiKey))) {
        const asset = await runStrybldrProviderWithTimeout(
          generateRunVideoWithBytePlus({
            config: {
              provider,
              endpointUrl: chatEndpointUrl || getChatDefaultEndpointUrlForProvider(provider),
              apiKey: chatAuthMode === 'byok' ? chatApiKey : null,
            },
            prompt: handoff.prompt,
            options: {
              referenceImageUrl: handoff.referenceImageUrl,
            },
          }),
          VIDEO_HANDOFF_PROVIDER_TIMEOUT_MS,
          `BytePlus video generation did not complete within ${VIDEO_HANDOFF_PROVIDER_TIMEOUT_MS}ms.`,
        )
        if (asset) {
          status = 'generated'
          model = asset.model
          renderUrl = asset.renderUrl
          sourceUrl = asset.sourceUrl || null
          paidCallCount = 1
        } else {
          errorReason = 'BytePlus returned no video asset.'
        }
      } else if (hasLocalAnimatic) {
        status = 'generated'
        artifactProvider = 'knowgrph-local-animatic'
        model = 'strybldr-local-animatic-v1'
        sourceUrl = handoff.sourceVideoUrl || null
        renderUrl = handoff.renderVideoUrl || null
        paidCallCount = 0
      } else if (provider !== CHAT_PROVIDER_BYTEPLUS) {
        errorReason = 'BytePlus ModelArk is not the active provider.'
      } else if (chatAuthMode === 'byok' && !readString(chatApiKey)) {
        errorReason = 'BytePlus BYOK API key is not configured.'
      }
    } catch (e) {
      errorReason = String((e as { message?: unknown })?.message ?? e)
    }
    if (status === 'fallback' && handoff.sourceVideoUrl && handoff.renderVideoUrl) {
      status = 'copied'
      sourceUrl = handoff.sourceVideoUrl
      renderUrl = handoff.renderVideoUrl
      copyReason = errorReason
        ? `Provider generation failed; copied the imported source video instead. ${errorReason}`
        : 'Copied the imported source video as the runnable Strybldr video artifact.'
      errorReason = null
    }
    try {
      const fs = await getWorkspaceFs()
      await fs.ensureSeed()
      const createdPath = await fs.createFile({
        parentPath: WORKSPACE_ROOT_PATH,
        name: `${status === 'fallback' ? 'strybldr-video-fallback' : 'strybldr-video'}-${Date.now().toString(36)}.md`,
        text: buildStrybldrVideoHandoffMarkdown({
          handoff,
          status,
          provider: artifactProvider,
          model,
          renderUrl,
          sourceUrl,
          errorReason,
          copyReason,
          elapsedMs: performance.now() - started,
          paidCallCount,
          cacheHit: false,
        }),
      })
      notifyWorkspaceFsChanged({ op: 'createFile', path: createdPath })
      addHistory(status === 'generated' ? 'Strybldr video generated' : status === 'copied' ? 'Strybldr video copied' : 'Strybldr video fallback')
      pushUiToast({
        id: 'strybldr:video:done',
        kind: status === 'fallback' ? 'warning' : 'success',
        message: status === 'generated'
          ? 'Strybldr video handoff saved.'
          : status === 'copied'
            ? 'Strybldr source video copy saved.'
            : 'Strybldr fallback artifact saved.',
        dismissible: status === 'fallback',
      })
    } catch (e) {
      pushUiToast({
        id: 'strybldr:video:write-error',
        kind: 'error',
        message: `Strybldr handoff save failed: ${String((e as { message?: unknown })?.message ?? e)}`,
        dismissible: true,
      })
    } finally {
      setVideoRunning(false)
    }
  }, [addHistory, chatApiKey, chatAuthMode, chatEndpointUrl, chatProvider, graphData, pushUiToast, videoRunning])

  const runAllFromMountedPanel = React.useCallback(() => {
      const now = performance.now()
      if (now - lastRunAllAtRef.current < STRYBLDR_RUN_ALL_DEDUPE_WINDOW_MS) return
      const handoff = buildStrybldrVideoHandoffFromGraphData(graphData)
      if (videoRunning || handoff.cards.length === 0 || !handoff.prompt) {
        void runVideoHandoff()
        return
      }
      lastRunAllAtRef.current = now
      void runVideoHandoff()
  }, [graphData, runVideoHandoff, videoRunning])

  React.useEffect(() => {
    if (typeof runAllRequestSeq !== 'number' || runAllRequestSeq <= 0) return
    if (lastMountedRunAllRequestSeqRef.current === runAllRequestSeq) return
    lastMountedRunAllRequestSeqRef.current = runAllRequestSeq
    runAllFromMountedPanel()
  }, [runAllFromMountedPanel, runAllRequestSeq])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handleRunAll = () => {
      runAllFromMountedPanel()
    }
    window.addEventListener(WORKFLOW_RUN_ALL_EVENT, handleRunAll)
    return () => window.removeEventListener(WORKFLOW_RUN_ALL_EVENT, handleRunAll)
  }, [runAllFromMountedPanel])

  return (
    <section className="h-full flex flex-col" aria-label="Strybldr panel">
      <header className={cn('flex items-center justify-between gap-2 px-1 py-1', UI_THEME_TOKENS.panel.divider)}>
        <section className="flex min-w-0 items-center gap-2">
          <Film className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden={true} />
          <section className="min-w-0 text-xs font-semibold">Strybldr</section>
        </section>
        <section className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
            title="Switch to Strybldr Mode"
            onClick={() => {
              setCanvasRenderMode('2d')
              setCanvas2dRenderer('strybldr')
              setFloatingPanelView('strybldr')
            }}
          >
            <LocateFixed className="h-4 w-4" strokeWidth={1.7} aria-hidden={true} />
          </button>
          <button
            type="button"
            className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
            title="Analyze locally"
            disabled={running || videoRunning || availableSourceUnitIds.length === 0}
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
        </section>
      </header>
      <section className={`${UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME} px-1 pb-2`}>
        {board.totalCards < 1 ? (
          <section className={cn('py-3 text-xs', UI_THEME_TOKENS.text.secondary)}>No Strybldr graph loaded.</section>
        ) : (
          <section className="space-y-2 py-1">
            {storytreeCards.length > 0 ? (
              <section className={cn('space-y-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.headerBg)} aria-label="Strybldr storytree workflow">
                <section className="flex items-center justify-between gap-2">
                  <section className="min-w-0 text-xs font-semibold">Storytree workflow</section>
                  <span className={cn('rounded px-2 py-0.5 text-[10px]', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary)}>
                    {visibleStorytreeCards.length}/{storytreeCards.length}
                  </span>
                </section>
                <section className="flex gap-1 overflow-x-auto pb-1" aria-label="Strybldr storytree filters">
                  {STRYTREE_PANEL_FILTERS.map(filter => (
                    <button
                      key={filter.id}
                      type="button"
                      className={cn(
                        UI_RESPONSIVE_STORYBOARD_FILTER_ACTION_CLASSNAME,
                        'inline-flex shrink-0 items-center justify-center rounded border text-[11px]',
                        filter.id === storytreePanelFilter ? 'border-black/30 bg-black/10 text-black' : [UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary].join(' '),
                      )}
                      aria-pressed={filter.id === storytreePanelFilter}
                      aria-label={`Strybldr storytree filter ${filter.label}`}
                      onClick={() => setStorytreePanelFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </section>
                {selectedStorytreeCard ? (
                  <>
                    <select
                      className={cn('w-full rounded-md border px-2 py-1 text-xs', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                      value={selectedStorytreeCard.id}
                      aria-label="Strybldr storytree branch"
                      onChange={e => setSelectedStorytreeCardId(e.target.value)}
                    >
                      {visibleStorytreeCards.map(card => (
                        <option key={card.id} value={card.id}>
                          {card.title}
                        </option>
                      ))}
                    </select>
                    <section className={STRYBLDR_STORYTREE_ACTION_GRID_CLASS_NAME}>
                      <button
                        type="button"
                        className={cn(UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME, 'inline-flex items-center justify-center gap-1 rounded border text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary)}
                        aria-label="Strybldr like storytree branch"
                        onClick={likeSelectedStorytreeCard}
                      >
                        <Heart className="h-3.5 w-3.5" aria-hidden={true} fill={readBoolean(selectedStorytreeCard.tags.includes('liked')) ? 'currentColor' : 'none'} />
                        Like
                      </button>
                      <button
                        type="button"
                        className={cn(UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME, 'inline-flex items-center justify-center gap-1 rounded border text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary)}
                        aria-label="Strybldr compare storytree candidates"
                        disabled={selectedStorytreeCard.tags.includes('dropped')}
                        onClick={compareSelectedStorytreeCandidates}
                      >
                        <Wand2 className="h-3.5 w-3.5" aria-hidden={true} />
                        Compare
                      </button>
                      <button
                        type="button"
                        className={cn(UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME, 'inline-flex items-center justify-center gap-1 rounded border text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary)}
                        aria-label="Strybldr unlock storytree branch"
                        disabled={!selectedStorytreeCard.tags.includes('unlock-ready') && !selectedStorytreeCard.tags.includes('unlock-needs-credits') && !selectedStorytreeCard.tags.includes('protected')}
                        onClick={unlockSelectedStorytreeCard}
                      >
                        <Lock className="h-3.5 w-3.5" aria-hidden={true} />
                        Unlock
                      </button>
                      <button
                        type="button"
                        className={cn(UI_RESPONSIVE_PANEL_TEXT_ACTION_BUTTON_CLASSNAME, 'inline-flex items-center justify-center gap-1 rounded border text-[11px]', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary)}
                        aria-label="Strybldr draft storytree continuation"
                        disabled={selectedStorytreeCard.tags.includes('dropped')}
                        onClick={draftSelectedStorytreeContinuation}
                      >
                        <Wand2 className="h-3.5 w-3.5" aria-hidden={true} />
                        Draft
                      </button>
                    </section>
                  </>
                ) : (
                  <p className={cn('m-0 text-xs', UI_THEME_TOKENS.text.secondary)}>No Storytree cards match this filter.</p>
                )}
              </section>
            ) : null}
            {selectedCard ? (
              <section className={cn('space-y-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.headerBg)} aria-label="Strybldr card editor">
                <section className="flex items-center gap-2">
                  <select
                    className={cn('min-w-0 flex-1 rounded-md border px-2 py-1 text-xs', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                    value={selectedCard.id}
                    aria-label="Strybldr card"
                    onChange={e => setSelectedCardId(e.target.value)}
                  >
                    {editableCards.map(card => (
                      <option key={card.id} value={card.id}>
                        {card.lane}: {card.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                    title="Save card update"
                    onClick={saveSelectedCardUpdate}
                  >
                    <Check className="h-4 w-4" strokeWidth={1.7} aria-hidden={true} />
                  </button>
                </section>
                <label className="block">
                  <section className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Title</section>
                  <input
                    className={cn('mt-1 w-full rounded-md border px-2 py-1 text-xs', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                    value={draft.title}
                    aria-label="Strybldr card title"
                    onChange={e => setDraft(cur => ({ ...cur, title: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <section className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Summary</section>
                  <textarea
                    className={cn('mt-1 min-h-14 w-full resize-y rounded-md border px-2 py-1 text-xs', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                    value={draft.summary}
                    aria-label="Strybldr card summary"
                    onChange={e => setDraft(cur => ({ ...cur, summary: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <section className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Action</section>
                  <textarea
                    className={cn('mt-1 min-h-12 w-full resize-y rounded-md border px-2 py-1 text-xs', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                    value={draft.action}
                    aria-label="Strybldr card action"
                    onChange={e => setDraft(cur => ({ ...cur, action: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <section className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Prompt</section>
                  <textarea
                    className={cn('mt-1 min-h-14 w-full resize-y rounded-md border px-2 py-1 text-xs', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                    value={draft.prompt}
                    aria-label="Strybldr card prompt"
                    onChange={e => setDraft(cur => ({ ...cur, prompt: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <section className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Order</section>
                  <input
                    type="number"
                    className={cn('mt-1 w-full rounded-md border px-2 py-1 text-xs', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                    value={draft.order}
                    aria-label="Strybldr card order"
                    onChange={e => setDraft(cur => ({ ...cur, order: e.target.value }))}
                  />
                </label>
              </section>
            ) : null}
            {board.lanes.map(lane => (
              <section key={lane.id} className="space-y-1" aria-label={lane.label}>
                <section className={cn('text-[11px] font-semibold uppercase tracking-normal', UI_THEME_TOKENS.text.tertiary)}>
                  {lane.label}
                </section>
                {lane.cards.map(card => (
                  <article key={card.id} className={cn('rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.headerBg, card.id === selectedCard?.id ? 'ring-1 ring-blue-500/50' : null)}>
                    <section className="min-w-0 text-xs font-semibold">{card.title}</section>
                    {card.summary ? <p className={cn('mt-1 text-xs', UI_THEME_TOKENS.text.secondary)}>{card.summary}</p> : null}
                    {card.prompt ? <p className={cn('mt-1 text-[11px]', UI_THEME_TOKENS.text.tertiary)}>{card.prompt}</p> : null}
                  </article>
                ))}
              </section>
            ))}
          </section>
        )}
      </section>
    </section>
  )
}
