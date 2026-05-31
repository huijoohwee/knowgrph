import { hashText } from '@/features/parsers/hash'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

type GraphProps = Record<string, JSONValue>

export type StrytreeWorkflowResult = {
  graphData: GraphData
  changed: boolean
  kind: 'success' | 'warning'
  message: string
  createdNodeId?: string
}

const cleanText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim()

const asJson = (value: unknown): JSONValue => value as JSONValue

const readNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const readBoolean = (value: unknown): boolean => value === true || String(value || '').trim().toLowerCase() === 'true'

const readProps = (node: GraphNode | null | undefined): GraphProps => {
  const props = node?.properties
  return props && typeof props === 'object' && !Array.isArray(props) ? props as GraphProps : {}
}

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const text = cleanText(item)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

const writeTags = (existing: unknown, add: readonly string[], remove: readonly string[] = []): string[] => {
  const removeSet = new Set(remove.map(item => cleanText(item).toLowerCase()).filter(Boolean))
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of [...readStringArray(existing), ...add]) {
    const text = cleanText(item)
    if (!text) continue
    const key = text.toLowerCase()
    if (removeSet.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

const edgeId = (source: string, target: string, label: string): string => {
  return `strytree:edge:${hashText(`${source}:${label}:${target}`).slice(0, 12)}`
}

const makeEdge = (source: string, target: string, label: string): GraphEdge => ({
  id: edgeId(source, target, label),
  source,
  target,
  label,
  properties: {
    evidenceKind: asJson('user-edit'),
    confidence: asJson('medium'),
  },
})

const findStoryNode = (nodes: readonly GraphNode[], nodeId: string): GraphNode | null => {
  return nodes.find(node => cleanText(node.id) === nodeId && cleanText(node.type) === 'StorytreeNode') || null
}

const findSnapshotNode = (nodes: readonly GraphNode[], storyId: string): GraphNode | null => {
  return nodes.find(node => cleanText(node.type) === 'StorytreeSnapshot' && cleanText(readProps(node).strytreeStoryId) === storyId) || null
}

const appendLedgerEvent = (props: GraphProps, event: Record<string, JSONValue>): GraphProps => {
  const current = Array.isArray(props.strytreeLedgerEvents) ? props.strytreeLedgerEvents : []
  return {
    ...props,
    strytreeLedgerEvents: asJson([...current, event]),
  }
}

const cloneGraphNodes = (graphData: GraphData): GraphNode[] => {
  return (Array.isArray(graphData.nodes) ? graphData.nodes : []).map(node => ({
    ...node,
    properties: { ...readProps(node) } as GraphNode['properties'],
  }))
}

const cloneGraphEdges = (graphData: GraphData): GraphEdge[] => {
  return (Array.isArray(graphData.edges) ? graphData.edges : []).map(edge => ({
    ...edge,
    properties: edge.properties && typeof edge.properties === 'object' && !Array.isArray(edge.properties)
      ? { ...edge.properties }
      : edge.properties,
  }))
}

const withGraph = (graphData: GraphData, nodes: GraphNode[], edges?: GraphEdge[]): GraphData => ({
  ...graphData,
  nodes,
  edges: edges || cloneGraphEdges(graphData),
  metadata: {
    ...(graphData.metadata || {}),
    strytreeWorkflowUpdatedAtMs: Date.now(),
  } as GraphData['metadata'],
})

export const toggleStrytreeLikeAction = (graphData: GraphData, nodeId: string): StrytreeWorkflowResult => {
  const nodes = cloneGraphNodes(graphData)
  const target = findStoryNode(nodes, nodeId)
  if (!target) return { graphData, changed: false, kind: 'warning', message: 'Storytree branch is not available.' }
  const props = readProps(target)
  const liked = readBoolean(props.likedByCurrentUser)
  const likes = Math.max(0, readNumber(props.likes, 0) + (liked ? -1 : 1))
  const impressions = Math.max(0, readNumber(props.impressions, 0))
  target.properties = {
    ...props,
    likes: asJson(likes),
    likeRate: asJson(impressions > 0 ? Number(((likes / impressions) * 100).toFixed(1)) : null),
    likedByCurrentUser: asJson(!liked),
    engagementScore: asJson(Number((likes + Math.max(0, readNumber(props.paidUnlocks, 0)) * 3 + Math.max(0, readNumber(props.likeRate, 0))).toFixed(1))),
    tags: asJson(writeTags(props.tags, [liked ? 'like-removed' : 'liked'], [liked ? 'liked' : 'like-removed'])),
  } as GraphNode['properties']
  return {
    graphData: withGraph(graphData, nodes),
    changed: true,
    kind: 'success',
    message: liked ? 'Storytree like removed.' : 'Storytree branch liked.',
  }
}

export const unlockStrytreeNodeAction = (graphData: GraphData, nodeId: string, nowMs = Date.now()): StrytreeWorkflowResult => {
  const nodes = cloneGraphNodes(graphData)
  const target = findStoryNode(nodes, nodeId)
  if (!target) return { graphData, changed: false, kind: 'warning', message: 'Storytree branch is not available.' }
  const props = readProps(target)
  if (readBoolean(props.unlockedByCurrentUser) || cleanText(props.accessState) === 'open') {
    return { graphData, changed: false, kind: 'warning', message: 'Storytree branch is already open.' }
  }
  const storyId = cleanText(props.strytreeStoryId)
  const snapshot = findSnapshotNode(nodes, storyId)
  const snapshotProps = readProps(snapshot)
  const tokenBalance = Math.max(0, readNumber(snapshotProps.tokenBalance, readNumber(props.tokenBalance, 0)))
  const unlockPriceCredits = Math.max(0, readNumber(props.unlockPriceCredits, 0))
  if (unlockPriceCredits > tokenBalance) {
    return { graphData, changed: false, kind: 'warning', message: 'Storytree branch needs more credit tokens before unlock.' }
  }
  const nextBalance = Math.max(0, tokenBalance - unlockPriceCredits)
  const paidUnlocks = Math.max(0, readNumber(props.paidUnlocks, 0)) + (unlockPriceCredits > 0 ? 1 : 0)
  target.properties = {
    ...props,
    unlockRequired: asJson(false),
    canUnlock: asJson(true),
    unlockedByCurrentUser: asJson(true),
    accessState: asJson('open'),
    paidUnlocks: asJson(paidUnlocks),
    projectedBalanceAfterUnlock: asJson(nextBalance),
    tags: asJson(writeTags(props.tags, ['unlocked'], ['unlock-ready', 'unlock-needs-credits', 'protected'])),
  } as GraphNode['properties']
  if (snapshot) {
    snapshot.properties = appendLedgerEvent({
      ...snapshotProps,
      tokenBalance: asJson(nextBalance),
      totalPaidUnlocks: asJson(Math.max(0, readNumber(snapshotProps.totalPaidUnlocks, 0)) + (unlockPriceCredits > 0 ? 1 : 0)),
    }, {
      eventType: asJson('unlock_debit'),
      nodeId: asJson(cleanText(props.strytreeNodeId) || nodeId),
      amountCredits: asJson(unlockPriceCredits),
      balanceAfter: asJson(nextBalance),
      createdAtMs: asJson(nowMs),
    }) as GraphNode['properties']
  }
  return {
    graphData: withGraph(graphData, nodes),
    changed: true,
    kind: 'success',
    message: 'Storytree branch unlocked with a local credit-ledger event.',
  }
}

export const createStrytreeContinuationDraftAction = (
  graphData: GraphData,
  parentGraphNodeId: string,
  opts: { prompt?: string; nowMs?: number } = {},
): StrytreeWorkflowResult => {
  const nowMs = opts.nowMs ?? Date.now()
  const nodes = cloneGraphNodes(graphData)
  const edges = cloneGraphEdges(graphData)
  const parent = findStoryNode(nodes, parentGraphNodeId)
  if (!parent) return { graphData, changed: false, kind: 'warning', message: 'Storytree branch is not available.' }
  const parentProps = readProps(parent)
  if (cleanText(parentProps.strytreeStatus) === 'dropped' || cleanText(parentProps.branchStatus) === 'dropped') {
    return { graphData, changed: false, kind: 'warning', message: 'Dropped storytree branches stay audit-only.' }
  }
  const storyId = cleanText(parentProps.strytreeStoryId)
  const snapshot = findSnapshotNode(nodes, storyId)
  const snapshotProps = readProps(snapshot)
  const tokenBalance = Math.max(0, readNumber(snapshotProps.tokenBalance, 0))
  const generationCostCredits = Math.max(0, readNumber(snapshotProps.generationCostCredits, readNumber(parentProps.generationCostCredits, 5)))
  if (generationCostCredits > tokenBalance) {
    return { graphData, changed: false, kind: 'warning', message: 'Storytree continuation needs more credit tokens before generation.' }
  }
  const nextBalance = Math.max(0, tokenBalance - generationCostCredits)
  const parentStoryNodeId = cleanText(parentProps.strytreeNodeId) || parentGraphNodeId
  const draftStoryNodeId = `draft_${hashText(`${storyId}:${parentStoryNodeId}:${nowMs}`).slice(0, 12)}`
  const draftGraphNodeId = `strytree:node:${hashText(draftStoryNodeId).slice(0, 12)}`
  const inheritedAssetIds = readStringArray(parentProps.allAssetIds).length > 0
    ? readStringArray(parentProps.allAssetIds)
    : readStringArray(parentProps.inheritedAssetIds)
  const title = 'Draft continuation'
  const prompt = cleanText(opts.prompt) || cleanText(parentProps.prompt) || `Continue from ${cleanText(parent.label) || 'this branch'}.`
  const depth = Math.max(0, readNumber(parentProps.depth, 0)) + 1
  nodes.push({
    id: draftGraphNodeId,
    label: title,
    type: 'StorytreeNode',
    properties: {
      title: asJson(title),
      lane: asJson('Storytree'),
      order: asJson(Math.max(0, readNumber(parentProps.order, nodes.length)) + 0.5),
      index: asJson(`${depth + 1}.${nodes.length + 1}`),
      slugline: asJson(`Depth ${depth} / draft / ${cleanText(snapshotProps.unlockCurrency) || 'credits'}`),
      summary: asJson('Queued continuation draft from an existing storytree branch.'),
      action: asJson('Review the prompt, then run the approved Strybldr handoff through the provider-safe generation harness.'),
      prompt: asJson(prompt),
      branchStatus: asJson('draft'),
      strytreeStatus: asJson('draft'),
      tags: asJson(writeTags([], ['story-branch', 'draft', `depth:${depth}`, 'generation-queued'])),
      strytreeStoryId: asJson(storyId),
      strytreeNodeId: asJson(draftStoryNodeId),
      parent_node_id: asJson(parentStoryNodeId),
      parentNodeId: asJson(parentStoryNodeId),
      authorName: asJson('Knowgrph local draft'),
      isFreeWindow: asJson(false),
      isProtected: asJson(false),
      unlockPriceCredits: asJson(0),
      likes: asJson(0),
      impressions: asJson(0),
      likeRate: asJson(null),
      paidUnlocks: asJson(0),
      childBranchCount: asJson(0),
      depth: asJson(depth),
      pathNodeIds: asJson([...readStringArray(parentProps.pathNodeIds), draftStoryNodeId]),
      inheritedAssetIds: asJson(inheritedAssetIds),
      allAssetIds: asJson(inheritedAssetIds),
      unlockRequired: asJson(false),
      canUnlock: asJson(true),
      accessState: asJson('draft'),
      generationAffordable: asJson(true),
      generationQueuedAtMs: asJson(nowMs),
      generationCostCredits: asJson(generationCostCredits),
      projectedBalanceAfterGeneration: asJson(nextBalance),
      references: asJson(inheritedAssetIds),
    },
  })
  parent.properties = {
    ...parentProps,
    childBranchCount: asJson(Math.max(0, readNumber(parentProps.childBranchCount, 0)) + 1),
  } as GraphNode['properties']
  edges.push(makeEdge(parentGraphNodeId, draftGraphNodeId, 'parent_node_id'))
  if (snapshot) {
    snapshot.properties = appendLedgerEvent({
      ...snapshotProps,
      tokenBalance: asJson(nextBalance),
      activeBranchCount: asJson(Math.max(0, readNumber(snapshotProps.activeBranchCount, 0)) + 1),
    }, {
      eventType: asJson('generation_debit'),
      nodeId: asJson(draftStoryNodeId),
      parentNodeId: asJson(parentStoryNodeId),
      amountCredits: asJson(generationCostCredits),
      balanceAfter: asJson(nextBalance),
      createdAtMs: asJson(nowMs),
    }) as GraphNode['properties']
  }
  return {
    graphData: withGraph(graphData, nodes, edges),
    changed: true,
    kind: 'success',
    message: 'Storytree continuation draft queued for Strybldr Run all.',
    createdNodeId: draftGraphNodeId,
  }
}
