import React from 'react'

import { buildSuggestedArtifactFileName, buildTextWidgetOutputPatch, clearRichMediaOutputProperties } from '@/features/chat/richMediaRun'
import { resolveWorkspaceSiblingArtifactPath } from '@/features/chat/chatHistoryWorkspace.output'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import { bumpStoryboardWidgetDraftGraphDataRevision } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { reportRuntimeTrace } from '@/lib/debug/runtimeTrace'
import { reconcileStoryboardWidgetDraftGraphDataWithBaseChanges } from '@/lib/storyboardWidget/storyboardWidgetDraftGraphData'

const TEXT_OUTPUT_RECOVERY_STALE_MS = 5 * 60 * 1000

const readString = (value: unknown): string => {
  const scalar = unwrapGraphCellValue(value)
  return typeof scalar === 'string' ? scalar.trim() : ''
}

const readBoolean = (value: unknown): boolean => unwrapGraphCellValue(value) === true

function isPendingTextWidgetOutputNode(node: GraphNode): boolean {
  if (readString(node.type) !== FLOW_TEXT_GENERATION_NODE_TYPE_ID) return false
  const properties = (node.properties || {}) as Record<string, unknown>
  return readBoolean(properties.outputLoading) && readString(properties.outputLoadingKind) === 'text'
}

export function isStaleTextWidgetOutputNode(node: GraphNode, nowMs = Date.now()): boolean {
  if (!isPendingTextWidgetOutputNode(node)) return false
  const properties = (node.properties || {}) as Record<string, unknown>
  const lastRunMs = Date.parse(readString(properties.lastRunAt))
  return Number.isFinite(lastRunMs) && nowMs - lastRunMs >= TEXT_OUTPUT_RECOVERY_STALE_MS
}

export async function recoverStaleTextWidgetOutputsFromArtifacts(args: {
  graphData: GraphData
  documentName: string
  nowMs?: number
  fs?: WorkspaceFs
}): Promise<GraphData | null> {
  const pendingNodes = (args.graphData.nodes || []).filter(isPendingTextWidgetOutputNode)
  if (pendingNodes.length === 0) return null
  const nowMs = args.nowMs ?? Date.now()
  const fs = args.fs || await getWorkspaceFs()
  await fs.ensureSeed()
  let workspaceEntries: Awaited<ReturnType<WorkspaceFs['listEntries']>> | null = null
  let nextGraph = args.graphData
  let changed = false

  for (const staleNode of pendingNodes) {
    const sourceNodeId = readString(staleNode.id)
    const sourceNodeLabel = readString(staleNode.label) || FLOW_TEXT_GENERATION_NODE_TYPE_ID
    const fileName = buildSuggestedArtifactFileName({
      workspacePath: args.documentName,
      node: { ...staleNode, id: sourceNodeId, label: sourceNodeLabel },
      kind: 'text',
      extension: 'md',
      variant: 'text-output',
    })
    const suggestedOutputPath = resolveWorkspaceSiblingArtifactPath({ workspacePath: args.documentName, fileName })
    if (!suggestedOutputPath) continue
    let matchingEntry: Awaited<ReturnType<WorkspaceFs['listEntries']>>[number] | undefined
    let outputPath = suggestedOutputPath
    let output = String(await fs.readFileText(outputPath) || '')
    if (!output.trim()) {
      workspaceEntries ||= await fs.listEntries()
      matchingEntry = workspaceEntries.find(entry => entry.kind === 'file' && entry.name === fileName)
      if (matchingEntry) {
        outputPath = matchingEntry.path
        output = String(await fs.readFileText(outputPath) || '')
      }
    }
    if (!output.trim()) continue
    const sourceProperties = (staleNode.properties || {}) as Record<string, unknown>
    const lastRunMs = Date.parse(readString(sourceProperties.lastRunAt))
    const staleByNode = Number.isFinite(lastRunMs) && nowMs - lastRunMs >= TEXT_OUTPUT_RECOVERY_STALE_MS
    if (!Number.isFinite(lastRunMs)) {
      workspaceEntries ||= await fs.listEntries()
      matchingEntry ||= workspaceEntries.find(entry => entry.kind === 'file' && entry.name === fileName)
    }
    const staleByArtifact = !Number.isFinite(lastRunMs)
      && Number.isFinite(matchingEntry?.updatedAtMs)
      && nowMs - Number(matchingEntry?.updatedAtMs) >= TEXT_OUTPUT_RECOVERY_STALE_MS
    if (!staleByNode && !staleByArtifact) continue
    const outputPatch = buildTextWidgetOutputPatch({
      output,
      title: sourceNodeLabel,
      model: sourceProperties.outputModel,
      outputPath,
      materializeSrcDoc: false,
    })
    const nextNodes = nextGraph.nodes.map(node => {
      const nodeId = readString(node.id)
      const properties = (node.properties || {}) as Record<string, unknown>
      if (nodeId === sourceNodeId) {
        return { ...node, properties: { ...clearRichMediaOutputProperties(properties), ...outputPatch } as never }
      }
      if (
        readString(node.type) === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
        && readString(properties.workflowOutputAnchorNodeId) === sourceNodeId
        && (!readString(properties.workflowOutputKey) || readString(properties.workflowOutputKey) === 'output')
      ) {
        return {
          ...node,
          properties: {
            ...clearRichMediaOutputProperties(properties),
            ...outputPatch,
            richMediaActiveTab: 'text',
            workflowOutputAnchorNodeId: sourceNodeId,
            workflowOutputKey: 'output',
          } as never,
        }
      }
      return node
    })
    nextGraph = { ...nextGraph, nodes: nextNodes }
    changed = true
  }

  return changed ? bumpStoryboardWidgetDraftGraphDataRevision(nextGraph) : null
}

export function mergeRecoveredTextWidgetOutputGraphData(args: {
  scannedGraphData: GraphData
  latestGraphData: GraphData | null
  recoveredGraphData: GraphData
}): GraphData {
  if (!args.latestGraphData || args.latestGraphData === args.scannedGraphData) return args.recoveredGraphData
  return reconcileStoryboardWidgetDraftGraphDataWithBaseChanges({
    previousBaseGraphData: args.scannedGraphData,
    currentDraftGraphData: args.latestGraphData,
    nextBaseGraphData: args.recoveredGraphData,
  })
}

export function useTextWidgetOutputArtifactRecovery(args: {
  active: boolean
  graphData: GraphData | null
  documentName: string | null
  commitGraphData: (graphData: GraphData) => void | Promise<void>
  latestGraphDataRef?: React.MutableRefObject<GraphData | null>
  onRecoveryFailure?: () => void
}) {
  const recoveredDocumentsRef = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    if (!args.active || !args.graphData?.nodes || !args.documentName) return
    const staleNodeIds = args.graphData.nodes
      .filter(isPendingTextWidgetOutputNode)
      .map(node => readString(node.id))
      .filter(Boolean)
    reportRuntimeTrace({
      scope: 'text-output-artifact-recovery',
      runId: 'runtime',
      location: 'useTextWidgetOutputArtifactRecovery.scan',
      msg: 'Scanned the displayed graph for stale text output.',
      data: { documentName: args.documentName, nodeCount: args.graphData.nodes.length, staleNodeIds },
    })
    if (staleNodeIds.length === 0) return
    const recoveryKey = `${args.documentName}::${staleNodeIds.join('|')}`
    if (recoveredDocumentsRef.current.has(recoveryKey)) return
    recoveredDocumentsRef.current.add(recoveryKey)
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    const recover = (attempt: number) => {
      void recoverStaleTextWidgetOutputsFromArtifacts({
        graphData: args.graphData as GraphData,
        documentName: args.documentName as string,
      }).then(nextGraph => {
        if (cancelled) return
        if (nextGraph) {
          reportRuntimeTrace({ scope: 'text-output-artifact-recovery', runId: 'runtime', location: 'useTextWidgetOutputArtifactRecovery.commit', msg: 'Recovered stale text output from its workspace artifact.', data: { documentName: args.documentName, staleNodeIds } })
          return args.commitGraphData(mergeRecoveredTextWidgetOutputGraphData({
            scannedGraphData: args.graphData as GraphData,
            latestGraphData: args.latestGraphDataRef?.current || null,
            recoveredGraphData: nextGraph,
          }))
        }
        if (attempt < 2) retryTimer = setTimeout(() => recover(attempt + 1), 750)
        else {
          recoveredDocumentsRef.current.delete(recoveryKey)
          args.onRecoveryFailure?.()
        }
      }).catch(() => {
        if (attempt < 2) retryTimer = setTimeout(() => recover(attempt + 1), 750)
        else {
          recoveredDocumentsRef.current.delete(recoveryKey)
          args.onRecoveryFailure?.()
        }
      })
    }
    recover(0)
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [args.active, args.commitGraphData, args.documentName, args.graphData, args.latestGraphDataRef, args.onRecoveryFailure])
}
