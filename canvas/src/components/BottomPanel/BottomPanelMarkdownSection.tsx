import React from 'react'
import { Maximize2, MonitorPlay, WrapText } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useGraphStore } from '@/hooks/useGraphStore'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS, UI_COPY, UI_LABELS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { jsonToMarkdown } from '@/features/markdown/jsonToMarkdown'
import { getIconSizeClass } from '@/lib/ui'
import MarkdownPreview, {
  type MarkdownPreviewPresentationApi,
  type MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import {
  useBottomPanelMarkdownModel,
  useBottomPanelMarkdownSplitView,
} from './BottomPanelMarkdownSectionModel'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'

type MarkdownLayoutMode = 'split' | 'editor' | 'viewer'

type JsonMarkdownMode = JsonToMarkdownMode

type MarkdownLayoutControlsRowProps = {
  layoutMode: MarkdownLayoutMode
  setLayoutMode: (mode: MarkdownLayoutMode) => void
  syncScroll: boolean
  setSyncScroll: (next: boolean) => void
  iconSizeClass: string
  textSizeClass: string
}

function MarkdownLayoutControlsRow(props: MarkdownLayoutControlsRowProps) {
  const { layoutMode, setLayoutMode, syncScroll, setSyncScroll, iconSizeClass, textSizeClass } =
    props

  return (
    <>
      <IconButton
        className={`App-toolbar__btn flex items-center justify-center ${layoutMode === 'editor' ? 'text-blue-600' : ''}`}
        title={UI_COPY.bottomPanelMarkdownFullEditorViewToggleTitle}
        tooltipContent={
          layoutMode === 'editor'
            ? UI_COPY.bottomPanelMarkdownFullEditorViewOnTooltip
            : UI_COPY.bottomPanelMarkdownFullEditorViewOffTooltip
        }
        onClick={() => {
          setLayoutMode(layoutMode === 'editor' ? 'split' : 'editor')
        }}
        showTooltip
      >
        <span
          className={[
            'flex items-center justify-center',
            iconSizeClass,
            textSizeClass,
          ].join(' ')}
        >
          E
        </span>
      </IconButton>
      <IconButton
        className={`App-toolbar__btn flex items-center justify-center ${layoutMode === 'viewer' ? 'text-blue-600' : ''}`}
        title={UI_COPY.bottomPanelMarkdownFullViewerViewToggleTitle}
        tooltipContent={
          layoutMode === 'viewer'
            ? UI_COPY.bottomPanelMarkdownFullViewerViewOnTooltip
            : UI_COPY.bottomPanelMarkdownFullViewerViewOffTooltip
        }
        onClick={() => {
          setLayoutMode(layoutMode === 'viewer' ? 'split' : 'viewer')
        }}
        showTooltip
      >
        <span
          className={[
            'flex items-center justify-center',
            iconSizeClass,
            textSizeClass,
          ].join(' ')}
        >
          V
        </span>
      </IconButton>
      <IconButton
        className={`App-toolbar__btn flex items-center justify-center ${layoutMode === 'split' ? 'text-blue-600' : ''}`}
        title={UI_COPY.bottomPanelMarkdownSplitViewToggleTitle}
        tooltipContent={
          layoutMode === 'split'
            ? UI_COPY.bottomPanelMarkdownSplitViewOnTooltip
            : UI_COPY.bottomPanelMarkdownSplitViewOffTooltip
        }
        onClick={() => {
          setLayoutMode('split')
        }}
        showTooltip
      >
        <span
          className={[
            'flex items-center justify-center',
            iconSizeClass,
            textSizeClass,
          ].join(' ')}
        >
          S
        </span>
      </IconButton>
      {layoutMode === 'split' && (
        <IconButton
          className={`App-toolbar__btn flex items-center justify-center ${syncScroll ? 'text-blue-600' : ''}`}
          title={UI_COPY.bottomPanelMarkdownSyncScrollToggleTitle}
          tooltipContent={
            syncScroll
              ? UI_COPY.bottomPanelMarkdownSyncScrollOnTooltip
              : UI_COPY.bottomPanelMarkdownSyncScrollOffTooltip
          }
          onClick={() => {
            const next = !syncScroll
            setSyncScroll(next)
          }}
          showTooltip
        >
          <span
            className={[
              'flex items-center justify-center',
              iconSizeClass,
              textSizeClass,
            ].join(' ')}
          >
            ⇳
          </span>
        </IconButton>
      )}
    </>
  )
}

export function BottomPanelMarkdownSection() {
  const graphData = useGraphStore(s => s.graphData)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const importedMarkdownText = useGraphStore(s => s.markdownDocumentText)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentSourceUrl = useGraphStore(s => s.markdownDocumentSourceUrl)
  const jsonSourceDocumentText = useGraphStore(s => s.jsonSourceDocumentText)
  const setMarkdownDocument = useGraphStore(s => s.setMarkdownDocument)
  const setMarkdownDocumentSourceUrl = useGraphStore(s => s.setMarkdownDocumentSourceUrl)
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )

  const [markdownWordWrap, setMarkdownWordWrap] = usePersistedBoolean(
    LS_KEYS.markdownWordWrap,
    false,
  )

  const [markdownPresentationMode, setMarkdownPresentationMode] = usePersistedBoolean(
    LS_KEYS.markdownPresentationMode,
    false,
  )

  const [markdownSyncScroll, setMarkdownSyncScroll] = usePersistedBoolean(
    LS_KEYS.markdownSyncScroll,
    true,
  )
  const [markdownLayoutMode, setMarkdownLayoutMode] = React.useState<MarkdownLayoutMode>(() =>
    lsJson<MarkdownLayoutMode>(
      LS_KEYS.markdownLayoutMode,
      'split',
      value => (value === 'editor' || value === 'viewer' || value === 'split' ? value : 'split'),
    ),
  )

  const [jsonMarkdownMode, setJsonMarkdownMode] = React.useState<JsonMarkdownMode>(() =>
    lsJson<JsonMarkdownMode>(
      LS_KEYS.jsonMarkdownMode,
      'auto',
      value =>
        value === 'table' ||
        value === 'key-value' ||
        value === 'hierarchical' ||
        value === 'auto'
          ? value
          : 'auto',
    ),
  )

  const iconSizeClass = getIconSizeClass(uiIconScale)

  const {
    selectionInfo,
    selectionDocumentPath,
    markdownText,
    setMarkdownText,
    isLoading,
    loadError,
    previewBasePath,
  } = useBottomPanelMarkdownModel({
    graphData,
    selectedNodeId,
    selectedEdgeId,
    importedMarkdownText,
    markdownDocumentName,
    markdownDocumentSourceUrl,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
  })

  const {
    editorTextAreaRef,
    viewerRef,
    gutterLayerRef,
    splitRatio,
    handleDividerPointerDown,
    handleViewerScroll,
    markdownFullscreen,
    lineHeightPx,
    editorPaddingTopPx,
    editorRowStartByLine,
    editorContentHeightPx,
    editorGutterWidthCh,
    visibleLineRange,
    highlightedLineRange,
  } = useBottomPanelMarkdownSplitView({
    markdownText,
    markdownWordWrap,
    selectionInfo,
    uiPanelMonospaceTextClass,
    syncScroll: markdownSyncScroll,
  })

  const toggleMarkdownFullscreen = React.useCallback(() => {
    const el = viewerRef.current
    if (!el) return
    void (async () => {
      try {
        if (!markdownPresentationMode) {
          setMarkdownPresentationMode(true)
        }
        if (document.fullscreenElement === el) {
          await document.exitFullscreen()
          return
        }
        await el.requestFullscreen()
      } catch {
        void 0
      }
    })()
    emitMarkdownPanelMetric('markdownFullscreenToggleRequested', {
      enabled: !markdownFullscreen,
    })
  }, [markdownFullscreen, markdownPresentationMode, setMarkdownPresentationMode, viewerRef])

  const visibleLineNumbers = React.useMemo(() => {
    const nums: number[] = []
    for (let line = visibleLineRange.startLine; line <= visibleLineRange.endLine; line += 1) {
      nums.push(line)
    }
    return nums
  }, [visibleLineRange])

  const hasSelection = !!selectionInfo
  const hasMarkdown = !!(markdownText && markdownText.trim())

  const presentationApiRef = React.useRef<MarkdownPreviewPresentationApi | null>(null)
  const [presentationSlideState, setPresentationSlideState] =
    React.useState<MarkdownPreviewPresentationSlideState | null>(null)

  React.useEffect(() => {
    lsSetJson<MarkdownLayoutMode>(LS_KEYS.markdownLayoutMode, markdownLayoutMode)
  }, [markdownLayoutMode])

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      setPresentationSlideState(null)
    }
  }, [markdownPresentationMode])

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    if (!presentationSlideState) return
    emitMarkdownPanelMetric('markdownPresentationSlideStateChanged', {
      activeIndex: presentationSlideState.activeSlideIndex,
      slideCount: presentationSlideState.slideCount,
    })
  }, [markdownPresentationMode, presentationSlideState])

  const headerText =
    isLoading
      ? UI_COPY.bottomPanelMarkdownLoadingLabel
      : loadError
      ? UI_COPY.bottomPanelMarkdownLoadFailedLabel
      : hasMarkdown
      ? hasSelection && !selectionDocumentPath
        ? UI_COPY.bottomPanelMarkdownMissingDocumentPathLabel
        : UI_COPY.bottomPanelMarkdownNoSelectionLabel
      : UI_COPY.bottomPanelMarkdownNoMarkdownLabel

  const status = React.useMemo((): { ok: boolean | null; msg: string; details?: string } => {
    if (isLoading) return { ok: null, msg: UI_COPY.bottomPanelMarkdownStatusLoading }
    if (loadError) return { ok: false, msg: UI_COPY.bottomPanelMarkdownStatusError, details: loadError }
    if (hasMarkdown) return { ok: true, msg: UI_COPY.bottomPanelMarkdownStatusReady, details: markdownDocumentName || undefined }
    return { ok: null, msg: UI_COPY.bottomPanelMarkdownStatusReady }
  }, [hasMarkdown, isLoading, loadError, markdownDocumentName])

  const deferredMarkdownText = React.useDeferredValue(markdownText)
  const deferredJsonSourceText = React.useDeferredValue(jsonSourceDocumentText)

  const jsonMarkdownSuggestedMode = React.useMemo((): JsonMarkdownMode => {
    try {
      const jsonTrimmed = (deferredJsonSourceText || '').trim()
      if (!jsonTrimmed) return 'auto'
      const parsed = JSON.parse(jsonTrimmed)
      const renderedTable = jsonToMarkdown(parsed, { defaultMode: 'table' }, 'table')
      const renderedKeyValue = jsonToMarkdown(parsed, { defaultMode: 'key-value' }, 'key-value')
      const renderedHierarchical = jsonToMarkdown(
        parsed,
        { defaultMode: 'hierarchical' },
        'hierarchical',
      )
      const original = deferredMarkdownText || ''
      const isClose = (candidate: string) => {
        const a = candidate.trim()
        const b = original.trim()
        if (!a || !b) return false
        const minLen = Math.min(a.length, b.length)
        if (!minLen) return false
        let same = 0
        const limit = Math.min(minLen, 1024)
        for (let i = 0; i < limit; i += 1) {
          if (a[i] === b[i]) same += 1
        }
        const ratio = same / limit
        return ratio >= 0.9
      }
      if (isClose(renderedTable)) return 'table'
      if (isClose(renderedKeyValue)) return 'key-value'
      if (isClose(renderedHierarchical)) return 'hierarchical'
      return 'auto'
    } catch {
      return 'auto'
    }
  }, [deferredJsonSourceText, deferredMarkdownText])

  React.useEffect(() => {
    try {
      const rawJson = (jsonSourceDocumentText || '').trim()
      if (!rawJson) return
      const name = markdownDocumentName || ''
      if (!name.endsWith('.json') && !name.endsWith('.jsonld')) return
      const parsed = JSON.parse(rawJson)
      const mode = jsonMarkdownMode
      const markdown = jsonToMarkdown(parsed, { defaultMode: mode }, mode)
      setMarkdownDocument(markdownDocumentName, markdown)
      setMarkdownText(markdown)
    } catch {
      void 0
    }
  }, [jsonMarkdownMode, jsonSourceDocumentText, markdownDocumentName, setMarkdownDocument, setMarkdownText])

  React.useEffect(() => {
    lsSetJson<JsonMarkdownMode>(LS_KEYS.jsonMarkdownMode, jsonMarkdownMode)
  }, [jsonMarkdownMode])

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col border border-gray-200 rounded bg-white overflow-hidden">
        <div
          className={[
            'px-2 py-1 border-b border-gray-200 flex items-center justify-between gap-2 text-gray-600',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 truncate">{headerText}</div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">
                {UI_COPY.bottomPanelJsonMarkdownModeLabel}
              </span>
              <select
                className={[
                  'border border-gray-200 rounded px-1 py-0.5 text-xs bg-white text-gray-700',
                  'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
                ].join(' ')}
                value={jsonMarkdownMode}
                onChange={e => {
                  const next = e.target.value as JsonMarkdownMode
                  const valid =
                    next === 'table' ||
                    next === 'key-value' ||
                    next === 'hierarchical' ||
                    next === 'auto'
                  setJsonMarkdownMode(valid ? next : 'auto')
                }}
              >
                <option value="auto">{UI_COPY.bottomPanelJsonMarkdownModeAutoLabel}</option>
                <option value="table">{UI_COPY.bottomPanelJsonMarkdownModeTableLabel}</option>
                <option value="key-value">
                  {UI_COPY.bottomPanelJsonMarkdownModeKeyValueLabel}
                </option>
                <option value="hierarchical">
                  {UI_COPY.bottomPanelJsonMarkdownModeHierarchicalLabel}
                </option>
              </select>
              {jsonMarkdownSuggestedMode !== 'auto' && (
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                  {UI_COPY.bottomPanelJsonMarkdownModeSuggestedPrefix}{' '}
                  {jsonMarkdownSuggestedMode === 'table'
                    ? UI_COPY.bottomPanelJsonMarkdownModeTableLabel
                    : jsonMarkdownSuggestedMode === 'key-value'
                    ? UI_COPY.bottomPanelJsonMarkdownModeKeyValueLabel
                    : UI_COPY.bottomPanelJsonMarkdownModeHierarchicalLabel}
                </span>
              )}
            </div>
          </div>
          <StatusBadge
            label={UI_LABELS.markdown}
            ok={status.ok}
            msg={status.msg}
            details={status.details}
          />
        </div>

        <div className="flex-1 min-h-0 flex">
          {!markdownPresentationMode && markdownLayoutMode !== 'viewer' && (
            <div
              className={[
                'flex flex-col',
                markdownLayoutMode === 'editor' ? 'w-full' : 'min-w-[20%] max-w-[80%]',
              ].join(' ')}
              style={{
                width:
                  markdownLayoutMode === 'editor'
                    ? '100%'
                    : `${Math.round(splitRatio * 100)}%`,
              }}
            >
              <div
                className={[
                  'px-2 py-1 border-b border-gray-200 text-gray-500 flex items-center justify-between gap-2',
                  uiPanelKeyValueTextSizeClass,
                  uiPanelTextFontClass,
                ].join(' ')}
              >
                <span>{UI_COPY.bottomPanelMarkdownEditorTitle}</span>
                {markdownLayoutMode === 'editor' && !markdownPresentationMode && (
                  <div className="flex items-center gap-1">
                    <MarkdownLayoutControlsRow
                      layoutMode={markdownLayoutMode}
                      setLayoutMode={setMarkdownLayoutMode}
                      syncScroll={markdownSyncScroll}
                      setSyncScroll={setMarkdownSyncScroll}
                      iconSizeClass={iconSizeClass}
                      textSizeClass={uiPanelKeyValueTextSizeClass}
                    />
                  </div>
                )}
                <IconButton
                  className={`App-toolbar__btn flex items-center justify-center ${markdownWordWrap ? 'text-blue-600' : ''}`}
                  title={UI_COPY.bottomPanelMarkdownWordWrapToggleTitle}
                  tooltipContent={
                    markdownWordWrap
                      ? UI_COPY.bottomPanelMarkdownWordWrapOnTooltip
                      : UI_COPY.bottomPanelMarkdownWordWrapOffTooltip
                  }
                  onClick={() => {
                    const next = !markdownWordWrap
                    setMarkdownWordWrap(next)
                    emitMarkdownPanelMetric('markdownWordWrapToggled', {
                      enabled: next,
                    })
                  }}
                  showTooltip
                >
                  <WrapText className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                </IconButton>
              </div>
              <div className="flex-1 min-h-0 flex">
                <div
                  className="shrink-0 border-r border-gray-200 bg-gray-50 text-gray-500 relative overflow-hidden"
                  style={{ width: `${editorGutterWidthCh}ch` }}
                  onWheel={e => {
                    const ta = editorTextAreaRef.current
                    if (!ta) return
                    if (!e.deltaY) return
                    e.preventDefault()
                    ta.scrollTop = ta.scrollTop + e.deltaY
                  }}
                >
                  <div
                    ref={gutterLayerRef}
                    className="absolute left-0 right-0 top-0"
                    style={{
                      height: `${editorContentHeightPx}px`,
                      transform: 'translateY(0px)',
                      willChange: 'transform',
                    }}
                  >
                    {visibleLineNumbers.map(line => {
                      const isHighlighted =
                        highlightedLineRange != null && line >= highlightedLineRange.start && line <= highlightedLineRange.end
                      const startRow =
                        editorRowStartByLine[visibleLineRange.startLine] ?? visibleLineRange.startLine
                      const row = editorRowStartByLine[line] ?? line
                      return (
                        <div
                          key={line}
                          className={[
                            'absolute left-0 right-0 pr-2 text-right select-none',
                            uiPanelMonospaceTextClass,
                            isHighlighted ? 'bg-yellow-100' : '',
                          ].join(' ')}
                          style={{
                            top: `${editorPaddingTopPx + (row - startRow) * lineHeightPx}px`,
                            height: `${lineHeightPx}px`,
                            lineHeight: `${lineHeightPx}px`,
                          }}
                        >
                          {line}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <textarea
                  ref={editorTextAreaRef}
                  value={markdownText}
                  onChange={e => {
                    const next = e.target.value
                    setMarkdownText(next)
                    setMarkdownDocument(markdownDocumentName, next)
                  }}
                  className={[
                    'w-full h-full px-2 py-2 border-0 rounded-none resize-none bg-transparent text-gray-900 outline-none',
                    'overflow-auto',
                    markdownWordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
                    uiPanelMonospaceTextClass,
                  ].join(' ')}
                  style={{ lineHeight: `${lineHeightPx}px` }}
                  wrap={markdownWordWrap ? 'soft' : 'off'}
                />
              </div>
            </div>
          )}

          {!markdownPresentationMode && markdownLayoutMode === 'split' && (
            <div
              className="w-1 cursor-col-resize bg-gray-200 hover:bg-gray-400"
              onPointerDown={handleDividerPointerDown}
            />
          )}

          {(markdownPresentationMode || markdownLayoutMode !== 'editor') && (
            <div
              className={[
                'flex-1 min-h-0 flex flex-col',
                markdownPresentationMode || markdownLayoutMode === 'viewer' ? 'min-w-0' : 'min-w-[20%]',
              ].join(' ')}
            >
            <div
              className={[
                'px-2 py-1 border-b border-gray-200 text-gray-500 flex items-center justify-between gap-2',
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
              ].join(' ')}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="min-w-0 truncate">{UI_COPY.bottomPanelMarkdownViewerTitle}</span>
                {!markdownPresentationMode && (
                  <MarkdownLayoutControlsRow
                    layoutMode={markdownLayoutMode}
                    setLayoutMode={setMarkdownLayoutMode}
                    syncScroll={markdownSyncScroll}
                    setSyncScroll={setMarkdownSyncScroll}
                    iconSizeClass={iconSizeClass}
                    textSizeClass={uiPanelKeyValueTextSizeClass}
                  />
                )}
                {markdownPresentationMode && (
                  <>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => {
                        emitMarkdownPanelMetric('markdownPresentationPrevClicked', {
                          activeIndex: presentationSlideState?.activeSlideIndex ?? null,
                          slideCount: presentationSlideState?.slideCount ?? null,
                        })
                        presentationApiRef.current?.prev()
                      }}
                      disabled={!presentationSlideState || presentationSlideState.activeSlideIndex <= 0}
                    >
                      {UI_COPY.markdownPreviewPrevButtonLabel}
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => {
                        emitMarkdownPanelMetric('markdownPresentationNextClicked', {
                          activeIndex: presentationSlideState?.activeSlideIndex ?? null,
                          slideCount: presentationSlideState?.slideCount ?? null,
                        })
                        presentationApiRef.current?.next()
                      }}
                      disabled={
                        !presentationSlideState
                        || presentationSlideState.activeSlideIndex >= presentationSlideState.slideCount - 1
                      }
                    >
                      {UI_COPY.markdownPreviewNextButtonLabel}
                    </button>
                    <div className="ml-1">
                      {Math.min(
                        presentationSlideState?.slideCount ?? 1,
                        (presentationSlideState?.activeSlideIndex ?? 0) + 1,
                      )}{' '}
                      / {presentationSlideState?.slideCount ?? 1}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  className={`App-toolbar__btn flex items-center justify-center ${markdownPresentationMode ? 'text-blue-600' : ''}`}
                  title={UI_COPY.bottomPanelMarkdownPresentationModeToggleTitle}
                  tooltipContent={
                    markdownPresentationMode
                      ? UI_COPY.bottomPanelMarkdownPresentationModeOnTooltip
                      : UI_COPY.bottomPanelMarkdownPresentationModeOffTooltip
                  }
                  onClick={() => {
                    const next = !markdownPresentationMode
                    setMarkdownPresentationMode(next)
                    emitMarkdownPanelMetric('markdownPresentationModeToggled', {
                      enabled: next,
                      slideCount: presentationSlideState?.slideCount ?? null,
                    })
                  }}
                  showTooltip
                >
                  <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                </IconButton>
                <IconButton
                  className={`App-toolbar__btn flex items-center justify-center ${markdownFullscreen ? 'text-blue-600' : ''}`}
                  title={UI_COPY.bottomPanelMarkdownFullscreenToggleTitle}
                  tooltipContent={
                    markdownFullscreen
                      ? UI_COPY.bottomPanelMarkdownFullscreenOnTooltip
                      : UI_COPY.bottomPanelMarkdownFullscreenOffTooltip
                  }
                  onClick={toggleMarkdownFullscreen}
                  showTooltip
                >
                  <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
                </IconButton>
              </div>
            </div>
            {markdownLayoutMode !== 'editor' && (
              <MarkdownPreview
                ref={viewerRef}
                markdownText={deferredMarkdownText}
                activeDocumentPath={previewBasePath}
                highlightedLineRange={highlightedLineRange}
                markdownWordWrap={markdownWordWrap}
                markdownPresentationMode={markdownPresentationMode}
                presentationApiRef={presentationApiRef}
                onPresentationSlideStateChange={setPresentationSlideState}
                uiPanelTextFontClass={uiPanelTextFontClass}
                uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                previewScrollable
                onScroll={markdownPresentationMode ? undefined : handleViewerScroll}
              />
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
