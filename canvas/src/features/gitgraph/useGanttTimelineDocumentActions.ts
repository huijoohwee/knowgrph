import React from 'react'
import type { VideoSequenceClipEditAction } from '@/components/timeline/videoSequenceClipEdit'
import {
  normalizeVideoSequenceClipEditDeltaMinutes,
  resolveVideoSequenceClipEditStepMinutes,
  resolveVideoSequenceClipEditSnappedMinutes,
} from '@/components/timeline/videoSequenceClipEdit'
import {
  buildVideoSequenceExportSessionCollection,
  createVideoSequenceExportSessionRecord,
  downloadVideoSequenceExport,
  reduceVideoSequenceExportSessionRecord,
  resolveVideoSequenceExportEvent,
  resolveVideoSequenceExportOutcome,
  resolveVideoSequenceExportRetryRequest,
  type VideoSequenceExportEvent,
  type VideoSequenceExportKind,
  type VideoSequenceExportOutcomeStatus,
  type VideoSequenceExportPlan,
  type VideoSequenceExportRetryRequest,
  type VideoSequenceExportSessionRecord,
  upsertVideoSequenceExportSessionHistory,
} from '@/components/timeline/videoSequenceExport'
import {
  useTimelineDocumentMutationStoreBinding,
  useTimelineDocumentSnapshotReader,
} from '@/components/timeline/timelineSurfaceBindings'
import { useTimelineTransportTimingSyncStoreBinding } from '@/components/timeline/timelineTransport'
import {
  VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS,
  type VideoSequenceTimelineToolId,
} from '@/components/timeline/videoSequenceTimeline'
import {
  buildMermaidGanttTimelineModel,
  insertMermaidGanttVideoSequenceOperationRow,
  reorderMermaidGanttVideoSequenceClipDisplayLane,
  replaceFirstMermaidGanttFrontmatterCode,
  updateMermaidGanttVideoSequenceClipTiming,
  type MermaidGanttBarDragMode,
  type MermaidGanttTimelineTaskSpan,
  type MermaidGanttVideoSequenceTimingSyncMode,
  type MermaidGanttVideoSequenceOperation,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import { readYamlFrontmatterMermaidDiagramCodes } from '@/lib/mermaid/mermaidDiagramCode'
import { resolveMermaidGanttCode } from '@/lib/mermaid/mermaidGitGraph'
import {
  deleteMermaidGanttVideoSequenceClip,
  deleteMermaidGanttVideoSequenceClipWithRipple,
  duplicateMermaidGanttVideoSequenceClip,
  extractMermaidGanttVideoSequenceAudioRow,
  insertMermaidGanttVideoSequenceBookmark,
} from '@/lib/mermaid/mermaidGanttVideoSequenceElementActions'
import { appendMermaidGanttVideoSequenceMediaDrop } from '@/lib/mermaid/mermaidGanttVideoSequenceMediaDrop'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'
import { commitGanttTimelineVideoSequenceCode } from './ganttTimelineVideoSequenceCommit'
import { resolveGanttTimelineVideoSequenceSplitAction, resolveGanttTimelineVideoSequenceTimingSyncMode } from './ganttTimelineVideoSequenceSplitAction'
import { resolveGanttTimelineVideoSequenceActionContext } from './ganttTimelineVideoSequenceActionContext'
import type { GanttTimelineTransportDragState } from './useGanttTimelineInteractions'

const VIDEO_SEQUENCE_OPERATION_TOOL_SET = new Set<VideoSequenceTimelineToolId>(VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS)

export function useGanttTimelineDocumentActions(args: {
  code: string
  exportPlan: VideoSequenceExportPlan | null
  markdownDocumentName: string
  markdownText: string
  maxMinutes: number
  positionMinutes: number
  selectedSpan: MermaidGanttTimelineTaskSpan | null
  setSelectedRowKey: (rowKey: string) => void
  setTransportPlaying: (nextPlaying: boolean) => void
}) {
  const [exportingKind, setExportingKind] = React.useState<VideoSequenceExportKind | ''>('')
  const [recentExportSessions, setRecentExportSessions] = React.useState<VideoSequenceExportSessionRecord[]>([])
  const [autoSnappingEnabled, setAutoSnappingEnabled] = React.useState(true)
  const [rippleEditingEnabled, setRippleEditingEnabled] = React.useState(false)
  const exportAbortControllerRef = React.useRef<AbortController | null>(null)
  const { setMarkdownDocument, upsertUiToast } = useTimelineDocumentMutationStoreBinding()
  const { timingSyncMode, setTimelineTransportTimingSyncMode } = useTimelineTransportTimingSyncStoreBinding()
  const readDocumentSnapshot = useTimelineDocumentSnapshotReader({
    markdownDocumentName: args.markdownDocumentName,
    markdownText: args.markdownText,
  })

  const resolveCurrentVideoSequenceActionContext = React.useCallback(() => resolveGanttTimelineVideoSequenceActionContext({
    code: args.code,
    markdownDocumentName: args.markdownDocumentName,
    markdownText: args.markdownText,
    maxMinutes: args.maxMinutes,
    readDocumentSnapshot,
    selectedSpan: args.selectedSpan,
  }), [args.code, args.markdownDocumentName, args.markdownText, args.maxMinutes, args.selectedSpan, readDocumentSnapshot])

  const commitGanttVideoSequenceCode = React.useCallback((actionContext, nextCode: string | null, nextLineIndex?: number) => commitGanttTimelineVideoSequenceCode({
    actionContext,
    fallbackMarkdownText: args.markdownText,
    nextCode,
    nextLineIndex,
    readDocumentSnapshot,
    setMarkdownDocument,
    setSelectedRowKey: args.setSelectedRowKey,
  }), [args.markdownText, args.setSelectedRowKey, readDocumentSnapshot, setMarkdownDocument])

  const handleVideoSequenceTool = React.useCallback((toolId: VideoSequenceTimelineToolId) => {
    const actionContext = resolveCurrentVideoSequenceActionContext()
    if (!actionContext) return
    const timelineModel = buildMermaidGanttTimelineModel(actionContext.code)
    const editPositionMinutes = resolveVideoSequenceClipEditSnappedMinutes({
      enabled: autoSnappingEnabled,
      positionMinutes: args.positionMinutes,
      selectedSpan: actionContext.selectedSpan,
      spans: timelineModel.taskSpans,
    })
    const editStepMinutes = resolveVideoSequenceClipEditStepMinutes(actionContext.selectedSpan)
    if (toolId === 'cut') {
      commitGanttVideoSequenceCode(
        actionContext,
        resolveGanttTimelineVideoSequenceSplitAction({
          autoSnappingEnabled,
          code: actionContext.code,
          mode: 'pair',
          positionMinutes: args.positionMinutes,
          selectedSpan: actionContext.selectedSpan,
          spans: timelineModel.taskSpans,
          timingSyncMode,
        }),
        actionContext.selectedSpan.lineIndex,
      )
      return
    }
    if (toolId === 'splice') {
      commitGanttVideoSequenceCode(
        actionContext,
        updateMermaidGanttVideoSequenceClipTiming({
          code: actionContext.code,
          rowLineIndex: actionContext.selectedSpan.lineIndex,
          mode: 'move',
          deltaMinutes: normalizeVideoSequenceClipEditDeltaMinutes(editPositionMinutes - actionContext.selectedSpan.startMinutes, editStepMinutes),
          syncMode: resolveGanttTimelineVideoSequenceTimingSyncMode({ span: actionContext.selectedSpan, timingSyncMode }),
        }),
        actionContext.selectedSpan.lineIndex,
      )
      return
    }
    if (!VIDEO_SEQUENCE_OPERATION_TOOL_SET.has(toolId)) return
    commitGanttVideoSequenceCode(
      actionContext,
      insertMermaidGanttVideoSequenceOperationRow({
        code: actionContext.code,
        rowLineIndex: actionContext.selectedSpan.lineIndex,
        operation: toolId as MermaidGanttVideoSequenceOperation,
      }),
      actionContext.selectedSpan.lineIndex + 1,
    )
  }, [args.positionMinutes, autoSnappingEnabled, commitGanttVideoSequenceCode, resolveCurrentVideoSequenceActionContext, timingSyncMode])

  const handleMediaDrop = React.useCallback((media: MediaDragPayload, positionMinutes: number) => {
    const currentDocument = readDocumentSnapshot()
    if (currentDocument.markdownDocumentName !== args.markdownDocumentName) return false
    const baseMarkdownText = currentDocument.markdownText || args.markdownText
    const baseCode = currentDocument.markdownText === args.markdownText
      ? args.code
      : resolveMermaidGanttCode(readYamlFrontmatterMermaidDiagramCodes(baseMarkdownText, 'gantt'))
    const next = appendMermaidGanttVideoSequenceMediaDrop({
      code: baseCode,
      markdownText: baseMarkdownText,
      media,
      startMinutes: Math.max(0, positionMinutes),
    })
    if (!next) {
      upsertUiToast({
        id: 'video-sequence:media-drop',
        kind: 'neutral',
        message: 'Media drop needs an active Video Sequence timeline.',
        ttlMs: 4_000,
      })
      return false
    }
    setMarkdownDocument(args.markdownDocumentName, next.markdownText, { applyViewPreset: false })
    args.setSelectedRowKey(next.rowKey)
    return true
  }, [
    args.code,
    args.markdownDocumentName,
    args.markdownText,
    args.setSelectedRowKey,
    readDocumentSnapshot,
    setMarkdownDocument,
    upsertUiToast,
  ])

  const handleVideoSequenceClipEdit = React.useCallback((action: VideoSequenceClipEditAction) => {
    if (action === 'toggle-auto-snapping') {
      setAutoSnappingEnabled(current => !current)
      return
    }
    if (action === 'toggle-ripple-editing') {
      setRippleEditingEnabled(current => !current)
      return
    }
    const actionContext = resolveCurrentVideoSequenceActionContext()
    if (!actionContext) return
    const timelineModel = buildMermaidGanttTimelineModel(actionContext.code)
    const editPositionMinutes = resolveVideoSequenceClipEditSnappedMinutes({
      enabled: autoSnappingEnabled,
      positionMinutes: args.positionMinutes,
      selectedSpan: actionContext.selectedSpan,
      spans: timelineModel.taskSpans,
    })
    const editStepMinutes = resolveVideoSequenceClipEditStepMinutes(actionContext.selectedSpan)
    if (action === 'add-bookmark') {
      const next = insertMermaidGanttVideoSequenceBookmark({
        code: actionContext.code,
        positionMinutes: editPositionMinutes,
        rowLineIndex: actionContext.selectedSpan.lineIndex,
      })
      commitGanttVideoSequenceCode(actionContext, next?.code || null, next?.lineIndex)
      return
    }
    if (action === 'split-at-playhead' || action === 'split-left-at-playhead' || action === 'split-right-at-playhead') {
      const mode = action === 'split-left-at-playhead' ? 'left' : action === 'split-right-at-playhead' ? 'right' : 'pair'
      commitGanttVideoSequenceCode(
        actionContext,
        resolveGanttTimelineVideoSequenceSplitAction({
          autoSnappingEnabled,
          code: actionContext.code,
          mode,
          positionMinutes: args.positionMinutes,
          selectedSpan: actionContext.selectedSpan,
          spans: timelineModel.taskSpans,
          timingSyncMode,
        }),
        actionContext.selectedSpan.lineIndex,
      )
      return
    }
    if (action === 'extract-audio') {
      commitGanttVideoSequenceCode(
        actionContext,
        extractMermaidGanttVideoSequenceAudioRow({
          code: actionContext.code,
          rowLineIndex: actionContext.selectedSpan.lineIndex,
        }),
        actionContext.selectedSpan.lineIndex + 1,
      )
      return
    }
    if (action === 'duplicate-element') {
      commitGanttVideoSequenceCode(
        actionContext,
        duplicateMermaidGanttVideoSequenceClip({
          code: actionContext.code,
          rowLineIndex: actionContext.selectedSpan.lineIndex,
          syncMode: resolveGanttTimelineVideoSequenceTimingSyncMode({ span: actionContext.selectedSpan, timingSyncMode }),
        }),
        actionContext.selectedSpan.lineIndex + 1,
      )
      return
    }
    if (action === 'delete-element') {
      commitGanttVideoSequenceCode(
        actionContext,
        (rippleEditingEnabled ? deleteMermaidGanttVideoSequenceClipWithRipple : deleteMermaidGanttVideoSequenceClip)({
          code: actionContext.code,
          rowLineIndex: actionContext.selectedSpan.lineIndex,
          syncMode: resolveGanttTimelineVideoSequenceTimingSyncMode({ span: actionContext.selectedSpan, timingSyncMode }),
        }),
        actionContext.selectedSpan.lineIndex,
      )
      return
    }

    let mode: MermaidGanttBarDragMode = 'move'
    let deltaMinutes = 0
    if (action === 'nudge-back') {
      deltaMinutes = -Math.min(editStepMinutes, Math.max(0, actionContext.selectedSpan.startMinutes))
    } else if (action === 'nudge-forward') {
      deltaMinutes = editStepMinutes
    } else if (action === 'trim-start-back') {
      mode = 'resize-start'
      deltaMinutes = -Math.min(editStepMinutes, Math.max(0, actionContext.selectedSpan.startMinutes))
    } else if (action === 'trim-start-forward') {
      mode = 'resize-start'
      deltaMinutes = Math.min(editStepMinutes, Math.max(0, actionContext.selectedSpan.durationMinutes - editStepMinutes))
    } else if (action === 'trim-end-back') {
      mode = 'resize-end'
      deltaMinutes = -Math.min(editStepMinutes, Math.max(0, actionContext.selectedSpan.durationMinutes - editStepMinutes))
    } else if (action === 'trim-end-forward') {
      mode = 'resize-end'
      deltaMinutes = editStepMinutes
    } else if (action === 'snap-to-playhead') {
      deltaMinutes = normalizeVideoSequenceClipEditDeltaMinutes(editPositionMinutes - actionContext.selectedSpan.startMinutes, editStepMinutes)
    }
    if (!deltaMinutes) return
    commitGanttVideoSequenceCode(
      actionContext,
      updateMermaidGanttVideoSequenceClipTiming({
        code: actionContext.code,
        rowLineIndex: actionContext.selectedSpan.lineIndex,
        mode,
        deltaMinutes,
        syncMode: resolveGanttTimelineVideoSequenceTimingSyncMode({ span: actionContext.selectedSpan, timingSyncMode }),
      }),
      actionContext.selectedSpan.lineIndex,
    )
  }, [args.positionMinutes, autoSnappingEnabled, commitGanttVideoSequenceCode, resolveCurrentVideoSequenceActionContext, rippleEditingEnabled, timingSyncMode])

  const handleToggleVideoSequenceTimingSyncMode = React.useCallback(() => {
    setTimelineTransportTimingSyncMode(timingSyncMode === 'grouped' ? 'selected' : 'grouped')
  }, [setTimelineTransportTimingSyncMode, timingSyncMode])

  const cancelEditedMediaExport = React.useCallback((kind?: VideoSequenceExportKind) => {
    if (!exportingKind) return false
    if (kind && exportingKind !== kind) return false
    const controller = exportAbortControllerRef.current
    if (!controller || controller.signal.aborted) return false
    controller.abort()
    upsertUiToast({
      id: `video-sequence:export:${exportingKind}`,
      kind: 'neutral',
      message: `Cancelling edited ${exportingKind} export...`,
      ttlMs: null,
      busy: true,
    })
    return true
  }, [exportingKind, upsertUiToast])

  React.useEffect(() => () => {
    exportAbortControllerRef.current?.abort()
    exportAbortControllerRef.current = null
  }, [])

  const startEditedMediaExport = React.useCallback(async (request: VideoSequenceExportRetryRequest) => {
    if (exportingKind === request.kind) {
      cancelEditedMediaExport(request.kind)
      return
    }
    if (exportingKind) return
    args.setTransportPlaying(false)
    setExportingKind(request.kind)
    const controller = new AbortController()
    exportAbortControllerRef.current = controller
    const toastId = `video-sequence:export:${request.kind}`
    const updateExportToast = (message: string, busy = true) => {
      upsertUiToast({
        id: toastId,
        kind: 'neutral',
        message,
        ttlMs: busy ? null : 30_000,
        busy,
      })
    }
    upsertUiToast({
      id: toastId,
      kind: 'neutral',
      message: request.kind === 'audio' ? 'Preparing edited audio...' : 'Preparing edited video...',
      busy: true,
      ttlMs: null,
    })
    let exportSession = createVideoSequenceExportSessionRecord({
      filenameBase: request.plan.filenameBase,
      kind: request.kind,
      retryOfRunId: request.retryOfRunId,
      totalSegments: request.plan.segments.length,
    })
    setRecentExportSessions(history => upsertVideoSequenceExportSessionHistory({
      history,
      nextSession: exportSession,
    }))
    try {
      const result = await downloadVideoSequenceExport({
        kind: request.kind,
        onEvent: (event: VideoSequenceExportEvent) => {
          exportSession = reduceVideoSequenceExportSessionRecord({
            event,
            session: exportSession,
          })
          setRecentExportSessions(history => upsertVideoSequenceExportSessionHistory({
            history,
            nextSession: exportSession,
          }))
          if (event.eventType === 'progress') {
            updateExportToast(event.message)
            return
          }
        },
        plan: request.plan,
        signal: controller.signal,
      })
      const outcomeEvent = exportSession.status === 'running'
        ? resolveVideoSequenceExportEvent({
        outcome: resolveVideoSequenceExportOutcome({
          kind: request.kind,
          result,
        }),
      })
        : resolveVideoSequenceExportEvent({
          outcome: {
            errorCode: exportSession.errorCode,
            filename: exportSession.filename,
            kind: exportSession.kind,
            message: exportSession.message,
            status: exportSession.status as VideoSequenceExportOutcomeStatus,
            toastKind: exportSession.toastKind,
          },
        })
      if (outcomeEvent.eventType !== 'outcome') return
      exportSession = reduceVideoSequenceExportSessionRecord({
        event: outcomeEvent,
        session: exportSession,
      })
      setRecentExportSessions(history => upsertVideoSequenceExportSessionHistory({
        history,
        nextSession: exportSession,
      }))
      upsertUiToast({
        id: toastId,
        kind: outcomeEvent.toastKind,
        message: outcomeEvent.message,
        ttlMs: 5_000,
      })
    } catch (error) {
      const outcomeEvent = exportSession.status === 'running'
        ? resolveVideoSequenceExportEvent({
        outcome: resolveVideoSequenceExportOutcome({
          error,
          kind: request.kind,
        }),
      })
        : resolveVideoSequenceExportEvent({
          outcome: {
            errorCode: exportSession.errorCode,
            filename: exportSession.filename,
            kind: exportSession.kind,
            message: exportSession.message,
            status: exportSession.status as VideoSequenceExportOutcomeStatus,
            toastKind: exportSession.toastKind,
          },
        })
      if (outcomeEvent.eventType !== 'outcome') return
      exportSession = reduceVideoSequenceExportSessionRecord({
        event: outcomeEvent,
        session: exportSession,
      })
      setRecentExportSessions(history => upsertVideoSequenceExportSessionHistory({
        history,
        nextSession: exportSession,
      }))
      upsertUiToast({
        id: toastId,
        kind: outcomeEvent.toastKind === 'success' ? 'neutral' : outcomeEvent.toastKind,
        message: outcomeEvent.message,
        ttlMs: outcomeEvent.status === 'cancelled' ? 3_200 : 8_000,
      })
    } finally {
      exportAbortControllerRef.current = null
      setExportingKind('')
    }
  }, [args.setTransportPlaying, cancelEditedMediaExport, exportingKind, upsertUiToast])

  const handleDownloadEditedMedia = React.useCallback(async (kind: VideoSequenceExportKind) => {
    if (!args.exportPlan) return
    await startEditedMediaExport({
      kind,
      plan: args.exportPlan,
      retryOfRunId: '',
    })
  }, [args.exportPlan, startEditedMediaExport])

  const handleRetryEditedMediaExport = React.useCallback(async (session: VideoSequenceExportSessionRecord | null | undefined) => {
    const retry = resolveVideoSequenceExportRetryRequest({
      exportingKind,
      plan: args.exportPlan,
      session,
    })
    if (!retry.request) {
      upsertUiToast({
        id: 'video-sequence:export:retry',
        kind: 'neutral',
        message: retry.error || 'Edited media export retry is not available.',
        ttlMs: 4_000,
      })
      return false
    }
    await startEditedMediaExport(retry.request)
    return true
  }, [args.exportPlan, exportingKind, startEditedMediaExport, upsertUiToast])

  const exportSessionCollection = React.useMemo(() => {
    return buildVideoSequenceExportSessionCollection({
      exportingKind,
      plan: args.exportPlan,
      sessions: recentExportSessions,
    })
  }, [args.exportPlan, exportingKind, recentExportSessions])

  const handleRetryEditedMediaExportRunId = React.useCallback(async (runId: string) => {
    const session = exportSessionCollection.groups
      .flatMap(group => group.sessions)
      .find(candidate => candidate.runId === runId) || null
    return handleRetryEditedMediaExport(session)
  }, [exportSessionCollection.groups, handleRetryEditedMediaExport])

  const latestRetryableExportSession = React.useMemo(() => {
    return exportSessionCollection.latestRetryableSession
  }, [exportSessionCollection.latestRetryableSession])

  const handleCommittedDragUpdate = React.useCallback((input: {
    displayLaneDelta: number
    dragState: GanttTimelineTransportDragState
    effectiveDeltaMinutes: number
  }) => {
    const currentDocument = readDocumentSnapshot()
    if (
      currentDocument.markdownDocumentName !== input.dragState.markdownDocumentName ||
      currentDocument.markdownText !== input.dragState.markdownText
    ) {
      return
    }
    const timelineModel = buildMermaidGanttTimelineModel(args.code)
    const editStepMinutes = resolveVideoSequenceClipEditStepMinutes(input.dragState.span)
    const rawTargetMinutes = input.dragState.mode === 'resize-end'
      ? input.dragState.span.endMinutes + input.effectiveDeltaMinutes
      : input.dragState.span.startMinutes + input.effectiveDeltaMinutes
    const snappedTargetMinutes = resolveVideoSequenceClipEditSnappedMinutes({
      enabled: autoSnappingEnabled,
      excludedSnapPositions: [input.dragState.span.startMinutes, input.dragState.span.endMinutes],
      positionMinutes: rawTargetMinutes,
      selectedSpan: input.dragState.span,
      spans: timelineModel.taskSpans,
    })
    const effectiveDeltaMinutes = normalizeVideoSequenceClipEditDeltaMinutes(
      input.dragState.mode === 'resize-end'
        ? snappedTargetMinutes - input.dragState.span.endMinutes
        : snappedTargetMinutes - input.dragState.span.startMinutes,
      editStepMinutes,
    )
    if (!effectiveDeltaMinutes && !input.displayLaneDelta) return
    const timingCode = effectiveDeltaMinutes
      ? updateMermaidGanttVideoSequenceClipTiming({
          code: args.code,
          rowLineIndex: input.dragState.span.lineIndex,
          mode: input.dragState.mode,
          deltaMinutes: effectiveDeltaMinutes,
          syncMode: resolveGanttTimelineVideoSequenceTimingSyncMode({ span: input.dragState.span, timingSyncMode }),
        })
      : args.code
    const baseCodeForReorder = timingCode || (!effectiveDeltaMinutes ? args.code : '')
    const reordered = input.displayLaneDelta && baseCodeForReorder
      ? reorderMermaidGanttVideoSequenceClipDisplayLane({
          code: baseCodeForReorder,
          displayLaneDelta: input.displayLaneDelta,
          rowLineIndex: input.dragState.span.lineIndex,
        })
      : null
    const nextCode = reordered?.code || timingCode
    if (!nextCode) return
    const nextMarkdownText = replaceFirstMermaidGanttFrontmatterCode(input.dragState.markdownText, nextCode)
    if (!nextMarkdownText || nextMarkdownText === input.dragState.markdownText) return
    setMarkdownDocument(input.dragState.markdownDocumentName, nextMarkdownText, { applyViewPreset: false })
    const nextLineIndex = reordered?.lineIndex ?? input.dragState.span.lineIndex
    const nextLine = nextCode.split('\n')[nextLineIndex]?.trim()
    if (nextLine) args.setSelectedRowKey(`${nextLineIndex}:task:${nextLine}`)
  }, [args.code, args.setSelectedRowKey, autoSnappingEnabled, readDocumentSnapshot, setMarkdownDocument, timingSyncMode])

  return {
    autoSnappingEnabled,
    cancelEditedMediaExport,
    exportingKind,
    exportSessionCollection,
    handleCommittedDragUpdate,
    handleDownloadEditedMedia,
    handleMediaDrop,
    handleRetryEditedMediaExport,
    handleRetryEditedMediaExportRunId,
    handleVideoSequenceClipEdit,
    handleVideoSequenceTool,
    handleToggleVideoSequenceTimingSyncMode,
    latestRetryableExportSession,
    recentExportSessions,
    rippleEditingEnabled,
    timingSyncMode,
  }
}
