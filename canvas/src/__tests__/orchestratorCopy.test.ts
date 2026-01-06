import {
  ORCHESTRATOR_TRAVERSAL_TOOLTIP,
  GRAPH_DATA_TABLE_CURATION_TOOLTIP,
} from '@/lib/config'
import { TOOL_MENU_AREAS } from '@/features/toolbar/toolMenu'
import { getOrchestratorSectionListLabel, ORCHESTRATOR_AGENTIC_COPY } from '@/features/panels/config'

type RoleActionOutcomeFixture = {
  '@context': string
  '@type': string
  role: string
  actions: string[]
  outcome: string
  pipeline_phase?: string
  ui_anchor?: string
  raci_role?: string
}

type UniversalSchemaConfig = {
  metadata?: {
    fixtures?: {
      roleActionOutcomes?: Record<string, RoleActionOutcomeFixture>
    }
  }
}

let cachedUniversalRoleActionOutcomes: Record<string, RoleActionOutcomeFixture> | null = null

const readUniversalRoleActionOutcomes = async (): Promise<Record<string, RoleActionOutcomeFixture>> => {
  if (cachedUniversalRoleActionOutcomes) return cachedUniversalRoleActionOutcomes
  const url = new URL('../../../schema-config/knowgrph-universal-schema-config.jsonld', import.meta.url)
  const isNodeRuntime =
    typeof process !== 'undefined' && !!(process as unknown as { versions?: { node?: string } }).versions?.node
  if (isNodeRuntime) {
    const fs = await import('node:fs')
    const text = fs.readFileSync(url, 'utf8')
    const parsed = JSON.parse(text) as UniversalSchemaConfig
    const fixtures = parsed.metadata?.fixtures?.roleActionOutcomes
    if (!fixtures) {
      throw new Error('Universal schema config missing metadata.fixtures.roleActionOutcomes')
    }
    cachedUniversalRoleActionOutcomes = fixtures
    return fixtures
  }
  const res = await fetch(url.toString())
  const text = await res.text()
  const parsed = JSON.parse(text) as UniversalSchemaConfig
  const fixtures = parsed.metadata?.fixtures?.roleActionOutcomes
  if (!fixtures) {
    throw new Error('Universal schema config missing metadata.fixtures.roleActionOutcomes')
  }
  cachedUniversalRoleActionOutcomes = fixtures
  return fixtures
}

const readRoleActionOutcomeFixtureFromUniversalSchemaConfig = async (key: string): Promise<RoleActionOutcomeFixture> => {
  const fixtures = await readUniversalRoleActionOutcomes()
  const fixture = fixtures[key]
  if (!fixture) {
    throw new Error(`Universal schema config missing metadata.fixtures.roleActionOutcomes.${key}`)
  }
  return fixture
}

const readOrchestratorRoleActionOutcomeFixture = async (): Promise<RoleActionOutcomeFixture> =>
  readRoleActionOutcomeFixtureFromUniversalSchemaConfig('orchestrator')

export async function testOrchestratorTooltipRoleActionOutcomeShape() {
  const text = ORCHESTRATOR_TRAVERSAL_TOOLTIP
  const parts = text.split('→')
  if (parts.length < 3) {
    throw new Error('ORCHESTRATOR_TRAVERSAL_TOOLTIP must follow Role → Actions → Outcome shape')
  }
  if (!text.includes('Orchestrator')) {
    throw new Error('ORCHESTRATOR_TRAVERSAL_TOOLTIP must include Orchestrator role label')
  }
  if (!text.includes('AgenticRAG')) {
    throw new Error('ORCHESTRATOR_TRAVERSAL_TOOLTIP must reference AgenticRAG traversal behavior')
  }
  if (!text.toLowerCase().includes('graph')) {
    throw new Error('ORCHESTRATOR_TRAVERSAL_TOOLTIP must describe graph navigation outcome')
  }
  await Promise.resolve()
}

export async function testOrchestratorToolMenuUsesTooltipCopyHelper() {
  const orchestratorArea = TOOL_MENU_AREAS.find(area => area.key === 'orchestrator')
  if (!orchestratorArea) {
    throw new Error('Tool menu orchestrator area configuration missing')
  }
  if (orchestratorArea.description !== ORCHESTRATOR_TRAVERSAL_TOOLTIP) {
    throw new Error('Tool menu orchestrator description does not match ORCHESTRATOR_TRAVERSAL_TOOLTIP')
  }
  await Promise.resolve()
}

export async function testOrchestratorSectionListLabelIncludesExpectedSections() {
  const label = getOrchestratorSectionListLabel()
  const fragments = [
    'traversal presets',
    'Traversal sequence',
    ORCHESTRATOR_AGENTIC_COPY.nodeInspectorTitle,
    'AgenticRAG context and ignore filters',
  ]
  for (const fragment of fragments) {
    if (!label.includes(fragment)) {
      throw new Error(`getOrchestratorSectionListLabel is missing fragment: ${fragment}`)
    }
  }
  await Promise.resolve()
}

export async function testAgenticRagNodeInspectorTooltipUsesCopyHelper() {
  const text = ORCHESTRATOR_AGENTIC_COPY.nodeInspectorTooltip
  if (!text.startsWith(ORCHESTRATOR_AGENTIC_COPY.nodeInspectorTitle)) {
    throw new Error('nodeInspectorTooltip must start with nodeInspectorTitle')
  }
  if (!text.includes('chunk_text') || !text.includes('graphRAGPath')) {
    throw new Error('nodeInspectorTooltip must describe chunk_text and graphRAGPath fields')
  }
  await Promise.resolve()
}

export async function testAgenticRagContextTooltipUsesCopyHelper() {
  const text = ORCHESTRATOR_AGENTIC_COPY.contextSectionTooltip
  if (!text.startsWith('AgenticRAG context and ignore filters')) {
    throw new Error('contextSectionTooltip must start with the AgenticRAG context and ignore filters label')
  }
  if (!text.includes('AgenticRAG context IRI')) {
    throw new Error('contextSectionTooltip must reference AgenticRAG context IRI behavior')
  }
  await Promise.resolve()
}

export async function testGraphDataTableToolMenuUsesCurationCopyHelper() {
  const curatorArea = TOOL_MENU_AREAS.find(area => area.key === 'curator')
  if (!curatorArea) {
    throw new Error('Tool menu curator area configuration missing')
  }
  if (curatorArea.description !== GRAPH_DATA_TABLE_CURATION_TOOLTIP) {
    throw new Error('Tool menu Graph Data Table description does not match GRAPH_DATA_TABLE_CURATION_TOOLTIP')
  }
  await Promise.resolve()
}

export async function testOrchestratorRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readOrchestratorRoleActionOutcomeFixture()
  const text = ORCHESTRATOR_TRAVERSAL_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('RoleActionOutcome JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('RoleActionOutcome JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('ORCHESTRATOR_TRAVERSAL_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`ORCHESTRATOR_TRAVERSAL_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('ORCHESTRATOR_TRAVERSAL_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}
