import { readEnvString } from '@/lib/config.env'

export const WORKSPACE_RUN_READY_DEMO_ENV = 'VITE_KNOWGRPH_RUN_READY_DEMO'
export const CARE_AGENT_RUN_READY_DEMO_ID = 'care-agent'
export const CARE_AGENT_DEMO_WORKSPACE_SEED_BASENAME = 'knowgrph-care-agent-demo.md'
export const RISK_COPILOT_RUN_READY_DEMO_ID = 'risk-copilot'
export const RISK_COPILOT_DEMO_WORKSPACE_SEED_BASENAME = 'knowgrph-sme-care-agent-demo.md'
export const XR_PHYSICS_RUN_READY_DEMO_ID = 'xr-physics'
export const XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME = 'knowgrph-physics-playground-demo.md'
export const XR_PHYSICS_DEMO_REPO_REL_PATH = `docs/workspace-seeds/${XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME}`
export const XR_PHYSICS_DEMO_CODEBASE_REL_PATH = `knowgrph/${XR_PHYSICS_DEMO_REPO_REL_PATH}`
export const XR_PHYSICS_DEMO_PUBLISHED_CANONICAL_PATH = `agentic-canvas-os/${XR_PHYSICS_DEMO_REPO_REL_PATH}`
export const GAME_FPS_RUN_READY_DEMO_ID = 'game-fps'
export const GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME = 'knowgrph-game-fps-demo.md'
export const GAME_FPS_DEMO_REPO_REL_PATH = `docs/workspace-seeds/${GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME}`
export const GAME_FPS_DEMO_CODEBASE_REL_PATH = `knowgrph/${GAME_FPS_DEMO_REPO_REL_PATH}`

export type WorkspaceRunReadyDemoSeed = {
  id: string
  label: string
  validationSeedRelPath: string
  seedRelPathCandidates: readonly string[]
  sourceRoot: 'huijoohwee/docs' | 'knowgrph/docs'
  cleanCanvasRecommended: boolean
}

const normalizeDemoId = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')

export const WORKSPACE_RUN_READY_DEMO_SEEDS: readonly WorkspaceRunReadyDemoSeed[] = [
  {
    id: CARE_AGENT_RUN_READY_DEMO_ID,
    label: 'Knowgrph Care Agent Demo',
    validationSeedRelPath: CARE_AGENT_DEMO_WORKSPACE_SEED_BASENAME,
    seedRelPathCandidates: [
      `docs/workspace-seeds/${CARE_AGENT_DEMO_WORKSPACE_SEED_BASENAME}`,
      `docs/${CARE_AGENT_DEMO_WORKSPACE_SEED_BASENAME}`,
      CARE_AGENT_DEMO_WORKSPACE_SEED_BASENAME,
    ],
    sourceRoot: 'huijoohwee/docs',
    cleanCanvasRecommended: true,
  },
  {
    id: RISK_COPILOT_RUN_READY_DEMO_ID,
    label: 'Knowgrph SME Risk Copilot Demo',
    validationSeedRelPath: RISK_COPILOT_DEMO_WORKSPACE_SEED_BASENAME,
    seedRelPathCandidates: [
      `docs/workspace-seeds/${RISK_COPILOT_DEMO_WORKSPACE_SEED_BASENAME}`,
      `docs/${RISK_COPILOT_DEMO_WORKSPACE_SEED_BASENAME}`,
      RISK_COPILOT_DEMO_WORKSPACE_SEED_BASENAME,
    ],
    sourceRoot: 'huijoohwee/docs',
    cleanCanvasRecommended: true,
  },
  {
    id: XR_PHYSICS_RUN_READY_DEMO_ID,
    label: 'Knowgrph Native XR Physics Demo',
    validationSeedRelPath: XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME,
    seedRelPathCandidates: [
      XR_PHYSICS_DEMO_REPO_REL_PATH,
      `workspace-seeds/${XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME}`,
      `docs/${XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME}`,
      XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME,
      XR_PHYSICS_DEMO_CODEBASE_REL_PATH,
    ],
    sourceRoot: 'knowgrph/docs',
    cleanCanvasRecommended: true,
  },
  {
    id: GAME_FPS_RUN_READY_DEMO_ID,
    label: 'Knowgrph Deterministic FPS Mission',
    validationSeedRelPath: GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME,
    seedRelPathCandidates: [
      GAME_FPS_DEMO_REPO_REL_PATH,
      `workspace-seeds/${GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME}`,
      `docs/${GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME}`,
      GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME,
      GAME_FPS_DEMO_CODEBASE_REL_PATH,
    ],
    sourceRoot: 'knowgrph/docs',
    cleanCanvasRecommended: true,
  },
]

export const resolveWorkspaceRunReadyDemoSeed = (demoId: string): WorkspaceRunReadyDemoSeed | null => {
  const normalized = normalizeDemoId(demoId)
  if (!normalized) return null
  return WORKSPACE_RUN_READY_DEMO_SEEDS.find(seed => seed.id === normalized) || null
}

export const resolveWorkspaceRunReadyDemoSeedRelPath = (demoId: string): string => (
  resolveWorkspaceRunReadyDemoSeed(demoId)?.validationSeedRelPath || ''
)

const normalizeWorkspaceDocumentPath = (value: string | null | undefined): string => (
  String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^workspace:/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
)

export const resolveWorkspaceRunReadyDemoIdForDocumentPath = (
  documentPath: string | null | undefined,
): string => {
  const normalizedPath = normalizeWorkspaceDocumentPath(documentPath)
  if (!normalizedPath) return ''
  for (const seed of WORKSPACE_RUN_READY_DEMO_SEEDS) {
    const matches = seed.seedRelPathCandidates.some(candidate => (
      normalizeWorkspaceDocumentPath(candidate) === normalizedPath
    ))
    if (matches) return seed.id
  }
  return ''
}

export const readWorkspaceRunReadyDemoId = (
  documentPath?: string | null,
): string => {
  const explicitlySelected = resolveWorkspaceRunReadyDemoSeed(
    readEnvString(WORKSPACE_RUN_READY_DEMO_ENV, ''),
  )
  if (explicitlySelected) return explicitlySelected.id
  return resolveWorkspaceRunReadyDemoIdForDocumentPath(documentPath)
}

export const isXrPhysicsRunReadyDemoActive = (
  documentPath?: string | null,
): boolean => (
  readWorkspaceRunReadyDemoId(documentPath) === XR_PHYSICS_RUN_READY_DEMO_ID
)

export const isGameFpsRunReadyDemoActive = (
  documentPath?: string | null,
): boolean => (
  readWorkspaceRunReadyDemoId(documentPath) === GAME_FPS_RUN_READY_DEMO_ID
)

export const isGameFpsRepoLocalRunReadyBootstrap = (): boolean => {
  const value = readEnvString('VITE_KNOWGRPH_RUN_READY_REPO_LOCAL', '').trim().toLowerCase()
  const repoLocal = value === '1' || value === 'true' || value === 'yes' || value === 'on'
  return repoLocal && readWorkspaceRunReadyDemoId() === GAME_FPS_RUN_READY_DEMO_ID
}

export const resolveWorkspaceValidationSeedRelPath = (args: {
  explicitRelPath: string
  runReadyDemoId: string
  defaultRelPath: string
}): string => {
  const explicit = String(args.explicitRelPath || '').trim()
  if (explicit) return explicit
  const demoSeedRelPath = resolveWorkspaceRunReadyDemoSeedRelPath(args.runReadyDemoId)
  if (demoSeedRelPath) return demoSeedRelPath
  return String(args.defaultRelPath || '').trim()
}

export const readWorkspaceRunReadyDemoSeedRelPath = (): string =>
  resolveWorkspaceRunReadyDemoSeedRelPath(readWorkspaceRunReadyDemoId())
