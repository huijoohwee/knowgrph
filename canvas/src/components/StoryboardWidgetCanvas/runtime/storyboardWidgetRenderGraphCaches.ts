import { readStoryboardWidgetRuntimeCacheEntry, writeStoryboardWidgetRuntimeCacheEntry } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRuntimeCache'
import type {
  StoryboardWidgetOverlayEdgeGraphLookup,
  StoryboardWidgetRenderGraphLookup,
  StoryboardWidgetPlacementContext,
  StoryboardWidgetWorkflowNodeResolutionContext,
  StoryboardWidgetWorkflowRunPlan,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRenderGraph'

const STORYBOARD_WIDGET_RENDER_GRAPH_CACHE_LIMIT = 48
const STORYBOARD_WIDGET_OVERLAY_EDGE_GRAPH_CACHE_LIMIT = 24
const STORYBOARD_WIDGET_WIDGET_PLACEMENT_CONTEXT_CACHE_LIMIT = 24
const STORYBOARD_WIDGET_WORKFLOW_RUN_PLAN_CACHE_LIMIT = 24
const STORYBOARD_WIDGET_WORKFLOW_NODE_RESOLUTION_CONTEXT_CACHE_LIMIT = 24

const storyboardWidgetRenderGraphCache = new Map<string, StoryboardWidgetRenderGraphLookup>()
const storyboardWidgetOverlayEdgeGraphCache = new Map<string, StoryboardWidgetOverlayEdgeGraphLookup>()
const storyboardWidgetPlacementContextCache = new Map<string, StoryboardWidgetPlacementContext>()
const storyboardWidgetWorkflowRunPlanCache = new Map<string, StoryboardWidgetWorkflowRunPlan>()
const storyboardWidgetWorkflowNodeResolutionContextCache = new Map<string, StoryboardWidgetWorkflowNodeResolutionContext>()

export const readCachedStoryboardWidgetRenderGraph = (cacheKey: string): StoryboardWidgetRenderGraphLookup | null =>
  readStoryboardWidgetRuntimeCacheEntry(storyboardWidgetRenderGraphCache, cacheKey)

export const writeCachedStoryboardWidgetRenderGraph = (
  cacheKey: string,
  value: StoryboardWidgetRenderGraphLookup,
): StoryboardWidgetRenderGraphLookup =>
  writeStoryboardWidgetRuntimeCacheEntry(storyboardWidgetRenderGraphCache, cacheKey, value, STORYBOARD_WIDGET_RENDER_GRAPH_CACHE_LIMIT)

export const readCachedStoryboardWidgetOverlayEdgeGraph = (cacheKey: string): StoryboardWidgetOverlayEdgeGraphLookup | null =>
  readStoryboardWidgetRuntimeCacheEntry(storyboardWidgetOverlayEdgeGraphCache, cacheKey)

export const writeCachedStoryboardWidgetOverlayEdgeGraph = (
  cacheKey: string,
  value: StoryboardWidgetOverlayEdgeGraphLookup,
): StoryboardWidgetOverlayEdgeGraphLookup =>
  writeStoryboardWidgetRuntimeCacheEntry(storyboardWidgetOverlayEdgeGraphCache, cacheKey, value, STORYBOARD_WIDGET_OVERLAY_EDGE_GRAPH_CACHE_LIMIT)

export const readCachedStoryboardWidgetPlacementContext = (cacheKey: string): StoryboardWidgetPlacementContext | null =>
  readStoryboardWidgetRuntimeCacheEntry(storyboardWidgetPlacementContextCache, cacheKey)

export const writeCachedStoryboardWidgetPlacementContext = (
  cacheKey: string,
  value: StoryboardWidgetPlacementContext,
): StoryboardWidgetPlacementContext =>
  writeStoryboardWidgetRuntimeCacheEntry(storyboardWidgetPlacementContextCache, cacheKey, value, STORYBOARD_WIDGET_WIDGET_PLACEMENT_CONTEXT_CACHE_LIMIT)

export const readCachedStoryboardWidgetWorkflowRunPlan = (cacheKey: string): StoryboardWidgetWorkflowRunPlan | null =>
  readStoryboardWidgetRuntimeCacheEntry(storyboardWidgetWorkflowRunPlanCache, cacheKey)

export const writeCachedStoryboardWidgetWorkflowRunPlan = (
  cacheKey: string,
  value: StoryboardWidgetWorkflowRunPlan,
): StoryboardWidgetWorkflowRunPlan =>
  writeStoryboardWidgetRuntimeCacheEntry(storyboardWidgetWorkflowRunPlanCache, cacheKey, value, STORYBOARD_WIDGET_WORKFLOW_RUN_PLAN_CACHE_LIMIT)

export const readCachedStoryboardWidgetWorkflowNodeResolutionContext = (cacheKey: string): StoryboardWidgetWorkflowNodeResolutionContext | null =>
  readStoryboardWidgetRuntimeCacheEntry(storyboardWidgetWorkflowNodeResolutionContextCache, cacheKey)

export const writeCachedStoryboardWidgetWorkflowNodeResolutionContext = (
  cacheKey: string,
  value: StoryboardWidgetWorkflowNodeResolutionContext,
): StoryboardWidgetWorkflowNodeResolutionContext =>
  writeStoryboardWidgetRuntimeCacheEntry(
    storyboardWidgetWorkflowNodeResolutionContextCache,
    cacheKey,
    value,
    STORYBOARD_WIDGET_WORKFLOW_NODE_RESOLUTION_CONTEXT_CACHE_LIMIT,
  )
