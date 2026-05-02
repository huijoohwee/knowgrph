import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import {
  emitRendererPanelOpen,
  RENDERER_FLOATING_PANEL_OPEN_EVENT,
  RENDERER_PANEL_OPEN_EVENT,
} from '@/features/canvas/utils'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testRendererPanelOpenEmitsSharedDualEventContract = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const events: string[] = []
  const onRenderer = () => events.push(RENDERER_PANEL_OPEN_EVENT)
  const onFloating = () => events.push(RENDERER_FLOATING_PANEL_OPEN_EVENT)
  dom.window.addEventListener(RENDERER_PANEL_OPEN_EVENT, onRenderer as EventListener)
  dom.window.addEventListener(RENDERER_FLOATING_PANEL_OPEN_EVENT, onFloating as EventListener)

  emitRendererPanelOpen()
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  if (!events.includes(RENDERER_PANEL_OPEN_EVENT)) {
    throw new Error('expected renderer panel open helper to emit the renderer panel open event')
  }
  if (!events.includes(RENDERER_FLOATING_PANEL_OPEN_EVENT)) {
    throw new Error('expected renderer panel open helper to emit the floating renderer panel open event')
  }

  dom.window.removeEventListener(RENDERER_PANEL_OPEN_EVENT, onRenderer as EventListener)
  dom.window.removeEventListener(RENDERER_FLOATING_PANEL_OPEN_EVENT, onFloating as EventListener)
}

export const testRendererPanelOpenUsesSharedPlainEventDispatcherBoundary = () => {
  const utilsText = readUtf8('src/features/canvas/utils.ts')
  const spotlightText = readUtf8('src/features/spotlight/LaunchSpotlightTourCard.tsx')

  if (!utilsText.includes('function emitCanvasEvent')) {
    throw new Error('expected canvas utils to centralize repeated plain Event dispatch in a shared helper')
  }
  if (!utilsText.includes('new EventCtor(eventName)')) {
    throw new Error('expected canvas utils shared plain-event dispatcher to own Event construction')
  }
  if (!utilsText.includes('emitCanvasEvent(RENDERER_PANEL_OPEN_EVENT)')) {
    throw new Error('expected renderer panel open helper to dispatch the shared renderer panel event via the shared plain-event helper')
  }
  if (!utilsText.includes('emitCanvasEvent(RENDERER_FLOATING_PANEL_OPEN_EVENT)')) {
    throw new Error('expected renderer panel open helper to dispatch the shared floating renderer panel event via the shared plain-event helper')
  }
  if (utilsText.includes('new Event(RENDERER_PANEL_OPEN_EVENT)')) {
    throw new Error('expected renderer panel open helper to avoid inline Event construction for renderer panel open')
  }
  if (utilsText.includes('new Event(RENDERER_FLOATING_PANEL_OPEN_EVENT)')) {
    throw new Error('expected renderer panel open helper to avoid inline Event construction for floating renderer panel open')
  }
  if (!spotlightText.includes('emitRendererPanelOpen()')) {
    throw new Error('expected LaunchSpotlightTourCard to keep using the shared renderer panel open helper')
  }
}
