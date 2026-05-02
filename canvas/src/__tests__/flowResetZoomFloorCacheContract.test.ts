import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import {
  emitFlowResetZoomFloorCache,
  FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT,
  subscribeFlowResetZoomFloorCache,
} from '@/components/FlowCanvas/shared'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testFlowResetZoomFloorCacheHelpersCentralizeEventDispatchAndSubscription = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  let count = 0
  const unsubscribe = subscribeFlowResetZoomFloorCache(() => {
    count += 1
  })

  emitFlowResetZoomFloorCache()
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  if (count !== 1) {
    throw new Error(`expected shared flow zoom-floor-cache helpers to dispatch one event, got ${count}`)
  }

  let rawCount = 0
  const rawListener = () => {
    rawCount += 1
  }
  dom.window.addEventListener(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT, rawListener as EventListener)
  emitFlowResetZoomFloorCache()
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  if (rawCount !== 1) {
    throw new Error(`expected shared flow zoom-floor-cache event constant to remain dispatchable, got ${rawCount}`)
  }

  dom.window.removeEventListener(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT, rawListener as EventListener)
  unsubscribe()
}

export const testFlowResetZoomFloorCacheCallsitesUseSharedContract = () => {
  const sharedText = readUtf8('src/components/FlowCanvas/shared.ts')
  const runtimeText = readUtf8('src/components/FlowCanvas/useFlowCanvasRuntime.ts')
  const spotlightText = readUtf8('src/features/spotlight/LaunchSpotlightStatusCard.tsx')

  if (!sharedText.includes('export function emitFlowResetZoomFloorCache')) {
    throw new Error('expected FlowCanvas shared module to expose the zoom-floor-cache emitter')
  }
  if (!sharedText.includes('export function subscribeFlowResetZoomFloorCache')) {
    throw new Error('expected FlowCanvas shared module to expose the zoom-floor-cache subscription helper')
  }
  if (!sharedText.includes('new CustomEventCtor(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT)')) {
    throw new Error('expected shared zoom-floor-cache emitter to use the shared event constant')
  }
  if (!runtimeText.includes('subscribeFlowResetZoomFloorCache')) {
    throw new Error('expected Flow canvas runtime to subscribe via the shared zoom-floor-cache helper')
  }
  if (runtimeText.includes('addEventListener(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT')) {
    throw new Error('expected Flow canvas runtime to avoid raw zoom-floor-cache listener wiring')
  }
  if (!spotlightText.includes('emitFlowResetZoomFloorCache()')) {
    throw new Error('expected Spotlight status card to emit via the shared zoom-floor-cache helper')
  }
  if (spotlightText.includes("new CustomEvent(FLOW_RESET_ZOOM_FLOOR_CACHE_EVENT)")) {
    throw new Error('expected Spotlight status card to avoid raw zoom-floor-cache dispatch boilerplate')
  }
}
