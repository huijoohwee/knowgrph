type Deferred = Readonly<{
  promise: Promise<void>
  resolve: () => void
}>

function createDeferred(): Deferred {
  let resolve = () => undefined
  const promise = new Promise<void>(complete => {
    resolve = complete
  })
  return { promise, resolve }
}

export const testCanvasDocDeepLinkSerializesDistinctRemoteImports = async () => {
  const { runRemoteDeepLinkImportLifecycle } = await import('@/features/canvas/CanvasDocDeepLinkRuntime')
  const inFlightImports = new Map<string, Promise<void>>()
  const firstMutation = createDeferred()
  const secondMutation = createDeferred()
  const firstStarted = createDeferred()
  const secondStarted = createDeferred()
  const events: string[] = []
  let currentIntentKey = 'source-a'

  const firstImport = runRemoteDeepLinkImportLifecycle(inFlightImports, 'source-a', {
    prepareDocument: async () => {
      events.push('prepare:a')
      firstStarted.resolve()
      await firstMutation.promise
      return 'prepared:a'
    },
    commitDocument: async prepared => {
      events.push(prepared.replace('prepared', 'apply'))
    },
    readCurrentIntentKey: () => currentIntentKey,
    completeIntent: () => events.push('complete:a'),
    reportError: error => {
      throw error
    },
  })
  await firstStarted.promise

  currentIntentKey = 'source-b'
  const secondImport = runRemoteDeepLinkImportLifecycle(inFlightImports, 'source-b', {
    prepareDocument: async () => {
      events.push('prepare:b')
      secondStarted.resolve()
      await secondMutation.promise
      return 'prepared:b'
    },
    commitDocument: async prepared => {
      events.push(prepared.replace('prepared', 'apply'))
    },
    readCurrentIntentKey: () => currentIntentKey,
    completeIntent: () => events.push('complete:b'),
    reportError: error => {
      throw error
    },
  })
  const duplicateSecondImport = runRemoteDeepLinkImportLifecycle(inFlightImports, 'source-b', {
    prepareDocument: async () => {
      throw new Error('same-intent import must remain deduplicated')
    },
    commitDocument: async () => {
      throw new Error('same-intent import must not commit twice')
    },
    readCurrentIntentKey: () => currentIntentKey,
    completeIntent: () => events.push('complete:duplicate-b'),
    reportError: error => {
      throw error
    },
  })

  if (secondImport !== duplicateSecondImport) {
    throw new Error('expected same-intent callers to share the exact queued import promise')
  }
  await Promise.resolve()
  if (events.join(',') !== 'prepare:a') {
    throw new Error(`expected the newer source to wait for the active mutation, got ${events.join(',')}`)
  }

  firstMutation.resolve()
  await firstImport
  await secondStarted.promise
  if (events.join(',') !== 'prepare:a,prepare:b') {
    throw new Error(`expected superseded prepared bytes not to commit before the newer source starts, got ${events.join(',')}`)
  }

  secondMutation.resolve()
  await secondImport
  if (events.join(',') !== 'prepare:a,prepare:b,apply:b,complete:b') {
    throw new Error(`expected only the current source to complete after applying last, got ${events.join(',')}`)
  }
  if (inFlightImports.size !== 0) {
    throw new Error('expected all serialized import leases to be released')
  }
}

export const testCanvasDocDeepLinkSkipsSupersededQueuedRemoteImport = async () => {
  const { runRemoteDeepLinkImportLifecycle } = await import('@/features/canvas/CanvasDocDeepLinkRuntime')
  const inFlightImports = new Map<string, Promise<void>>()
  const firstMutation = createDeferred()
  const firstStarted = createDeferred()
  const latestStarted = createDeferred()
  const events: string[] = []
  let currentIntentKey = 'source-a'

  const firstImport = runRemoteDeepLinkImportLifecycle(inFlightImports, 'source-a', {
    prepareDocument: async () => {
      events.push('prepare:a')
      firstStarted.resolve()
      await firstMutation.promise
      return 'prepared:a'
    },
    commitDocument: async prepared => {
      events.push(prepared.replace('prepared', 'apply'))
    },
    readCurrentIntentKey: () => currentIntentKey,
    completeIntent: () => events.push('complete:a'),
    reportError: error => {
      throw error
    },
  })
  await firstStarted.promise

  currentIntentKey = 'source-b'
  const supersededImport = runRemoteDeepLinkImportLifecycle(inFlightImports, 'source-b', {
    prepareDocument: async () => 'prepared:b',
    commitDocument: async prepared => {
      events.push(prepared.replace('prepared', 'apply'))
    },
    readCurrentIntentKey: () => currentIntentKey,
    completeIntent: () => events.push('complete:b'),
    reportError: error => {
      throw error
    },
  })
  currentIntentKey = 'source-c'
  const latestImport = runRemoteDeepLinkImportLifecycle(inFlightImports, 'source-c', {
    prepareDocument: async () => {
      events.push('prepare:c')
      latestStarted.resolve()
      return 'prepared:c'
    },
    commitDocument: async prepared => {
      events.push(prepared.replace('prepared', 'apply'))
    },
    readCurrentIntentKey: () => currentIntentKey,
    completeIntent: () => events.push('complete:c'),
    reportError: error => {
      throw error
    },
  })

  firstMutation.resolve()
  await Promise.all([firstImport, supersededImport, latestImport, latestStarted.promise])
  if (events.join(',') !== 'prepare:a,prepare:c,apply:c,complete:c') {
    throw new Error(`expected the superseded queued source to be skipped before mutation, got ${events.join(',')}`)
  }
  if (inFlightImports.size !== 0) {
    throw new Error('expected skipped and completed import leases to be released')
  }
}

export const testCanvasDocDeepLinkRollsBackSupersededMidCommitIntent = async () => {
  const { runRemoteDeepLinkImportLifecycle } = await import('@/features/canvas/CanvasDocDeepLinkRuntime')
  const inFlightImports = new Map<string, Promise<void>>()
  const firstCommitStarted = createDeferred()
  const releaseFirstCommit = createDeferred()
  const events: string[] = []
  const committedDocuments: string[] = []
  let currentIntentKey = 'source-a'

  const firstImport = runRemoteDeepLinkImportLifecycle(inFlightImports, 'source-a', {
    prepareDocument: async () => 'prepared:a',
    commitDocument: async (prepared, context) => {
      const document = prepared.replace('prepared:', '')
      committedDocuments.push(document)
      events.push(`apply:${document}`)
      firstCommitStarted.resolve()
      await releaseFirstCommit.promise
      if (context.isCurrentIntent()) return
      committedDocuments.splice(committedDocuments.indexOf(document), 1)
      events.push(`rollback:${document}`)
    },
    readCurrentIntentKey: () => currentIntentKey,
    completeIntent: () => events.push('complete:a'),
    reportError: error => { throw error },
    cancelIntent: () => events.push('cancel:a'),
  })
  await firstCommitStarted.promise

  currentIntentKey = 'source-b'
  const secondImport = runRemoteDeepLinkImportLifecycle(inFlightImports, 'source-b', {
    prepareDocument: async () => 'prepared:b',
    commitDocument: async prepared => {
      const document = prepared.replace('prepared:', '')
      committedDocuments.push(document)
      events.push(`apply:${document}`)
    },
    readCurrentIntentKey: () => currentIntentKey,
    completeIntent: () => events.push('complete:b'),
    reportError: error => { throw error },
  })
  releaseFirstCommit.resolve()
  await Promise.all([firstImport, secondImport])

  if (events.join(',') !== 'apply:a,rollback:a,cancel:a,apply:b,complete:b') {
    throw new Error(`expected mid-commit supersession to roll back before the latest source applies, got ${events.join(',')}`)
  }
  if (committedDocuments.join(',') !== 'b') {
    throw new Error(`expected only the latest source mutation to survive, got ${committedDocuments.join(',')}`)
  }
}

export const testWorkspaceFsMutationTransactionRestoresTouchedEntries = async () => {
  const [{ createMemoryWorkspaceFs }, { createWorkspaceFsMutationTransaction }] = await Promise.all([
    import('@/features/workspace-fs/workspaceFsMemory'),
    import('@/features/workspace-fs/workspaceFsMutationTransaction'),
  ])
  const fs = createMemoryWorkspaceFs({
    initialEntries: [
      { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
      { path: '/docs', parentPath: '/', kind: 'folder', name: 'docs', updatedAtMs: 1 },
      { path: '/docs/source.md', parentPath: '/docs', kind: 'file', name: 'source.md', text: 'before', updatedAtMs: 1 },
    ],
  })
  const mirrorPolicies: Array<boolean | undefined> = []
  const recordingFs = {
    ...fs,
    writeFileText: async (path: string, text: string, options?: { mirrorToHost?: boolean }) => {
      mirrorPolicies.push(options?.mirrorToHost)
      await fs.writeFileText(path, text, options)
    },
    createFile: async (args: { parentPath: string; name: string; text: string; mirrorToHost?: boolean }) => {
      mirrorPolicies.push(args.mirrorToHost)
      return await fs.createFile(args)
    },
    createFolder: async (args: { parentPath: string; name: string; mirrorToHost?: boolean }) => {
      mirrorPolicies.push(args.mirrorToHost)
      return await fs.createFolder(args)
    },
    deleteEntry: async (path: string, options?: { mirrorToHost?: boolean }) => {
      mirrorPolicies.push(options?.mirrorToHost)
      await fs.deleteEntry(path, options)
    },
  }
  const transaction = createWorkspaceFsMutationTransaction(recordingFs)
  await transaction.fs.writeFileText('/docs/source.md', 'after')
  await transaction.fs.createFile({ parentPath: '/docs', name: 'temporary.md', text: 'temporary' })
  await transaction.rollback()
  if (await fs.readFileText('/docs/source.md') !== 'before') {
    throw new Error('expected rollback to restore the previous workspace bytes')
  }
  if (await fs.readFileText('/docs/temporary.md') !== null) {
    throw new Error('expected rollback to remove transaction-created workspace entries')
  }
  if (mirrorPolicies.length === 0 || mirrorPolicies.some(policy => policy !== false)) {
    throw new Error(`expected every transaction mutation to suppress host mirrors, got ${mirrorPolicies.join(',')}`)
  }
}

export const testCanvasDocDeepLinkRollbackRestoresPersistedSourceAuthority = async () => {
  const [runtime, explorerModule, graphModule, configModule, persistenceModule] = await Promise.all([
    import('@/features/canvas/CanvasDocDeepLinkRuntime'),
    import('@/features/markdown-explorer/store'),
    import('@/hooks/useGraphStore'),
    import('@/lib/config'),
    import('@/lib/persistence'),
  ])
  const { useMarkdownExplorerStore } = explorerModule
  const { useGraphStore } = graphModule
  const storage = persistenceModule.getLocalStorage()
  if (!storage) throw new Error('expected browser storage for persisted authority rollback')
  const storageKey = configModule.LS_KEYS.markdownExplorerActivePath
  const storedPathBeforeTest = storage.getItem(storageKey)
  const explorerStateBeforeTest = useMarkdownExplorerStore.getState()
  const graphStateBeforeTest = useGraphStore.getState()
  try {
    useMarkdownExplorerStore.getState().setActivePath('/docs/source-before.md')
    const explorerActivePathBeforeCommit = useMarkdownExplorerStore.getState().activePath
    const graphStateBeforeCommit = useGraphStore.getState()
    useGraphStore.setState({ markdownDocumentName: 'stale-source.md', renderOpMsg: 'stale-import' })
    const graphStateAfterCommit = useGraphStore.getState()
    useMarkdownExplorerStore.getState().setActivePath('/docs/stale-source.md')
    useGraphStore.setState({ renderOpMsg: 'concurrent-user-change' })

    runtime.restoreSupersededCanvasImportGraphState(graphStateBeforeCommit, graphStateAfterCommit)
    runtime.restoreSupersededCanvasImportActivePath(explorerActivePathBeforeCommit)

    if (useGraphStore.getState().markdownDocumentName !== graphStateBeforeCommit.markdownDocumentName) {
      throw new Error('expected rollback to restore the stale import graph field')
    }
    if (useGraphStore.getState().renderOpMsg !== 'concurrent-user-change') {
      throw new Error('expected CAS rollback to preserve a concurrent graph field change')
    }
    if (useMarkdownExplorerStore.getState().activePath !== explorerActivePathBeforeCommit) {
      throw new Error('expected rollback to restore the explorer source path')
    }
    if (JSON.parse(storage.getItem(storageKey) || 'null') !== explorerActivePathBeforeCommit) {
      throw new Error('expected rollback to restore the persisted explorer source path')
    }
  } finally {
    useGraphStore.setState({
      markdownDocumentName: graphStateBeforeTest.markdownDocumentName,
      renderOpMsg: graphStateBeforeTest.renderOpMsg,
    })
    useMarkdownExplorerStore.setState(explorerStateBeforeTest)
    if (storedPathBeforeTest === null) storage.removeItem(storageKey)
    else storage.setItem(storageKey, storedPathBeforeTest)
  }
}

export const testCanvasDocDeepLinkRollbackCompensatesAfterWorkspaceFailure = async () => {
  const runtime = await import('@/features/canvas/CanvasDocDeepLinkRuntime')
  const { useGraphStore } = await import('@/hooks/useGraphStore')
  const graphState = useGraphStore.getState()
  const events: string[] = []
  let failed = false
  try {
    await runtime.compensateSupersededCanvasImport({
      rollbackWorkspace: async () => {
        events.push('workspace')
        throw new Error('forced workspace rollback failure')
      },
      rollbackSources: () => events.push('sources'),
      graphStateBeforeCommit: graphState,
      graphStateAfterCommit: graphState,
      explorerActivePathBeforeCommit: null,
    })
  } catch (error) {
    failed = error instanceof Error && error.message.includes('forced workspace rollback failure')
  }
  if (!failed || events.join(',') !== 'workspace,sources') {
    throw new Error(`expected later compensation domains after workspace failure, got ${events.join(',')}`)
  }
}
