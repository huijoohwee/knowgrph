import React from 'react'
import type { VideoSequenceClipEditAction } from '@/components/timeline/videoSequenceClipEdit'
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
import {
  VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS,
  resolveVideoSequenceTimelineLane,
  type VideoSequenceTimelineToolId,
} from '@/components/timeline/videoSequenceTimeline'
import {
  insertMermaidGanttVideoSequenceOperationRow,
  replaceFirstMermaidGanttFrontmatterCode,
  splitMermaidGanttVideoSequenceClipAtOffset,
  updateMermaidGanttVideoSequenceClipTiming,
  type MermaidGanttBarDragMode,
  type MermaidGanttTimelineTaskSpan,
  type MermaidGanttVideoSequenceTimingSyncMode,
  type MermaidGanttVideoSequenceOperation,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import type { GanttTimelineTransportDragState } from './useGanttTimelineInteractions'

const VIDEO_SEQUENCE_OPERATION_TOOL_SET = new Set<VideoSequenceTimelineToolId>(VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS)
const SOURCE_BACKED_VIDEO_LANES = new Set(['video', 'image', 'scene'])

function resolveDirectEditTimingSyncMode(args: {
  span: MermaidGanttTimelineTaskSpan
  timingSyncMode: MermaidGanttVideoSequenceTimingSyncMode
}): MermaidGanttVideoSequenceTimingSyncMode {
  return SOURCE_BACKED_VIDEO_LANES.has(resolveVideoSequenceTimelineLane(args.span))
    ? args.timingSyncMode
    : 'selected'
}

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
  const [timingSyncMode, setTimingSyncMode] = React.useState<MermaidGanttVideoSequenceTimingSyncMode>('grouped')
  const exportAbortControllerRef = React.useRef<AbortController | null>(null)
  const { setMarkdownDocument, upsertUiToast } = useTimelineDocumentMutationStoreBinding()
  const readDocumentSnapshot = useTimelineDocumentSnapshotReader({
    markdownDocumentName: args.markdownDocumentName,
    markdownText: args.markdownText,
  })

  const commitGanttVideoSequenceCode = React.useCallback((nextCode: string | null, nextLineIndex?: number) => {
    if (!nextCode || nextCode === args.code) return
    const currentDocument = readDocumentSnapshot()
    if (
      currentDocument.markdownDocumentName !== args.markdownDocumentName ||
      currentDocument.markdownText !== args.markdownText
    ) {
      return
    }
    const nextMarkdownText = replaceFirstMermaidGanttFrontmatterCode(args.markdownText, nextCode)
    if (!nextMarkdownText || nextMarkdownText === args.markdownText) return
    setMarkdownDocument(args.markdownDocumentName, nextMarkdownText, { applyViewPreset: false })
    const lineIndex = nextLineIndex ?? args.selectedSpan?.lineIndex
    const nextLine = typeof lineIndex === 'number' ? nextCode.split('\n')[lineIndex]?.trim() : ''
    if (nextLine) args.setSelectedRowKey(`${lineIndex}:task:${nextLine}`)
  }, [
    args.code,
    args.markdownDocumentName,
    args.markdownText,
    args.selectedSpan?.lineIndex,
    args.setSelectedRowKey,
    readDocumentSnapshot,
    setMarkdownDocument,
  ])

  const handleVideoSequenceTool = React.useCallback((toolId: VideoSequenceTimelineToolId) => {
    if (!args.selectedSpan || args.maxMinutes <= 0) return
    if (toolId === 'cut') {
      commitGanttVideoSequenceCode(
        splitMermaidGanttVideoSequenceClipAtOffset({
          code: args.code,
          rowLineIndex: args.selectedSpan.lineIndex,
          splitOffsetMinutes: args.positionMinutes - args.selectedSpan.startMinutes,
          syncMode: resolveDirectEditTimingSyncMode({ span: args.selectedSpan, timingSyncMode }),
        }),
        args.selectedSpan.lineIndex,
      )
      return
    }
    if (toolId === 'splice') {
      commitGanttVideoSequenceCode(
        updateMermaidGanttVideoSequenceClipTiming({
          code: args.code,
          rowLineIndex: args.selectedSpan.lineIndex,
          mode: 'move',
          deltaMinutes: Math.round(args.positionMinutes - args.selectedSpan.startMinutes),
          syncMode: resolveDirectEditTimingSyncMode({ span: args.selectedSpan, timingSyncMode }),
        }),
        args.selectedSpan.lineIndex,
      )
      return
    }
    if (!VIDEO_SEQUENCE_OPERATION_TOOL_SET.has(toolId)) return
    commitGanttVideoSequenceCode(
      insertMermaidGanttVideoSequenceOperationRow({
        code: args.code,
        rowLineIndex: args.selectedSpan.lineIndex,
        operation: toolId as MermaidGanttVideoSequenceOperation,
      }),
      args.selectedSpan.lineIndex + 1,
    )
  }, [args.code, args.maxMinutes, args.positionMinutes, args.selectedSpan, commitGanttVideoSequenceCode, timingSyncMode])

  const handleVideoSequenceClipEdit = React.useCallback((action: VideoSequenceClipEditAction) => {
    if (!args.selectedSpan || args.maxMinutes <= 0) return
    if (action === 'split-at-playhead') {
      commitGanttVideoSequenceCode(
        splitMermaidGanttVideoSequenceClipAtOffset({
          code: args.code,
          rowLineIndex: args.selectedSpan.lineIndex,
          splitOffsetMinutes: args.positionMinutes - args.selectedSpan.startMinutes,
          syncMode: resolveDirectEditTimingSyncMode({ span: args.selectedSpan, timingSyncMode }),
        }),
        args.selectedSpan.lineIndex,
      )
      return
    }

    let mode: MermaidGanttBarDragMode = 'move'
    let deltaMinutes = 0
    if (action === 'nudge-back') {
      deltaMinutes = -Math.min(1, Math.max(0, args.selectedSpan.startMinutes))
    } else if (action === 'nudge-forward') {
      deltaMinutes = 1
    } else if (action === 'trim-start-back') {
      mode = 'resize-start'
      deltaMinutes = -Math.min(1, Math.max(0, args.selectedSpan.startMinutes))
    } else if (action === 'trim-start-forward') {
      mode = 'resize-start'
      deltaMinutes = Math.min(1, Math.max(0, args.selectedSpan.durationMinutes - 1))
    } else if (action === 'trim-end-back') {
      mode = 'resize-end'
      deltaMinutes = -Math.min(1, Math.max(0, args.selectedSpan.durationMinutes - 1))
    } else if (action === 'trim-end-forward') {
      mode = 'resize-end'
      deltaMinutes = 1
    } else if (action === 'snap-to-playhead') {
      deltaMinutes = Math.round(args.positionMinutes - args.selectedSpan.startMinutes)
    }
    if (!deltaMinutes) return
    commitGanttVideoSequenceCode(
      updateMermaidGanttVideoSequenceClipTiming({
        code: args.code,
        rowLineIndex: args.selectedSpan.lineIndex,
        mode,
        deltaMinutes,
        syncMode: resolveDirectEditTimingSyncMode({ span: args.selectedSpan, timingSyncMode }),
      }),
      args.selectedSpan.lineIndex,
    )
  }, [args.code, args.maxMinutes, args.positionMinutes, args.selectedSpan, commitGanttVideoSequenceCode, timingSyncMode])

  const handleToggleVideoSequenceTimingSyncMode = React.useCallback(() => {
    setTimingSyncMode(current => current === 'grouped' ? 'selected' : 'grouped')
  }, [])

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
    const nextCode = updateMermaidGanttVideoSequenceClipTiming({
      code: args.code,
      rowLineIndex: input.dragState.span.lineIndex,
      mode: input.dragState.mode,
      deltaMinutes: input.effectiveDeltaMinutes,
      syncMode: resolveDirectEditTimingSyncMode({ span: input.dragState.span, timingSyncMode }),
    })
    const nextMarkdownText = replaceFirstMermaidGanttFrontmatterCode(input.dragState.markdownText, nextCode)
    if (!nextMarkdownText || nextMarkdownText === input.dragState.markdownText) return
    setMarkdownDocument(input.dragState.markdownDocumentName, nextMarkdownText, { applyViewPreset: false })
    const nextLine = nextCode.split('\n')[input.dragState.span.lineIndex]?.trim()
    if (nextLine) args.setSelectedRowKey(`${input.dragState.span.lineIndex}:task:${nextLine}`)
  }, [args.code, args.setSelectedRowKey, readDocumentSnapshot, setMarkdownDocument, timingSyncMode])

  return {
    cancelEditedMediaExport,
    exportingKind,
    exportSessionCollection,
    handleCommittedDragUpdate,
    handleDownloadEditedMedia,
    handleRetryEditedMediaExport,
    handleRetryEditedMediaExportRunId,
    handleVideoSequenceClipEdit,
    handleVideoSequenceTool,
    handleToggleVideoSequenceTimingSyncMode,
    latestRetryableExportSession,
    recentExportSessions,
    timingSyncMode,
  }
}
