import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { createUniqueId } from '@/lib/ids'

export const TEXT_SELECTION_WIDGET_LINK_SCHEMA = 'knowgrph-text-selection-widget-link/v1'
export const TEXT_SELECTION_WIDGET_CREATE_EVENT = 'knowgrph:text-selection-widget-create'

export type TextSelectionWidgetLinkSession = {
  sourceNodeId: string
  selectedText: string
  startLine: number
  endLine: number
  documentPath: string
  createdAt: string
}

export type TextSelectionWidgetTarget = {
  registryEntryId: string
  nodeTypeId: string
  widgetTypeId: string
  formId: string
  layoutVariantId?: string
}

export type TextSelectionWidgetCreateDetail = {
  session: TextSelectionWidgetLinkSession
  target: TextSelectionWidgetTarget
  claimed: boolean
}

const listeners = new Set<() => void>()
let activeSession: TextSelectionWidgetLinkSession | null = null

function notify(): void {
  listeners.forEach(listener => listener())
}

function normalizeLine(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback
}

export function beginTextSelectionWidgetLinkSession(
  input: Omit<TextSelectionWidgetLinkSession, 'createdAt'>,
): TextSelectionWidgetLinkSession | null {
  const sourceNodeId = String(input.sourceNodeId || '').trim()
  const selectedText = String(input.selectedText || '').trim()
  if (!sourceNodeId || !selectedText) return null
  const startLine = normalizeLine(input.startLine, 1)
  activeSession = {
    sourceNodeId,
    selectedText,
    startLine,
    endLine: Math.max(startLine, normalizeLine(input.endLine, startLine)),
    documentPath: String(input.documentPath || '').trim(),
    createdAt: new Date().toISOString(),
  }
  notify()
  return activeSession
}

export function clearTextSelectionWidgetLinkSession(): void {
  if (!activeSession) return
  activeSession = null
  notify()
}

export function getTextSelectionWidgetLinkSnapshot(): TextSelectionWidgetLinkSession | null {
  return activeSession
}

export function subscribeTextSelectionWidgetLink(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function dispatchTextSelectionWidgetCreate(target: TextSelectionWidgetTarget): boolean {
  if (typeof window === 'undefined' || !activeSession) return false
  const detail: TextSelectionWidgetCreateDetail = {
    session: activeSession,
    target,
    claimed: false,
  }
  window.dispatchEvent(new window.CustomEvent<TextSelectionWidgetCreateDetail>(
    TEXT_SELECTION_WIDGET_CREATE_EVENT,
    { detail },
  ))
  return detail.claimed
}

export function resolveTextSelectionWidgetTargetPosition(args: {
  sourceNode: GraphNode
  fallbackGap?: number
}): { x: number; y: number } {
  const source = args.sourceNode
  const properties = source.properties && typeof source.properties === 'object'
    ? source.properties as Record<string, unknown>
    : {}
  const widthCandidates = [
    properties['visual:width'],
    properties.width,
    properties.panelWidth,
  ]
  const width = widthCandidates
    .map(Number)
    .find(candidate => Number.isFinite(candidate) && candidate > 0)
  const gap = Number.isFinite(args.fallbackGap) ? Math.max(80, Number(args.fallbackGap)) : 560
  return {
    x: (Number.isFinite(source.x) ? Number(source.x) : 0) + Math.max(gap, (width || 0) + 120),
    y: Number.isFinite(source.y) ? Number(source.y) : 0,
  }
}

export function buildTextSelectionWidgetEdge(args: {
  graphData: GraphData
  session: TextSelectionWidgetLinkSession
  targetNodeId: string
}): GraphEdge | null {
  const sourceNodeId = String(args.session.sourceNodeId || '').trim()
  const targetNodeId = String(args.targetNodeId || '').trim()
  if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return null
  const nodeIds = new Set((args.graphData.nodes || []).map(node => String(node.id || '').trim()))
  if (!nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) return null
  const duplicate = (args.graphData.edges || []).find(edge => (
    String(edge.source || '').trim() === sourceNodeId
    && String(edge.target || '').trim() === targetNodeId
    && String(edge.properties?.schema || '').trim() === TEXT_SELECTION_WIDGET_LINK_SCHEMA
    && String(edge.properties?.['selection:text'] || '').trim() === args.session.selectedText
  ))
  if (duplicate) return duplicate
  const edgeIds = new Set((args.graphData.edges || []).map(edge => String(edge.id || '').trim()))
  const properties: Record<string, JSONValue> = {
    schema: TEXT_SELECTION_WIDGET_LINK_SCHEMA,
    'selection:text': args.session.selectedText,
    'selection:startLine': args.session.startLine,
    'selection:endLine': args.session.endLine,
    'selection:createdAt': args.session.createdAt,
  }
  if (args.session.documentPath) properties['selection:documentPath'] = args.session.documentPath
  return {
    id: createUniqueId('e', edgeIds),
    source: sourceNodeId,
    target: targetNodeId,
    label: 'selection',
    properties,
  }
}
