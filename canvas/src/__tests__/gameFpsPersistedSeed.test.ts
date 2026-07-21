import assert from 'node:assert/strict'
import test from 'node:test'

import { MemoryStorage } from '../tests/lib/memoryStorage'
import { initWindowHarness } from '../tests/lib/windowHarness'

test('Game FPS bootstrap preserves user files and materializes its selected seed', async () => {
  const previousDemo = process.env.VITE_KNOWGRPH_RUN_READY_DEMO
  const previousRepoLocal = process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL
  const previousFetch = globalThis.fetch
  process.env.VITE_KNOWGRPH_RUN_READY_DEMO = 'game_fps'
  process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL = '1'
  const { restore } = initWindowHarness({ storage: new MemoryStorage() })
  const seedText = [
    '---',
    'title: "Knowgrph Game FPS Demo"',
    'kgCanvasSurfaceMode: "3d"',
    '---',
    '',
    '# Game FPS persisted seed',
  ].join('\n')
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    return url.includes('knowgrph-game-fps-demo.md') || url.includes('knowgrph-game-fps-demo.md'.replaceAll('-', '%2D'))
      ? new Response(seedText, { status: 200 })
      : new Response('', { status: 404 })
  }) as typeof fetch

  try {
    const persistedModuleUrl = new URL(
      `../features/workspace-fs/workspaceFsPersisted.ts?game-fps-existing=${Date.now()}`,
      import.meta.url,
    ).href
    const { createWorkspacePersistedFs } = await import(persistedModuleUrl) as typeof import('../features/workspace-fs/workspaceFsPersisted')
    const workspace = createWorkspacePersistedFs()
    const userPath = await workspace.createFile({
      parentPath: '/',
      name: 'user-notes.md',
      text: '# Preserve me',
    })

    await workspace.ensureSeed()
    const entries = await workspace.listEntries()
    const gameSeed = entries.find(entry => entry.kind === 'file' && entry.name === 'knowgrph-game-fps-demo.md')
    assert.ok(gameSeed, 'selected Game FPS seed must materialize beside an existing user file')
    assert.equal(await workspace.readFileText(userPath), '# Preserve me')
    assert.equal(await workspace.readFileText(gameSeed.path), seedText)
  } finally {
    globalThis.fetch = previousFetch
    restore()
    if (previousDemo === undefined) delete process.env.VITE_KNOWGRPH_RUN_READY_DEMO
    else process.env.VITE_KNOWGRPH_RUN_READY_DEMO = previousDemo
    if (previousRepoLocal === undefined) delete process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL
    else process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL = previousRepoLocal
  }
})
