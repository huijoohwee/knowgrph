import {
  mergeDecisionsIntoKgcMarkdown,
  normalizeDecisionBatch,
} from '../../../../ecs/decisionDocument.js'
import {
  ECS_DECISION_NODE_TYPE,
  normalizeDecisionNode,
  readKgcNodeState,
} from '../../../../ecs/kgcNodeContract.js'
import { ensureWorkspaceFolderTreeIfMissing } from './ensureFolderTreeIfMissing'
import {
  normalizeWorkspacePath,
  splitWorkspacePath,
  workspaceBasename,
} from './path'
import type { WorkspaceFs, WorkspacePath } from './types'
import { upsertWorkspaceTextDocument } from './upsertWorkspaceTextDocument'
import { getWorkspaceFs } from './workspaceFs'

export type WorkspaceDecisionRecord = Readonly<{
  decisionId: string
  decisionType: string
  entityRef: string
  payload: Readonly<Record<string, unknown>>
  producedAt: string
}>

export type WorkspaceDecisionStoreSnapshot = Readonly<{
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorKind: 'load' | 'write' | null
  hydrationBlocked: boolean
  retainedCount: number
  savedCount: number
  error: string | null
  revision: number
}>

export type WorkspaceDecisionStoreOptions = Readonly<{
  workspace?: WorkspaceFs
}>

export type WorkspaceDecisionStore<TDecision extends WorkspaceDecisionRecord> = Readonly<{
  savePath: WorkspacePath
  emptyDocument: string
  read: () => WorkspaceDecisionStoreSnapshot
  subscribe: (listener: () => void) => () => void
  reportLoadFailure: (error: unknown) => WorkspaceDecisionStoreSnapshot
  queue: (decisions: readonly TDecision[]) => void
  load: (options?: WorkspaceDecisionStoreOptions) => Promise<TDecision[]>
  reset: (options?: WorkspaceDecisionStoreOptions) => Promise<WorkspaceDecisionStoreSnapshot>
  persistPending: (options?: WorkspaceDecisionStoreOptions) => Promise<WorkspaceDecisionStoreSnapshot>
  resetForTests: () => void
}>

export type WorkspaceDecisionStoreConfig<TDecision extends WorkspaceDecisionRecord> = Readonly<{
  savePath: WorkspacePath
  title: string
  body: string
  validateDecisions: (decisions: readonly TDecision[]) => void
}>

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : String(error || 'Decision save failed')
}

function createEmptyDecisionDocument(title: string, body: string): string {
  const normalizedTitle = title.trim()
  const normalizedBody = body.replace(/\r\n?/g, '\n').trim()
  if (!normalizedTitle) throw new Error('Workspace Decision save title is required')
  if (!normalizedBody) throw new Error('Workspace Decision save body is required')
  return [
    '---',
    `title: ${JSON.stringify(normalizedTitle)}`,
    'schema: "kgc-computing-flow/v1"',
    'flow:',
    '  nodes: []',
    '  edges: []',
    '---',
    '',
    normalizedBody,
    '',
  ].join('\n')
}

function resolveSaveLocation(savePath: WorkspacePath): Readonly<{
  folderPath: WorkspacePath
  fileName: string
}> {
  const segments = splitWorkspacePath(savePath)
  const fileName = workspaceBasename(savePath)
  if (!fileName) throw new Error('Workspace Decision save path must name a file')
  const folderPath = segments.length > 1
    ? normalizeWorkspacePath(`/${segments.slice(0, -1).join('/')}`)
    : normalizeWorkspacePath('/')
  return Object.freeze({ folderPath, fileName })
}

export function createWorkspaceDecisionStore<TDecision extends WorkspaceDecisionRecord>(
  config: WorkspaceDecisionStoreConfig<TDecision>,
): WorkspaceDecisionStore<TDecision> {
  const savePath = normalizeWorkspacePath(config.savePath)
  const { folderPath, fileName } = resolveSaveLocation(savePath)
  const emptyDocument = createEmptyDecisionDocument(config.title, config.body)
  const listeners = new Set<() => void>()
  const pending = new Map<string, TDecision>()
  let mutationQueue: Promise<WorkspaceDecisionStoreSnapshot> | null = null
  let snapshot: WorkspaceDecisionStoreSnapshot = Object.freeze({
    status: 'idle',
    errorKind: null,
    hydrationBlocked: false,
    retainedCount: 0,
    savedCount: 0,
    error: null,
    revision: 0,
  })

  function publish(patch: Partial<WorkspaceDecisionStoreSnapshot>): WorkspaceDecisionStoreSnapshot {
    snapshot = Object.freeze({
      ...snapshot,
      ...patch,
      retainedCount: pending.size,
      revision: snapshot.revision + 1,
    })
    for (const listener of [...listeners]) listener()
    return snapshot
  }

  function read(): WorkspaceDecisionStoreSnapshot {
    return snapshot
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function reportLoadFailure(error: unknown): WorkspaceDecisionStoreSnapshot {
    return publish({
      status: 'error',
      errorKind: 'load',
      hydrationBlocked: true,
      error: `Unreadable ${savePath}: ${errorMessage(error)}`,
    })
  }

  function queue(decisions: readonly TDecision[]): void {
    const normalized = normalizeDecisionBatch([...decisions]) as TDecision[]
    for (const decision of normalized) pending.set(decision.decisionId, decision)
    if (snapshot.hydrationBlocked || snapshot.status === 'error') {
      publish({})
      return
    }
    publish({
      status: pending.size > 0 ? 'idle' : snapshot.status,
      errorKind: null,
      error: null,
    })
  }

  async function load(options: WorkspaceDecisionStoreOptions = {}): Promise<TDecision[]> {
    try {
      const workspace = options.workspace ?? await getWorkspaceFs()
      const text = await workspace.readFileText(savePath)
      if (text == null) return []
      const { nodes } = readKgcNodeState(text)
      const decisions: TDecision[] = []
      nodes.forEach((node: unknown, index: number) => {
        if ((node as { type?: unknown } | null)?.type !== ECS_DECISION_NODE_TYPE) return
        decisions.push(normalizeDecisionNode(node, index) as TDecision)
      })
      const normalizedDecisions = normalizeDecisionBatch(decisions) as TDecision[]
      config.validateDecisions(normalizedDecisions)
      if (!snapshot.hydrationBlocked) {
        const preserveRetainedWriteFailure = pending.size > 0
          && snapshot.status === 'error'
          && snapshot.errorKind === 'write'
        const preserveSavedStatus = snapshot.status === 'saved'
          && snapshot.errorKind === null
        publish(preserveRetainedWriteFailure || preserveSavedStatus
          ? { savedCount: normalizedDecisions.length }
          : {
              status: 'idle',
              errorKind: null,
              savedCount: normalizedDecisions.length,
              error: null,
            })
      }
      return normalizedDecisions
    } catch (error) {
      reportLoadFailure(error)
      throw error
    }
  }

  async function resetLocalSave(
    workspaceOverride?: WorkspaceFs,
  ): Promise<WorkspaceDecisionStoreSnapshot> {
    try {
      const workspace = workspaceOverride ?? await getWorkspaceFs()
      await ensureWorkspaceFolderTreeIfMissing({ fs: workspace, folderPath })
      await upsertWorkspaceTextDocument({
        fs: workspace,
        parentPath: folderPath,
        name: fileName,
        text: emptyDocument,
      })
      const readBack = await workspace.readFileText(savePath)
      if (readBack !== emptyDocument) throw new Error('Reset save read-back mismatch')
      pending.clear()
      return publish({
        status: 'saved',
        errorKind: null,
        hydrationBlocked: false,
        savedCount: 0,
        error: null,
      })
    } catch (error) {
      return publish({
        status: 'error',
        errorKind: snapshot.hydrationBlocked ? 'load' : 'write',
        error: errorMessage(error),
      })
    }
  }

  function enqueueDecisionMutation(
    mutation: () => Promise<WorkspaceDecisionStoreSnapshot>,
  ): Promise<WorkspaceDecisionStoreSnapshot> {
    mutationQueue = (mutationQueue ?? Promise.resolve(snapshot))
      .catch(() => snapshot)
      .then(mutation)
    return mutationQueue
  }

  function reset(options: WorkspaceDecisionStoreOptions = {}): Promise<WorkspaceDecisionStoreSnapshot> {
    return enqueueDecisionMutation(() => resetLocalSave(options.workspace))
  }

  async function persistPending(
    workspaceOverride?: WorkspaceFs,
  ): Promise<WorkspaceDecisionStoreSnapshot> {
    if (snapshot.hydrationBlocked) return publish({})
    if (pending.size === 0) {
      return publish({
        status: 'saved',
        errorKind: null,
        savedCount: snapshot.savedCount,
        error: null,
      })
    }
    publish({ status: 'saving', errorKind: null, error: null })
    const batch = [...pending.values()]
    let workspace: WorkspaceFs | null = null
    let previousText: string | null = null
    try {
      workspace = workspaceOverride ?? await getWorkspaceFs()
      previousText = await workspace.readFileText(savePath)
      const current = previousText ?? emptyDocument
      const merged = mergeDecisionsIntoKgcMarkdown(current, batch)
      await ensureWorkspaceFolderTreeIfMissing({ fs: workspace, folderPath })
      await upsertWorkspaceTextDocument({
        fs: workspace,
        parentPath: folderPath,
        name: fileName,
        text: merged.markdown,
      })
      const readBack = await workspace.readFileText(savePath)
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
          const currentText = await workspace.readFileText(savePath)
          if (currentText !== previousText) {
            if (previousText == null) {
              if (currentText != null) await workspace.deleteEntry(savePath)
            } else {
              await upsertWorkspaceTextDocument({
                fs: workspace,
                parentPath: folderPath,
                name: fileName,
                text: previousText,
              })
            }
            const restoredText = await workspace.readFileText(savePath)
            if (restoredText !== previousText) {
              throw new Error('Decision save rollback read-back mismatch')
            }
          }
        } catch (rollbackError) {
          return publish({
            status: 'error',
            errorKind: 'write',
            error: `${errorMessage(error)}; rollback failed: ${errorMessage(rollbackError)}`,
          })
        }
      }
      return publish({
        status: 'error',
        errorKind: 'write',
        error: errorMessage(error),
      })
    }
  }

  function persist(
    options: WorkspaceDecisionStoreOptions = {},
  ): Promise<WorkspaceDecisionStoreSnapshot> {
    return enqueueDecisionMutation(() => persistPending(options.workspace))
  }

  function resetForTests(): void {
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

  return Object.freeze({
    savePath,
    emptyDocument,
    read,
    subscribe,
    reportLoadFailure,
    queue,
    load,
    reset,
    persistPending: persist,
    resetForTests,
  })
}
