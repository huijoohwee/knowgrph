import storageWorker from '../../../cloudflare/workers/knowgrph-storage/index.ts'
import {
  YJS_MARKDOWN_TEXT_NAME,
  applyYjsUpdateBase64,
  canEditRawJsonForCollaboration,
  createCollaborationYDoc,
  encodeCollaborationYDocStateBase64,
  encodeYjsUpdateBase64,
  serializeCollaborationYDoc,
  setCollaborationJsonObjectField,
} from 'grph-shared/collaboration/yjsSnapshot'
import {
  KNOWGRPH_STORAGE_API_VERSION,
  buildKnowgrphCollaborationSavePath,
  type KnowgrphCollaborationSaveRequest,
} from '@/lib/storage/knowgrphStorageSyncContract'
import {
  shouldSavePocketBaseYjsSnapshotForWorkspacePath,
} from '@/features/source-files/useSourceFilesPocketBaseYjsCollaborationRuntime'

const readStorageWorker = (): { fetch: (request: Request, env: Record<string, unknown>) => Promise<Response> } => {
  const candidate = storageWorker as unknown as {
    fetch?: (request: Request, env: Record<string, unknown>) => Promise<Response>
    default?: { fetch?: (request: Request, env: Record<string, unknown>) => Promise<Response> }
  }
  const fetchImpl = candidate.fetch || candidate.default?.fetch
  if (!fetchImpl) throw new Error('expected storage worker test module to expose fetch')
  return { fetch: fetchImpl }
}

export function testPocketBaseYjsMarkdownConcurrentUpdatesMergeThroughYText() {
  const left = createCollaborationYDoc({
    documentKey: 'docs/shared.md',
    documentKind: 'markdown',
    initialText: 'Hello',
  })
  const right = createCollaborationYDoc({
    documentKey: 'docs/shared.md',
    documentKind: 'markdown',
    initialText: '',
  })
  applyYjsUpdateBase64({
    doc: right,
    updateBase64: encodeCollaborationYDocStateBase64(left),
  })

  const leftUpdates: Uint8Array[] = []
  const rightUpdates: Uint8Array[] = []
  left.on('update', update => leftUpdates.push(update))
  right.on('update', update => rightUpdates.push(update))

  left.getText(YJS_MARKDOWN_TEXT_NAME).insert(5, ' from A')
  right.getText(YJS_MARKDOWN_TEXT_NAME).insert(0, 'B says ')

  for (const update of leftUpdates) applyYjsUpdateBase64({ doc: right, updateBase64: encodeYjsUpdateBase64(update) })
  for (const update of rightUpdates) applyYjsUpdateBase64({ doc: left, updateBase64: encodeYjsUpdateBase64(update) })

  const leftText = serializeCollaborationYDoc({ doc: left, documentKind: 'markdown' })
  const rightText = serializeCollaborationYDoc({ doc: right, documentKind: 'markdown' })
  if (leftText !== rightText) throw new Error(`expected Y.Text peers to converge, got ${JSON.stringify({ leftText, rightText })}`)
  if (!leftText.includes('B says ') || !leftText.includes('from A')) {
    throw new Error(`expected both concurrent Markdown edits to survive, got ${JSON.stringify(leftText)}`)
  }
}

export function testPocketBaseYjsJsonUsesSharedMapAndBlocksRawConcurrentJson() {
  const left = createCollaborationYDoc({
    documentKey: 'docs/shared.json',
    documentKind: 'json',
    initialText: '{"base":true}',
  })
  const right = createCollaborationYDoc({
    documentKey: 'docs/shared.json',
    documentKind: 'json',
    initialText: '{}',
  })
  applyYjsUpdateBase64({
    doc: right,
    updateBase64: encodeCollaborationYDocStateBase64(left),
  })

  const leftUpdates: Uint8Array[] = []
  const rightUpdates: Uint8Array[] = []
  left.on('update', update => leftUpdates.push(update))
  right.on('update', update => rightUpdates.push(update))

  setCollaborationJsonObjectField({ doc: left, key: 'fromA', value: { count: 1 } })
  setCollaborationJsonObjectField({ doc: right, key: 'fromB', value: ['ok'] })

  for (const update of leftUpdates) applyYjsUpdateBase64({ doc: right, updateBase64: encodeYjsUpdateBase64(update) })
  for (const update of rightUpdates) applyYjsUpdateBase64({ doc: left, updateBase64: encodeYjsUpdateBase64(update) })

  const parsed = JSON.parse(serializeCollaborationYDoc({ doc: left, documentKind: 'json' })) as Record<string, unknown>
  if ((parsed.fromA as { count?: unknown })?.count !== 1 || !Array.isArray(parsed.fromB)) {
    throw new Error(`expected Y.Map JSON peers to merge field-level edits, got ${JSON.stringify(parsed)}`)
  }
  if (canEditRawJsonForCollaboration({ documentKind: 'json', activePeerCount: 2 })) {
    throw new Error('expected raw JSON editing to be blocked when a second collaborator is active')
  }
}

export function testPocketBaseYjsSaveSnapshotRequiresPathDocumentKeyMatch() {
  const videoPath = '/docs/knowgrph-video-demo.md'
  const tokenEconomicsPath = '/docs/knowgrph-token-economics-model-demo.md'
  if (shouldSavePocketBaseYjsSnapshotForWorkspacePath({
    activeDocumentKey: 'docs/knowgrph-token-economics-model-demo.md',
    roomDocumentKey: 'docs/knowgrph-video-demo.md',
    savePath: tokenEconomicsPath,
  })) {
    throw new Error('expected stale video collaboration room not to save token economics text')
  }
  if (!shouldSavePocketBaseYjsSnapshotForWorkspacePath({
    activeDocumentKey: 'docs/knowgrph-video-demo.md',
    roomDocumentKey: 'docs/knowgrph-video-demo.md',
    savePath: videoPath,
  })) {
    throw new Error('expected matching video collaboration room to save video text')
  }
  if (!shouldSavePocketBaseYjsSnapshotForWorkspacePath({
    activeDocumentKey: 'docs/knowgrph-video-demo.md',
    roomDocumentKey: 'docs/knowgrph-video-demo.md',
    savePath: null,
  })) {
    throw new Error('expected active document key fallback to allow matching saves')
  }
}

export async function testCollaborationSaveBridgeCommitsFormattedJsonThroughGitHubOnly() {
  const requests: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = []
  const previousFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = String(init?.method || 'GET')
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null
    requests.push({ url, method, body })
    if (method === 'GET') return new Response(JSON.stringify({ sha: 'base-sha' }), { status: 200 })
    return new Response(JSON.stringify({ content: { sha: 'content-sha' }, commit: { sha: 'commit-sha' } }), { status: 200 })
  }) as typeof fetch
  try {
    const doc = createCollaborationYDoc({
      documentKey: '/docs/shared.json',
      documentKind: 'json',
      initialText: '{"z":1}',
    })
    const body: KnowgrphCollaborationSaveRequest = {
      apiVersion: KNOWGRPH_STORAGE_API_VERSION,
      workspaceId: 'kgws:test',
      documentKey: '/docs/shared.json',
      documentKind: 'json',
      serializedText: '{"rawEditorTextMustNotWin":true}',
      yjsStateBase64: encodeCollaborationYDocStateBase64(doc),
      activePeerCount: 2,
      pocketBaseRoomId: 'room_a',
      savedByPeerId: 'peer_a',
      saveBoundary: 'explicit',
    }
    const response = await readStorageWorker().fetch(
      new Request(`https://example.com${buildKnowgrphCollaborationSavePath()}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      {
        KNOWGRPH_STORAGE_GITHUB_TOKEN: 'test-token',
        KNOWGRPH_STORAGE_GITHUB_OWNER: 'owner',
        KNOWGRPH_STORAGE_GITHUB_REPO: 'repo',
        KNOWGRPH_STORAGE_GITHUB_BRANCH: 'main',
      },
    )
    const result = await response.json() as { ok?: boolean; githubPath?: string }
    if (!response.ok || result.ok !== true || result.githubPath !== 'docs/shared.json') {
      throw new Error(`expected bridge save response, got ${JSON.stringify(result)}`)
    }
    const putRequest = requests.find(request => request.method === 'PUT')
    const content = String(putRequest?.body?.content || '')
    const decoded = Buffer.from(content, 'base64').toString('utf8')
    if (decoded !== '{\n  "z": 1\n}\n') {
      throw new Error(`expected bridge to format concurrent JSON before GitHub commit, got ${JSON.stringify(decoded)}`)
    }
    if (String(putRequest?.body?.message || '') !== 'chore(sync): save shared.json from collaboration bridge') {
      throw new Error(`expected bridge-owned commit message, got ${JSON.stringify(putRequest?.body?.message)}`)
    }
  } finally {
    globalThis.fetch = previousFetch
  }
}

export async function testCollaborationSaveBridgeRejectsConcurrentJsonWithoutCrdtState() {
  const response = await readStorageWorker().fetch(
    new Request(`https://example.com${buildKnowgrphCollaborationSavePath()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KNOWGRPH_STORAGE_API_VERSION,
        workspaceId: 'kgws:test',
        documentKey: '/docs/shared.json',
        documentKind: 'json',
        serializedText: '{"z":1}',
        yjsStateBase64: '',
        activePeerCount: 2,
        pocketBaseRoomId: 'room_a',
        savedByPeerId: 'peer_a',
        saveBoundary: 'explicit',
      } satisfies KnowgrphCollaborationSaveRequest),
    }),
    {
      KNOWGRPH_STORAGE_GITHUB_TOKEN: 'test-token',
    },
  )
  const result = await response.json() as { ok?: boolean; code?: string; error?: string }
  if (response.status !== 409 || result.code !== 'conflict' || !String(result.error || '').includes('requires Yjs CRDT state')) {
    throw new Error(`expected bridge to reject concurrent raw JSON saves without CRDT state, got ${JSON.stringify(result)}`)
  }
}

export async function testCollaborationSaveBridgeIgnoresStalePocketBaseAwarenessPeers() {
  const requests: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = []
  const previousFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = String(init?.method || 'GET')
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null
    requests.push({ url, method, body })
    if (url.includes('pocketbase.test/api/collections/collab_rooms/records/room_a')) {
      return new Response(JSON.stringify({ id: 'room_a', yjsStateBase64: '' }), { status: 200 })
    }
    if (url.includes('pocketbase.test/api/collections/collab_awareness/records')) {
      return new Response(JSON.stringify({ items: [{ peerId: 'stale-peer', lastSeenAtMs: 1 }] }), { status: 200 })
    }
    if (method === 'GET') return new Response(JSON.stringify({ sha: 'base-sha' }), { status: 200 })
    return new Response(JSON.stringify({ content: { sha: 'content-sha' }, commit: { sha: 'commit-sha' } }), { status: 200 })
  }) as typeof fetch
  try {
    const response = await readStorageWorker().fetch(
      new Request(`https://example.com${buildKnowgrphCollaborationSavePath()}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apiVersion: KNOWGRPH_STORAGE_API_VERSION,
          workspaceId: 'kgws:test',
          documentKey: '/docs/shared.json',
          documentKind: 'json',
          serializedText: '{"z":1}',
          yjsStateBase64: '',
          activePeerCount: 2,
          pocketBaseRoomId: 'room_a',
          savedByPeerId: 'peer_a',
          saveBoundary: 'explicit',
        } satisfies KnowgrphCollaborationSaveRequest),
      }),
      {
        KNOWGRPH_STORAGE_GITHUB_TOKEN: 'test-token',
        KNOWGRPH_STORAGE_GITHUB_OWNER: 'owner',
        KNOWGRPH_STORAGE_GITHUB_REPO: 'repo',
        KNOWGRPH_STORAGE_POCKETBASE_URL: 'https://pocketbase.test',
      },
    )
    const result = await response.json() as { ok?: boolean; code?: string; error?: string }
    if (!response.ok || result.ok !== true) {
      throw new Error(`expected stale awareness peers not to force concurrent JSON conflict, got ${JSON.stringify(result)}`)
    }
    if (!requests.some(request => request.method === 'PUT')) {
      throw new Error('expected bridge to commit after filtering stale PocketBase awareness peers')
    }
  } finally {
    globalThis.fetch = previousFetch
  }
}
