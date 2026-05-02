import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import {
  emitWorkspaceTablePreferencesChanged,
  subscribeWorkspaceTablePreferencesChanged,
  WORKSPACE_TABLE_PREFS_EVENT,
} from '@/features/workspace-table/workspaceTablePreferencesEvents'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testWorkspaceTablePreferencesHelpersDispatchAndSubscribe = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  let notifications = 0
  const unsubscribe = subscribeWorkspaceTablePreferencesChanged(() => {
    notifications += 1
  })

  emitWorkspaceTablePreferencesChanged()
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  if (notifications !== 1) {
    throw new Error(`expected shared workspace-table prefs helper to notify once, got ${notifications}`)
  }

  unsubscribe()
  emitWorkspaceTablePreferencesChanged()
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  if (notifications !== 1) {
    throw new Error('expected shared workspace-table prefs helper unsubscribe to stop notifications')
  }
}

export const testWorkspaceTablePreferencesCallsitesUseSharedContract = () => {
  const eventsText = readUtf8('src/features/workspace-table/workspaceTablePreferencesEvents.ts')
  const storeText = readUtf8('src/features/workspace-table/workspaceTablePreferencesStore.ts')
  const jsonImportText = readUtf8('src/features/workspace-table/jsonImportWorkspaceTarget.ts')

  if (!eventsText.includes('export const WORKSPACE_TABLE_PREFS_EVENT')) {
    throw new Error('expected workspace table prefs event constant to remain in the shared helper module')
  }
  if (!eventsText.includes('export function emitWorkspaceTablePreferencesChanged')) {
    throw new Error('expected workspace table prefs helper module to expose a shared emitter')
  }
  if (!eventsText.includes('export function subscribeWorkspaceTablePreferencesChanged')) {
    throw new Error('expected workspace table prefs helper module to expose a shared subscriber')
  }
  if (!eventsText.includes('new EventCtor(WORKSPACE_TABLE_PREFS_EVENT)')) {
    throw new Error('expected shared workspace table prefs emitter to dispatch using the shared event constant')
  }
  if (!storeText.includes('subscribeWorkspaceTablePreferencesChanged(handleChanged)')) {
    throw new Error('expected workspaceTablePreferencesStore to subscribe via the shared helper')
  }
  if (!jsonImportText.includes("workspaceTablePreferencesStore.setWorkspaceEditorMode('multiDimTable')")) {
    throw new Error('expected applyJsonImportWorkspaceTarget to route workspace mode persistence through the shared workspace-table preference store')
  }
  if (storeText.includes('window.addEventListener(WORKSPACE_TABLE_PREFS_EVENT')) {
    throw new Error('expected workspaceTablePreferencesStore to avoid raw workspace prefs listener wiring')
  }
  if (storeText.includes('window.dispatchEvent(new Event(WORKSPACE_TABLE_PREFS_EVENT))')) {
    throw new Error('expected workspaceTablePreferencesStore to avoid inline workspace prefs event dispatch')
  }
  if (jsonImportText.includes('emitWorkspaceTablePreferencesChanged()')) {
    throw new Error('expected applyJsonImportWorkspaceTarget to stop bypassing the shared workspace-table preference store emitter path')
  }
  if (jsonImportText.includes('window.dispatchEvent(new Event(WORKSPACE_TABLE_PREFS_EVENT))')) {
    throw new Error('expected applyJsonImportWorkspaceTarget to avoid inline workspace prefs event dispatch')
  }
  if (!eventsText.includes(WORKSPACE_TABLE_PREFS_EVENT)) {
    throw new Error('expected shared workspace table prefs event file to own the event name')
  }
}
