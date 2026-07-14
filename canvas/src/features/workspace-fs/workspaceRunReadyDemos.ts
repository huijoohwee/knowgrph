import { readEnvString } from '@/lib/config.env'

export const WORKSPACE_RUN_READY_DEMO_ENV = 'VITE_KNOWGRPH_RUN_READY_DEMO'
export const CARE_AGENT_RUN_READY_DEMO_ID = 'care-agent'
export const CARE_AGENT_DEMO_WORKSPACE_SEED_BASENAME = 'knowgrph-care-agent-demo.md'
export const RISK_COPILOT_RUN_READY_DEMO_ID = 'risk-copilot'
export const RISK_COPILOT_DEMO_WORKSPACE_SEED_BASENAME = 'knowgrph-sme-care-agent-demo.md'

export type WorkspaceRunReadyDemoSeed = {
  id: string
  label: string
  validationSeedRelPath: string
  seedRelPathCandidates: readonly string[]
  sourceRoot: 'huijoohwee/docs'
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
]

export const resolveWorkspaceRunReadyDemoSeed = (demoId: string): WorkspaceRunReadyDemoSeed | null => {
  const normalized = normalizeDemoId(demoId)
  if (!normalized) return null
  return WORKSPACE_RUN_READY_DEMO_SEEDS.find(seed => seed.id === normalized) || null
}

export const resolveWorkspaceRunReadyDemoSeedRelPath = (demoId: string): string => (
  resolveWorkspaceRunReadyDemoSeed(demoId)?.validationSeedRelPath || ''
)

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
  resolveWorkspaceRunReadyDemoSeedRelPath(readEnvString(WORKSPACE_RUN_READY_DEMO_ENV, ''))
