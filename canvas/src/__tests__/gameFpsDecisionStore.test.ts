import assert from 'node:assert/strict'
import test from 'node:test'
import type { WorkspaceEntry, WorkspaceFs } from '../features/workspace-fs/types'
import {
  GAME_FPS_SAVE_PATH,
  loadGameFpsSavedDecisions,
  persistPendingGameFpsDecisions,
  queueGameFpsDecisions,
  readGameFpsDecisionStore,
  resetGameFpsDecisionStoreForTests,
  resetGameFpsLocalSave,
} from '../features/game-fps/gameFpsDecisionStore'
import type { GameFpsDecisionRecord } from '../features/game-fps/gameFpsModel'

const DECISION: GameFpsDecisionRecord = Object.freeze({
  decisionId: 'game-fps:test:mission-completed',
  decisionType: 'quest_flag',
  entityRef: 'game-fps:mission:game-fps-mission-1',
  payload: Object.freeze({
    event: 'mission_completed',
    missionId: 'game-fps-mission-1',
    status: 'won',
    tick: 42,
  }),
  producedAt: '2026-01-01T00:00:00.000Z',
})

function testWorkspace(initialText?: string): WorkspaceFs {
  const entries = new Map<string, WorkspaceEntry>()
  entries.set('/', { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 0 })
  if (initialText !== undefined) {
    entries.set('/game-fps', { path: '/game-fps', parentPath: '/', kind: 'folder', name: 'game-fps', updatedAtMs: 0 })
    entries.set(GAME_FPS_SAVE_PATH, {
      path: GAME_FPS_SAVE_PATH,
      parentPath: '/game-fps',
      kind: 'file',
      name: 'mission-1-decisions.md',
      text: initialText,
      updatedAtMs: 0,
    })
  }
  return {
    ensureSeed: async () => false,
    listEntries: async () => [...entries.values()],
    readFileText: async path => entries.get(path)?.text ?? null,
    writeFileText: async (path, text) => {
      const prior = entries.get(path)
      if (prior?.kind === 'file') entries.set(path, { ...prior, text })
    },
    createFolder: async ({ parentPath, name }) => {
      const path = `${parentPath === '/' ? '' : parentPath}/${name}`
      entries.set(path, { path, parentPath, kind: 'folder', name, updatedAtMs: 0 })
      return path
    },
    createFile: async ({ parentPath, name, text }) => {
      const path = `${parentPath === '/' ? '' : parentPath}/${name}`
      entries.set(path, { path, parentPath, kind: 'file', name, text, updatedAtMs: 0 })
      return path
    },
    deleteEntry: async path => {
      entries.delete(path)
    },
  }
}

test('Game FPS Decision save verifies read-back and is idempotent', async () => {
  resetGameFpsDecisionStoreForTests()
  const workspace = testWorkspace()
  queueGameFpsDecisions([DECISION])
  const saved = await persistPendingGameFpsDecisions({ workspace })
  assert.equal(saved.status, 'saved')
  assert.equal(saved.retainedCount, 0)
  assert.deepEqual(await loadGameFpsSavedDecisions({ workspace }), [DECISION])

  queueGameFpsDecisions([DECISION])
  const idempotent = await persistPendingGameFpsDecisions({ workspace })
  assert.equal(idempotent.status, 'saved')
  assert.equal(idempotent.retainedCount, 0)
  assert.deepEqual(await loadGameFpsSavedDecisions({ workspace }), [DECISION])
})

test('Game FPS Decision write failure retains pending state and source bytes', async () => {
  resetGameFpsDecisionStoreForTests()
  const base = testWorkspace()
  const failing: WorkspaceFs = {
    ...base,
    writeFileText: async () => { throw new Error('write denied') },
    createFile: async () => { throw new Error('create denied') },
  }
  const before = await failing.readFileText(GAME_FPS_SAVE_PATH)
  queueGameFpsDecisions([DECISION])
  const failed = await persistPendingGameFpsDecisions({ workspace: failing })
  assert.equal(failed.status, 'error')
  assert.equal(failed.retainedCount, 1)
  assert.match(failed.error || '', /denied/)
  assert.equal(await failing.readFileText(GAME_FPS_SAVE_PATH), before)
})

test('Game FPS malformed save fails closed until explicit reset', async () => {
  resetGameFpsDecisionStoreForTests()
  const malformed = '---\nflow:\n  nodes: [not valid\n---\n'
  const workspace = testWorkspace(malformed)
  await assert.rejects(() => loadGameFpsSavedDecisions({ workspace }))
  assert.equal(readGameFpsDecisionStore().status, 'error')
  assert.equal(await workspace.readFileText(GAME_FPS_SAVE_PATH), malformed)

  const reset = await resetGameFpsLocalSave({ workspace })
  assert.equal(reset.status, 'saved')
  assert.deepEqual(await loadGameFpsSavedDecisions({ workspace }), [])
})
