import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { upsertWorkspaceTextDocument } from '@/features/workspace-fs/upsertWorkspaceTextDocument'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureWorkspaceFolderTreeIfMissing } from '@/features/workspace-fs/ensureFolderTreeIfMissing'
import {
  mergeDecisionsIntoKgcMarkdown,
  normalizeDecisionBatch,
} from '../../../../ecs/decisionDocument.js'
import {
  ECS_DECISION_NODE_TYPE,
  normalizeDecisionNode,
  readKgcNodeState,
} from '../../../../ecs/kgcNodeContract.js'
import type { GameFpsDecisionRecord } from './gameFpsModel'
import { validateGameFpsDecisions } from './gameFpsMission'

export type { GameFpsDecisionRecord } from './gameFpsModel'

export const GAME_FPS_SAVE_PATH = normalizeWorkspacePath('/game-fps/mission-1-decisions.md')

export type GameFpsDecisionStoreSnapshot = Readonly<{
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorKind: 'load' | 'write' | null
  hydrationBlocked: boolean
  retainedCount: number
  savedCount: number
  error: string | null
  revision: number
}>

const EMPTY_SAVE_DOCUMENT = [
  '---',
  'title: "Knowgrph FPS Mission 1 Decisions"',
  'schema: "kgc-computing-flow/v1"',
  'flow:',
  '  nodes: []',
  '  edges: []',
  '---',
  '',
  '# Mission 1 Decisions',
  '',
  'Only validated `EcsDecision` nodes are persisted in this document.',
  '',
].join('\n')

const listeners = new Set<() => void>()
const pending = new Map<string, GameFpsDecisionRecord>()
let mutationQueue: Promise<GameFpsDecisionStoreSnapshot> | null = null
let snapshot: GameFpsDecisionStoreSnapshot = Object.freeze({
  status: 'idle',
  errorKind: null,
  hydrationBlocked: false,
  retainedCount: 0,
  savedCount: 0,
  error: null,
  revision: 0,
})

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error || 'Decision save failed')
}

function publish(patch: Partial<GameFpsDecisionStoreSnapshot>): GameFpsDecisionStoreSnapshot {
  snapshot = Object.freeze({
    ...snapshot,
    ...patch,
    retainedCount: pending.size,
    revision: snapshot.revision + 1,
  })
  for (const listener of [...listeners]) listener()
  return snapshot
}

export function readGameFpsDecisionStore(): GameFpsDecisionStoreSnapshot {
  return snapshot
}

export function subscribeGameFpsDecisionStore(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function reportGameFpsDecisionLoadFailure(error: unknown): GameFpsDecisionStoreSnapshot {
  return publish({
    status: 'error',
    errorKind: 'load',
    hydrationBlocked: true,
    error: `Unreadable ${GAME_FPS_SAVE_PATH}: ${errorMessage(error)}`,
  })
}

export function queueGameFpsDecisions(decisions: readonly GameFpsDecisionRecord[]): void {
  const normalized = normalizeDecisionBatch([...decisions]) as GameFpsDecisionRecord[]
  for (const decision of normalized) pending.set(decision.decisionId, decision)
  if (snapshot.hydrationBlocked || snapshot.status === 'error') {
    publish({})
    return
  }
  publish({ status: pending.size > 0 ? 'idle' : snapshot.status, errorKind: null, error: null })
}

export async function loadGameFpsSavedDecisions(
  options: { workspace?: WorkspaceFs } = {},
): Promise<GameFpsDecisionRecord[]> {
  try {
    const workspace = options.workspace ?? await getWorkspaceFs()
    const text = await workspace.readFileText(GAME_FPS_SAVE_PATH)
    if (text == null) return []
    const { nodes } = readKgcNodeState(text)
    const decisions: GameFpsDecisionRecord[] = []
    nodes.forEach((node: unknown, index: number) => {
      if ((node as { type?: unknown } | null)?.type !== ECS_DECISION_NODE_TYPE) return
      decisions.push(normalizeDecisionNode(node, index) as GameFpsDecisionRecord)
    })
    const normalizedDecisions = normalizeDecisionBatch(decisions) as GameFpsDecisionRecord[]
    validateGameFpsDecisions(normalizedDecisions)
    if (!snapshot.hydrationBlocked) {
      const preserveRetainedWriteFailure = pending.size > 0
        && snapshot.status === 'error'
        && snapshot.errorKind === 'write'
      const preserveSavedStatus = snapshot.status === 'saved'
        && snapshot.errorKind === null
      publish(preserveRetainedWriteFailure || preserveSavedStatus
        ? { savedCount: normalizedDecisions.length }
        : { status: 'idle', errorKind: null, savedCount: normalizedDecisions.length, error: null })
    }
    return normalizedDecisions
  } catch (error) {
    reportGameFpsDecisionLoadFailure(error)
    throw error
  }
}

async function resetLocalSave(workspaceOverride?: WorkspaceFs): Promise<GameFpsDecisionStoreSnapshot> {
  try {
    const workspace = workspaceOverride ?? await getWorkspaceFs()
    await ensureWorkspaceFolderTreeIfMissing({
      fs: workspace,
      folderPath: normalizeWorkspacePath('/game-fps'),
    })
    await upsertWorkspaceTextDocument({
      fs: workspace,
      parentPath: normalizeWorkspacePath('/game-fps'),
      name: 'mission-1-decisions.md',
      text: EMPTY_SAVE_DOCUMENT,
    })
    const readBack = await workspace.readFileText(GAME_FPS_SAVE_PATH)
    if (readBack !== EMPTY_SAVE_DOCUMENT) throw new Error('Reset save read-back mismatch')
    pending.clear()
    return publish({ status: 'saved', errorKind: null, hydrationBlocked: false, savedCount: 0, error: null })
  } catch (error) {
    return publish({
      status: 'error',
      errorKind: snapshot.hydrationBlocked ? 'load' : 'write',
      error: errorMessage(error),
    })
  }
}

function enqueueDecisionMutation(
  mutation: () => Promise<GameFpsDecisionStoreSnapshot>,
): Promise<GameFpsDecisionStoreSnapshot> {
  mutationQueue = (mutationQueue ?? Promise.resolve(snapshot))
    .catch(() => snapshot)
    .then(mutation)
  return mutationQueue
}

export function resetGameFpsLocalSave(
  options: { workspace?: WorkspaceFs } = {},
): Promise<GameFpsDecisionStoreSnapshot> {
  return enqueueDecisionMutation(() => resetLocalSave(options.workspace))
}

async function persistPending(workspaceOverride?: WorkspaceFs): Promise<GameFpsDecisionStoreSnapshot> {
  if (snapshot.hydrationBlocked) return publish({})
  if (pending.size === 0) return publish({ status: 'saved', errorKind: null, savedCount: snapshot.savedCount, error: null })
  publish({ status: 'saving', errorKind: null, error: null })
  const batch = [...pending.values()]
  let workspace: WorkspaceFs | null = null
  let previousText: string | null = null
  try {
    workspace = workspaceOverride ?? await getWorkspaceFs()
    previousText = await workspace.readFileText(GAME_FPS_SAVE_PATH)
    const current = previousText ?? EMPTY_SAVE_DOCUMENT
    const merged = mergeDecisionsIntoKgcMarkdown(current, batch)
    await ensureWorkspaceFolderTreeIfMissing({
      fs: workspace,
      folderPath: normalizeWorkspacePath('/game-fps'),
    })
    await upsertWorkspaceTextDocument({
      fs: workspace,
      parentPath: normalizeWorkspacePath('/game-fps'),
      name: 'mission-1-decisions.md',
      text: merged.markdown,
    })
    const readBack = await workspace.readFileText(GAME_FPS_SAVE_PATH)
    if (readBack == null) throw new Error('Decision save read-back was empty')
    const verification = mergeDecisionsIntoKgcMarkdown(readBack, batch)
    if (verification.persistedCount !== 0 || verification.idempotentCount !== batch.length) {
      throw new Error('Decision save read-back did not contain every pending Decision')
    }
    const savedCount = readKgcNodeState(readBack).nodes.filter((node: unknown) => (
      (node as { type?: unknown } | null)?.type === ECS_DECISION_NODE_TYPE
    )).length
    for (const decision of batch) pending.delete(decision.decisionId)
    return publish({
      status: 'saved',
      errorKind: null,
      savedCount,
      error: null,
    })
  } catch (error) {
    if (workspace) {
      try {
        const currentText = await workspace.readFileText(GAME_FPS_SAVE_PATH)
        if (currentText !== previousText) {
          if (previousText == null) {
            if (currentText != null) await workspace.deleteEntry(GAME_FPS_SAVE_PATH)
          } else {
            await upsertWorkspaceTextDocument({
              fs: workspace,
              parentPath: normalizeWorkspacePath('/game-fps'),
              name: 'mission-1-decisions.md',
              text: previousText,
            })
          }
          const restoredText = await workspace.readFileText(GAME_FPS_SAVE_PATH)
          if (restoredText !== previousText) throw new Error('Decision save rollback read-back mismatch')
        }
      } catch (rollbackError) {
        return publish({
          status: 'error',
          errorKind: 'write',
          error: `${errorMessage(error)}; rollback failed: ${errorMessage(rollbackError)}`,
        })
      }
    }
    return publish({ status: 'error', errorKind: 'write', error: errorMessage(error) })
  }
}

export function persistPendingGameFpsDecisions(
  options: { workspace?: WorkspaceFs } = {},
): Promise<GameFpsDecisionStoreSnapshot> {
  return enqueueDecisionMutation(() => persistPending(options.workspace))
}

export function resetGameFpsDecisionStoreForTests(): void {
  pending.clear()
  mutationQueue = null
  snapshot = Object.freeze({
    status: 'idle',
    errorKind: null,
    hydrationBlocked: false,
    retainedCount: 0,
    savedCount: 0,
    error: null,
    revision: snapshot.revision + 1,
  })
  for (const listener of [...listeners]) listener()
}
