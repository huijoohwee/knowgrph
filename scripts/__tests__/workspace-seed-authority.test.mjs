import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  DRAFT_WORKSPACE_SEED_BASENAMES,
  PHYSICS_SEED_RELATIVE_PATH,
  resolveWorkspaceSeedSiblingRootsFromGitCommonDir,
  verifyWorkspaceSeedAuthority,
} from '../workspace-seed-authority.mjs'

const canonicalSeed = `---
canonical_source_file: "/docs/workspace-seeds/knowgrph-physics-playground-demo.md"
source_root: "knowgrph/docs"
source_backed: true
---
`

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-seed-authority-'))
  const knowgrphRoot = path.join(root, 'knowgrph')
  const agenticDocsRoot = path.join(root, 'agentic-canvas-os/docs')
  const publishRoot = path.join(root, 'huijoohwee')
  const canonicalPath = path.join(knowgrphRoot, PHYSICS_SEED_RELATIVE_PATH)
  const projectionPath = path.join(agenticDocsRoot, 'workspace-seeds/knowgrph-physics-playground-demo.md')
  await mkdir(path.dirname(canonicalPath), { recursive: true })
  await mkdir(path.dirname(projectionPath), { recursive: true })
  await mkdir(publishRoot, { recursive: true })
  await writeFile(path.join(path.dirname(canonicalPath), 'README.md'), '# Workspace Seed Authority\n')
  await writeFile(canonicalPath, canonicalSeed)
  for (const basename of DRAFT_WORKSPACE_SEED_BASENAMES) {
    const frontmatter = basename.endsWith('.companion.md')
      ? 'status: "draft"\nactivatable_seed: false\nnote_kind: "projection-contract"'
      : 'status: "draft"\nruntime_status: "draft"\nplanned_run_ready_demo:\n  id: "planned"'
    await writeFile(
      path.join(path.dirname(canonicalPath), basename),
      `---\n${frontmatter}\n---\n`,
    )
  }
  await writeFile(projectionPath, canonicalSeed)
  return { root, knowgrphRoot, agenticDocsRoot, publishRoot }
}

test('derives sibling roots from the canonical git common directory', () => {
  assert.deepEqual(
    resolveWorkspaceSeedSiblingRootsFromGitCommonDir('/workspace/GitHub/knowgrph/.git'),
    {
      agenticDocsRoot: path.resolve('/workspace/GitHub/agentic-canvas-os/docs'),
      publishRoot: path.resolve('/workspace/GitHub/huijoohwee'),
    },
  )
})

test('accepts the exact authored and projection inventories', async t => {
  const roots = await fixture()
  t.after(() => rm(roots.root, { recursive: true, force: true }))
  await assert.doesNotReject(() => verifyWorkspaceSeedAuthority(roots))
})

test('rejects a missing authored inventory entry', async t => {
  const roots = await fixture()
  t.after(() => rm(roots.root, { recursive: true, force: true }))
  await rm(path.join(roots.knowgrphRoot, 'docs/workspace-seeds/README.md'))
  await assert.rejects(
    () => verifyWorkspaceSeedAuthority(roots),
    /Knowgrph authored workspace-seed directory must have exact file inventory.*missing=\["README.md"\]/,
  )
})

test('rejects every missing authored draft document', async t => {
  for (const basename of DRAFT_WORKSPACE_SEED_BASENAMES) {
    await t.test(basename, async t => {
      const roots = await fixture()
      t.after(() => rm(roots.root, { recursive: true, force: true }))
      await rm(path.join(roots.knowgrphRoot, 'docs/workspace-seeds', basename))
      await assert.rejects(
        () => verifyWorkspaceSeedAuthority(roots),
        new RegExp(`Knowgrph authored workspace-seed directory must have exact file inventory.*missing=.*${basename.replaceAll('.', '\\.')}`),
      )
    })
  }
})

test('rejects a draft document that declares runtime activation', async t => {
  const roots = await fixture()
  t.after(() => rm(roots.root, { recursive: true, force: true }))
  await writeFile(
    path.join(roots.knowgrphRoot, 'docs/workspace-seeds/knowgrph-game-flight-sim-demo.md'),
    '---\nstatus: "draft"\nruntime_status: "draft"\nrun_ready_demo:\n  id: "flight-sim"\n---\n',
  )
  await assert.rejects(
    () => verifyWorkspaceSeedAuthority(roots),
    /draft workspace document knowgrph-game-flight-sim-demo\.md must remain non-activating/,
  )
})

test('rejects draft documents projected into Agentic Canvas OS', async t => {
  for (const basename of DRAFT_WORKSPACE_SEED_BASENAMES) {
    await t.test(basename, async t => {
      const roots = await fixture()
      t.after(() => rm(roots.root, { recursive: true, force: true }))
      await writeFile(
        path.join(roots.agenticDocsRoot, 'workspace-seeds', basename),
        '# Forbidden stale draft projection\n',
      )
      await assert.rejects(
        () => verifyWorkspaceSeedAuthority(roots),
        new RegExp(`Agentic Canvas OS workspace-seed projection directory must have exact file inventory.*${basename.replaceAll('.', '\\.')}`),
      )
    })
  }
})

test('rejects a divergent storage projection', async t => {
  const roots = await fixture()
  t.after(() => rm(roots.root, { recursive: true, force: true }))
  await writeFile(
    path.join(roots.agenticDocsRoot, 'workspace-seeds/knowgrph-physics-playground-demo.md'),
    `${canonicalSeed}stale\n`,
  )
  await assert.rejects(() => verifyWorkspaceSeedAuthority(roots), /byte-identical/)
})

test('rejects every workspace-seed entry in the publish repository', async t => {
  const roots = await fixture()
  t.after(() => rm(roots.root, { recursive: true, force: true }))
  const duplicatePath = path.join(roots.publishRoot, PHYSICS_SEED_RELATIVE_PATH)
  await mkdir(path.dirname(duplicatePath), { recursive: true })
  await writeFile(duplicatePath, canonicalSeed)
  await assert.rejects(
    () => verifyWorkspaceSeedAuthority(roots),
    /Publish repository workspace-seed directory must have exact file inventory \[\].*knowgrph-physics-playground-demo\.md/,
  )
})
