import fs from 'node:fs'
import path from 'node:path'
import { load as parseYaml } from 'js-yaml'

import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { loadWorkspaceSeedText } from '@/features/workspace-fs/workspaceFs'
import { buildLocalFsFetchPath } from '@/lib/url'
import {
  readWorkspaceDocsMirrorRootPathSetting,
  writeWorkspaceDocsMirrorRootPathSetting,
} from '@/lib/workspace/workspaceStoreSyncSettings'
import {
  WORKSPACE_RUN_READY_DEMO_ENV,
  XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME,
  XR_PHYSICS_RUN_READY_DEMO_ID,
  resolveWorkspaceRunReadyDemoSeed,
  resolveWorkspaceValidationSeedRelPath,
} from '@/features/workspace-fs/workspaceRunReadyDemos'

type PlainRecord = Record<string, unknown>

const REPO_ROOT = path.resolve(process.cwd(), '..')
const SEED_REL_PATH = `docs/workspace-seeds/${XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME}`
const SEED_PATH = path.join(REPO_ROOT, SEED_REL_PATH)

const asRecord = (value: unknown, label: string): PlainRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`expected ${label} to be an object`)
  }
  return value as PlainRecord
}

const extractFrontmatterYaml = (text: string): string => {
  if (!text.startsWith('---\n')) throw new Error('expected XR physics demo to start with byte-zero YAML frontmatter')
  const endIndex = text.indexOf('\n---\n', 4)
  if (endIndex < 0) throw new Error('expected XR physics demo to close YAML frontmatter before body Markdown')
  return text.slice(4, endIndex)
}

export async function testXrPhysicsDemoRunReadyModeLoadsNativeInRepoSeed() {
  const markdownText = fs.readFileSync(SEED_PATH, 'utf8')
  const meta = asRecord(parseYaml(extractFrontmatterYaml(markdownText)), 'frontmatter')

  if (
    meta.status !== 'runtime-ready'
    || meta.runtime_status !== 'runtime-ready'
    || meta.publish_scope !== 'local-only'
  ) {
    throw new Error(`expected local runtime-ready status, got ${JSON.stringify({
      status: meta.status,
      runtime_status: meta.runtime_status,
      publish_scope: meta.publish_scope,
    })}`)
  }
  if (
    meta.kgCanvasSurfaceMode !== 'xr'
    || meta.kgCanvasRenderMode !== '3d'
    || meta.kgCanvas3dMode !== 'xr'
  ) {
    throw new Error('expected the workspace seed to activate the canonical XR surface and 3D renderer')
  }
  if (
    meta.kgFloatingPanelOpen !== true
    || meta.kgFloatingPanelView !== 'media'
    || meta.kgBottomPanelOpen !== true
    || meta.kgBottomPanelTab !== 'timeline'
  ) {
    throw new Error('expected the workspace seed to open the canonical Media Simulation and Timeline surfaces')
  }

  const runReady = asRecord(meta.run_ready_demo, 'run_ready_demo')
  if (
    runReady.id !== XR_PHYSICS_RUN_READY_DEMO_ID
    || runReady.env_selector !== `${WORKSPACE_RUN_READY_DEMO_ENV}=${XR_PHYSICS_RUN_READY_DEMO_ID}`
    || runReady.validation_seed_path !== `/${XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME}`
    || runReady.source_root !== 'knowgrph/docs'
    || runReady.source_backed !== true
    || runReady.clean_canvas_recommended !== true
    || runReady.native_runtime !== true
    || !Array.isArray(runReady.external_dependencies)
    || runReady.external_dependencies.length !== 0
  ) {
    throw new Error(`expected native in-repo run-ready metadata, got ${JSON.stringify(runReady)}`)
  }

  const registered = resolveWorkspaceRunReadyDemoSeed('XR_PHYSICS')
  if (
    !registered
    || registered.id !== XR_PHYSICS_RUN_READY_DEMO_ID
    || registered.validationSeedRelPath !== XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME
    || registered.sourceRoot !== 'knowgrph/docs'
    || registered.cleanCanvasRecommended !== true
    || !registered.seedRelPathCandidates.includes(SEED_REL_PATH)
  ) {
    throw new Error(`expected XR physics demo to resolve from the shared run-ready registry, got ${JSON.stringify(registered)}`)
  }
  const selected = resolveWorkspaceValidationSeedRelPath({
    explicitRelPath: '',
    runReadyDemoId: XR_PHYSICS_RUN_READY_DEMO_ID,
    defaultRelPath: 'fallback.md',
  })
  if (selected !== XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME) {
    throw new Error(`expected XR physics demo mode to select its source seed, got ${selected}`)
  }
  const explicit = resolveWorkspaceValidationSeedRelPath({
    explicitRelPath: 'operator-owned.md',
    runReadyDemoId: XR_PHYSICS_RUN_READY_DEMO_ID,
    defaultRelPath: 'fallback.md',
  })
  if (explicit !== 'operator-owned.md') throw new Error(`expected explicit seed selection to remain authoritative, got ${explicit}`)

  const parsed = tryParseMarkdownFrontmatterFlowGraph(XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME, markdownText)
  if (!parsed || parsed.graphData.context !== 'frontmatter-flow') {
    throw new Error('expected XR physics demo to parse through the canonical frontmatter-flow path')
  }
  const graphNodeIds = new Set(parsed.graphData.nodes.map(node => String(node.id || '')))
  for (const id of ['xr_demo_entry', 'xr_ball_controller', 'xr_rocket_controller', 'xr_runtime_gate']) {
    if (!graphNodeIds.has(id)) throw new Error(`expected XR physics demo graph to include ${id}`)
  }

  for (const required of [
    'rolling movement',
    'grounded jump',
    'directional thrust',
    'modifier stabilization',
    'standard left stick',
    'smooth follow',
    '/xr.physics @canvas #controller operation=develop-run mode=ball',
    'knowgrph.control_local_xr_scene',
  ]) {
    if (!markdownText.includes(required)) throw new Error(`expected native demo contract to include ${required}`)
  }
  for (const forbidden of [/https?:\/\//i, /\bgithub\b/i, /\bcdn\b/i, /\bnode_modules\b/i]) {
    if (forbidden.test(markdownText)) throw new Error(`expected standalone seed to avoid external locator ${forbidden.source}`)
  }

  const rootPackage = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as PlainRecord
  const canvasPackage = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'canvas', 'package.json'), 'utf8')) as PlainRecord
  const rootScripts = asRecord(rootPackage.scripts, 'root scripts')
  const canvasScripts = asRecord(canvasPackage.scripts, 'canvas scripts')
  if (rootScripts['demo:xr-physics'] !== 'npm run dev:xr-physics --workspace=@knowgrph/canvas --') {
    throw new Error('expected the repository demo command to delegate to the Canvas workspace')
  }
  const expectedCanvasScript = `VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT=$PWD/../docs VITE_KNOWGRPH_RUN_READY_REPO_LOCAL=1 ${WORKSPACE_RUN_READY_DEMO_ENV}=${XR_PHYSICS_RUN_READY_DEMO_ID} vite --configLoader runner`
  if (canvasScripts['dev:xr-physics'] !== expectedCanvasScript) {
    throw new Error('expected the Canvas demo command to activate repo-local source authority and the shared run-ready selector')
  }
  const expectedCanvasPredev = 'npm run prepare:linked-packages && npm run fix:entities-sourcemaps && npm run build:settings'
  if (canvasScripts['predev:xr-physics'] !== expectedCanvasPredev) {
    throw new Error('expected the standalone demo preflight to prepare only native in-repo runtime dependencies')
  }

  const expectedProviderUrl = buildLocalFsFetchPath(SEED_PATH)
  if (!expectedProviderUrl) throw new Error('expected the in-repo seed to resolve to a local filesystem fetch path')
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousRepoLocal = process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL
  const previousStoredRoot = readWorkspaceDocsMirrorRootPathSetting()
  const externalRoot = path.join(REPO_ROOT, 'external-conflicting-docs')
  process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = path.join(REPO_ROOT, 'docs')
  process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL = '1'
  writeWorkspaceDocsMirrorRootPathSetting(externalRoot)
  const previousFetch = globalThis.fetch
  const requestedUrls: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    requestedUrls.push(url)
    return url === expectedProviderUrl
      ? new Response(markdownText, { status: 200, headers: { 'content-type': 'text/markdown' } })
      : new Response('', { status: 404 })
  }) as typeof fetch
  try {
    const externalConflictText = 'external mirror with conflicting basename must never win'
    const loaded = await loadWorkspaceSeedText({
      basename: XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME,
      relPaths: [`workspace-seeds/${XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME}`],
      fallbackText: 'fallback must not win',
      sourceExclusive: true,
      docsMirrorEntries: [{
        relPath: `workspace-seeds/${XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME}`,
        text: externalConflictText,
        updatedAtMs: Date.now() + 60_000,
      }],
    })
    if (
      loaded.isFallback
      || loaded.text !== markdownText.trim()
      || loaded.text === externalConflictText
      || !requestedUrls.includes(expectedProviderUrl)
      || requestedUrls.some(url => url.includes(externalRoot))
      || readWorkspaceDocsMirrorRootPathSetting() !== path.join(REPO_ROOT, 'docs')
    ) {
      throw new Error('expected repo-local source authority to beat a newer conflicting external mirror basename')
    }
  } finally {
    globalThis.fetch = previousFetch
    writeWorkspaceDocsMirrorRootPathSetting(previousStoredRoot)
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (typeof previousRepoLocal === 'string') process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL = previousRepoLocal
    else delete process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL
  }
}
