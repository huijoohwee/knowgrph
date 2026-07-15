import React from 'react'
import { listNativeCrawlerRecoveryNodeIds } from '@/features/chat/nativeCrawlerInvocation'
import type { GraphData } from '@/lib/graph/types'

export function useNativeCrawlerWorkflowRecovery(args: {
  active: boolean
  graphData: GraphData | null
  documentName: string | null
  runNode: (nodeId: string, options: { suppressLayoutMutation: true; nativeCrawlerRecovery: true }) => Promise<void> | void
}) {
  const recoveredDocumentsRef = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    if (!args.active || !args.graphData?.nodes) return
    const nodeKey = args.graphData.nodes.map(node => String(node.id || '').trim()).filter(Boolean).join('|')
    const documentKey = `${String(args.documentName || '').trim() || 'active'}::${nodeKey}`
    if (recoveredDocumentsRef.current.has(documentKey)) return
    const nodeIds = listNativeCrawlerRecoveryNodeIds(args.graphData)
    if (nodeIds.length === 0) return
    recoveredDocumentsRef.current.add(documentKey)
    const recover = () => { for (const nodeId of nodeIds) void args.runNode(nodeId, { suppressLayoutMutation: true, nativeCrawlerRecovery: true }) }
    if (typeof queueMicrotask === 'function') queueMicrotask(recover)
    else void Promise.resolve().then(recover)
  }, [args.active, args.documentName, args.graphData, args.runNode])
}
