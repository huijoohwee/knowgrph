import { readFlowEditorRuntimeCacheEntry, writeFlowEditorRuntimeCacheEntry } from '@/components/FlowEditorCanvas/runtime/flowEditorRuntimeCache'
import type {
  FlowEditorOverlayEdgeGraphLookup,
  FlowEditorRenderGraphLookup,
  FlowEditorWidgetPlacementContext,
  FlowEditorWorkflowNodeResolutionContext,
  FlowEditorWorkflowRunPlan,
} from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'

const FLOW_EDITOR_RENDER_GRAPH_CACHE_LIMIT = 48
const FLOW_EDITOR_OVERLAY_EDGE_GRAPH_CACHE_LIMIT = 24
const FLOW_EDITOR_WIDGET_PLACEMENT_CONTEXT_CACHE_LIMIT = 24
const FLOW_EDITOR_WORKFLOW_RUN_PLAN_CACHE_LIMIT = 24
const FLOW_EDITOR_WORKFLOW_NODE_RESOLUTION_CONTEXT_CACHE_LIMIT = 24

const flowEditorRenderGraphCache = new Map<string, FlowEditorRenderGraphLookup>()
const flowEditorOverlayEdgeGraphCache = new Map<string, FlowEditorOverlayEdgeGraphLookup>()
const flowEditorWidgetPlacementContextCache = new Map<string, FlowEditorWidgetPlacementContext>()
const flowEditorWorkflowRunPlanCache = new Map<string, FlowEditorWorkflowRunPlan>()
const flowEditorWorkflowNodeResolutionContextCache = new Map<string, FlowEditorWorkflowNodeResolutionContext>()

export const readCachedFlowEditorRenderGraph = (cacheKey: string): FlowEditorRenderGraphLookup | null =>
  readFlowEditorRuntimeCacheEntry(flowEditorRenderGraphCache, cacheKey)

export const writeCachedFlowEditorRenderGraph = (
  cacheKey: string,
  value: FlowEditorRenderGraphLookup,
): FlowEditorRenderGraphLookup =>
  writeFlowEditorRuntimeCacheEntry(flowEditorRenderGraphCache, cacheKey, value, FLOW_EDITOR_RENDER_GRAPH_CACHE_LIMIT)

export const readCachedFlowEditorOverlayEdgeGraph = (cacheKey: string): FlowEditorOverlayEdgeGraphLookup | null =>
  readFlowEditorRuntimeCacheEntry(flowEditorOverlayEdgeGraphCache, cacheKey)

export const writeCachedFlowEditorOverlayEdgeGraph = (
  cacheKey: string,
  value: FlowEditorOverlayEdgeGraphLookup,
): FlowEditorOverlayEdgeGraphLookup =>
  writeFlowEditorRuntimeCacheEntry(flowEditorOverlayEdgeGraphCache, cacheKey, value, FLOW_EDITOR_OVERLAY_EDGE_GRAPH_CACHE_LIMIT)

export const readCachedFlowEditorWidgetPlacementContext = (cacheKey: string): FlowEditorWidgetPlacementContext | null =>
  readFlowEditorRuntimeCacheEntry(flowEditorWidgetPlacementContextCache, cacheKey)

export const writeCachedFlowEditorWidgetPlacementContext = (
  cacheKey: string,
  value: FlowEditorWidgetPlacementContext,
): FlowEditorWidgetPlacementContext =>
  writeFlowEditorRuntimeCacheEntry(flowEditorWidgetPlacementContextCache, cacheKey, value, FLOW_EDITOR_WIDGET_PLACEMENT_CONTEXT_CACHE_LIMIT)

export const readCachedFlowEditorWorkflowRunPlan = (cacheKey: string): FlowEditorWorkflowRunPlan | null =>
  readFlowEditorRuntimeCacheEntry(flowEditorWorkflowRunPlanCache, cacheKey)

export const writeCachedFlowEditorWorkflowRunPlan = (
  cacheKey: string,
  value: FlowEditorWorkflowRunPlan,
): FlowEditorWorkflowRunPlan =>
  writeFlowEditorRuntimeCacheEntry(flowEditorWorkflowRunPlanCache, cacheKey, value, FLOW_EDITOR_WORKFLOW_RUN_PLAN_CACHE_LIMIT)

export const readCachedFlowEditorWorkflowNodeResolutionContext = (cacheKey: string): FlowEditorWorkflowNodeResolutionContext | null =>
  readFlowEditorRuntimeCacheEntry(flowEditorWorkflowNodeResolutionContextCache, cacheKey)

export const writeCachedFlowEditorWorkflowNodeResolutionContext = (
  cacheKey: string,
  value: FlowEditorWorkflowNodeResolutionContext,
): FlowEditorWorkflowNodeResolutionContext =>
  writeFlowEditorRuntimeCacheEntry(
    flowEditorWorkflowNodeResolutionContextCache,
    cacheKey,
    value,
    FLOW_EDITOR_WORKFLOW_NODE_RESOLUTION_CONTEXT_CACHE_LIMIT,
  )
