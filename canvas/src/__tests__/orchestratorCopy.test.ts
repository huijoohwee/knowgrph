import {
  ORCHESTRATOR_TRAVERSAL_TOOLTIP,
  GRAPH_DATA_TABLE_CURATION_TOOLTIP,
  GRAPH_FIELDS_ICON_LEGEND_TOOLTIP,
  GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP,
  WORKFLOW_LINKS_TOOLTIP,
  AGENTIC_REASONING_LABELS_TOOLTIP,
  GRAPHRAG_PATH_METADATA_TOOLTIP,
  WORKFLOW_STEP3_PARSER_TOOLTIP,
  WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP,
  WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP,
  TRAVERSAL_PRESET_UI_TOOLTIP,
  HELP_CHEATSHEET_ALIGNMENT_TOOLTIP,
  HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP,
  WORKFLOW_INDEXING_PARAMETERS_TOOLTIP,
  GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP,
  AGENTIC_RAG_CONTEXT_IRI_TOOLTIP,
  ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP,
  TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP,
  TRAVERSAL_PRESETS_SECTION_TOOLTIP,
  WORKFLOW_TAB_HEADER_TOOLTIP,
  HELP_TAB_HEADER_TOOLTIP,
  SETTINGS_TAB_HEADER_TOOLTIP,
  TRAVERSAL_SEQUENCE_TOOLTIP,
  DUCKDB_SQL_FIELD_TOOLTIP,
  AI_KG_LAYER_MODE_TOOLTIP,
  AI_KG_SEMANTIC_METRIC_TOOLTIP,
  AI_KG_SEMANTIC_TOPK_TOOLTIP,
  AI_KG_SEMANTIC_MIN_SIMILARITY_TOOLTIP,
  AI_KG_SEMANTIC_EDGE_LABEL_TOOLTIP,
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

const readRoleActionOutcomeFixture = async (relativePath: string): Promise<RoleActionOutcomeFixture> => {
  const url = new URL(relativePath, import.meta.url)
  const fileKey = url.pathname.split('/').pop()?.replace(/\.jsonld$/i, '') ?? ''
  const isNodeRuntime =
    typeof process !== 'undefined' && !!(process as unknown as { versions?: { node?: string } }).versions?.node
  if (isNodeRuntime) {
    const fs = await import('node:fs')
    try {
      const text = fs.readFileSync(url, 'utf8')
      return JSON.parse(text) as RoleActionOutcomeFixture
    } catch {
      if (!fileKey) throw new Error(`Unable to resolve RoleActionOutcome fixture key from path: ${relativePath}`)
      return readRoleActionOutcomeFixtureFromUniversalSchemaConfig(fileKey)
    }
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    if (!fileKey) throw new Error(`Unable to resolve RoleActionOutcome fixture key from path: ${relativePath}`)
    return readRoleActionOutcomeFixtureFromUniversalSchemaConfig(fileKey)
  }
  const text = await res.text()
  return JSON.parse(text) as RoleActionOutcomeFixture
}

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

export async function testGraphFieldsIconLegendRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/graph-fields-icon-legend-role-action-outcome.jsonld')
  const text = GRAPH_FIELDS_ICON_LEGEND_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Graph Fields icon legend JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Graph Fields icon legend JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('GRAPH_FIELDS_ICON_LEGEND_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`GRAPH_FIELDS_ICON_LEGEND_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('GRAPH_FIELDS_ICON_LEGEND_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testGraphFieldsTableMappingRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/graph-fields-table-mapping-role-action-outcome.jsonld')
  const text = GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Graph Fields table mapping JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Graph Fields table mapping JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testGraphDataTableCurationRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/graph-data-table-curation-role-action-outcome.jsonld')
  const text = GRAPH_DATA_TABLE_CURATION_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Graph Data Table curation JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Graph Data Table curation JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('GRAPH_DATA_TABLE_CURATION_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`GRAPH_DATA_TABLE_CURATION_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('GRAPH_DATA_TABLE_CURATION_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testWorkflowLinksRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/workflow-links-role-action-outcome.jsonld')
  const text = WORKFLOW_LINKS_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Workflow links JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Workflow links JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('WORKFLOW_LINKS_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`WORKFLOW_LINKS_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('WORKFLOW_LINKS_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testAgenticReasoningLabelsRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/agentic-reasoning-labels-role-action-outcome.jsonld')
  const text = AGENTIC_REASONING_LABELS_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Agentic reasoning labels JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Agentic reasoning labels JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('AGENTIC_REASONING_LABELS_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`AGENTIC_REASONING_LABELS_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('AGENTIC_REASONING_LABELS_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testGraphRagPathMetadataRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/graphrag-path-metadata-role-action-outcome.jsonld')
  const text = GRAPHRAG_PATH_METADATA_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('graphRAGPath metadata JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('graphRAGPath metadata JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('GRAPHRAG_PATH_METADATA_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`GRAPHRAG_PATH_METADATA_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('GRAPHRAG_PATH_METADATA_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testWorkflowStep3ParserRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/workflow-step3-parser-role-action-outcome.jsonld')
  const text = WORKFLOW_STEP3_PARSER_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Workflow Step 3 Parser JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Workflow Step 3 Parser JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('WORKFLOW_STEP3_PARSER_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`WORKFLOW_STEP3_PARSER_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('WORKFLOW_STEP3_PARSER_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testWorkflowStep6OrchestratorRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/workflow-step6-orchestrator-role-action-outcome.jsonld')
  const text = WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Workflow Step 6 Orchestrator JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Workflow Step 6 Orchestrator JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testWorkflowStep8BottomTabsRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/workflow-step8-bottom-tabs-role-action-outcome.jsonld')
  const text = WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Workflow Step 8 bottom tabs JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Workflow Step 8 bottom tabs JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testTraversalPresetUiRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/traversal-preset-ui-role-action-outcome.jsonld')
  const text = TRAVERSAL_PRESET_UI_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Traversal preset UI JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Traversal preset UI JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('TRAVERSAL_PRESET_UI_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`TRAVERSAL_PRESET_UI_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('TRAVERSAL_PRESET_UI_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testHelpCheatsheetAlignmentRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture('../../../schema-config/help-cheatsheet-alignment-role-action-outcome.jsonld')
  const text = HELP_CHEATSHEET_ALIGNMENT_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Help cheatsheet alignment JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Help cheatsheet alignment JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('HELP_CHEATSHEET_ALIGNMENT_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`HELP_CHEATSHEET_ALIGNMENT_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('HELP_CHEATSHEET_ALIGNMENT_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testHelpCodebaseIndexEntryPointsRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/help-codebase-index-entry-points-role-action-outcome.jsonld',
  )
  const text = HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Help codebase index entry points JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Help codebase index entry points JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testWorkflowIndexingParametersRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/workflow-indexing-parameters-role-action-outcome.jsonld',
  )
  const text = WORKFLOW_INDEXING_PARAMETERS_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Workflow indexing parameters JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Workflow indexing parameters JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('WORKFLOW_INDEXING_PARAMETERS_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`WORKFLOW_INDEXING_PARAMETERS_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('WORKFLOW_INDEXING_PARAMETERS_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testTraversalPresetsSectionRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/traversal-presets-section-role-action-outcome.jsonld',
  )
  const text = TRAVERSAL_PRESETS_SECTION_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Traversal presets and helpers JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Traversal presets and helpers JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('TRAVERSAL_PRESETS_SECTION_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`TRAVERSAL_PRESETS_SECTION_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('TRAVERSAL_PRESETS_SECTION_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testTraversalEditorAndLayersSectionRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/traversal-editor-and-layers-section-role-action-outcome.jsonld',
  )
  const text = TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Traversal editor and layers JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Traversal editor and layers JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(
        `TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP missing action clause from JSON-LD fixture: ${action}`,
      )
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testWorkflowTabHeaderRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/workflow-tab-header-role-action-outcome.jsonld',
  )
  const text = WORKFLOW_TAB_HEADER_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Workflow tab header JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Workflow tab header JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('WORKFLOW_TAB_HEADER_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`WORKFLOW_TAB_HEADER_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('WORKFLOW_TAB_HEADER_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testHelpTabHeaderRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/help-tab-header-role-action-outcome.jsonld',
  )
  const text = HELP_TAB_HEADER_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Help tab header JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Help tab header JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('HELP_TAB_HEADER_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`HELP_TAB_HEADER_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('HELP_TAB_HEADER_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testSettingsTabHeaderRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/settings-tab-header-role-action-outcome.jsonld',
  )
  const text = SETTINGS_TAB_HEADER_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Settings tab header JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Settings tab header JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('SETTINGS_TAB_HEADER_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`SETTINGS_TAB_HEADER_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('SETTINGS_TAB_HEADER_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testGraphRagWorkflowSummaryRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/graphrag-workflow-summary-role-action-outcome.jsonld',
  )
  const text = GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('GraphRAG workflow summary JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('GraphRAG workflow summary JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testAgenticRagContextIriRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/agenticrag-context-iri-role-action-outcome.jsonld',
  )
  const text = AGENTIC_RAG_CONTEXT_IRI_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('AgenticRAG context IRI JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('AgenticRAG context IRI JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('AGENTIC_RAG_CONTEXT_IRI_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`AGENTIC_RAG_CONTEXT_IRI_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('AGENTIC_RAG_CONTEXT_IRI_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testOrchestratorTracingOptionsRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/orchestrator-tracing-options-role-action-outcome.jsonld',
  )
  const text = ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Orchestrator tracing options JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Orchestrator tracing options JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testTraversalSequenceRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/traversal-sequence-role-action-outcome.jsonld',
  )
  const text = TRAVERSAL_SEQUENCE_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Traversal sequence JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Traversal sequence JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('TRAVERSAL_SEQUENCE_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`TRAVERSAL_SEQUENCE_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('TRAVERSAL_SEQUENCE_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testDuckdbSqlFieldRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/duckdb-sql-field-role-action-outcome.jsonld',
  )
  const text = DUCKDB_SQL_FIELD_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('DuckDB SQL field JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('DuckDB SQL field JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('DUCKDB_SQL_FIELD_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`DUCKDB_SQL_FIELD_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('DUCKDB_SQL_FIELD_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testAiKgLayerModeRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/ai-kg-layer-mode-role-action-outcome.jsonld',
  )
  const text = AI_KG_LAYER_MODE_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('AI-KG layer mode JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('AI-KG layer mode JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('AI_KG_LAYER_MODE_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`AI_KG_LAYER_MODE_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('AI_KG_LAYER_MODE_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testAiKgSemanticMetricRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/ai-kg-semantic-metric-role-action-outcome.jsonld',
  )
  const text = AI_KG_SEMANTIC_METRIC_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Semantic similarity metric JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Semantic similarity metric JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('AI_KG_SEMANTIC_METRIC_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`AI_KG_SEMANTIC_METRIC_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('AI_KG_SEMANTIC_METRIC_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testAiKgSemanticTopKRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/ai-kg-semantic-topk-role-action-outcome.jsonld',
  )
  const text = AI_KG_SEMANTIC_TOPK_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Semantic edge sparsity JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Semantic edge sparsity JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('AI_KG_SEMANTIC_TOPK_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(`AI_KG_SEMANTIC_TOPK_TOOLTIP missing action clause from JSON-LD fixture: ${action}`)
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('AI_KG_SEMANTIC_TOPK_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testAiKgSemanticMinSimilarityRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/ai-kg-semantic-minsimilarity-role-action-outcome.jsonld',
  )
  const text = AI_KG_SEMANTIC_MIN_SIMILARITY_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Semantic similarity threshold JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Semantic similarity threshold JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('AI_KG_SEMANTIC_MIN_SIMILARITY_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(
        `AI_KG_SEMANTIC_MIN_SIMILARITY_TOOLTIP missing action clause from JSON-LD fixture: ${action}`,
      )
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('AI_KG_SEMANTIC_MIN_SIMILARITY_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}

export async function testAiKgSemanticSimilarityEdgeLabelRoleActionOutcomeJsonLdFixtureMatchesTooltip() {
  const fixture = await readRoleActionOutcomeFixture(
    '../../../schema-config/ai-kg-semantic-similarity-edge-label-role-action-outcome.jsonld',
  )
  const text = AI_KG_SEMANTIC_EDGE_LABEL_TOOLTIP
  if (fixture['@type'] !== 'rag:RoleActionOutcome') {
    throw new Error('Semantic similarity label JSON-LD fixture must use rag:RoleActionOutcome type')
  }
  if (fixture['@context'] !== 'https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld') {
    throw new Error('Semantic similarity label JSON-LD fixture must use AgenticRAG v1 context')
  }
  if (!text.startsWith(fixture.role)) {
    throw new Error('AI_KG_SEMANTIC_EDGE_LABEL_TOOLTIP must start with the Role from the JSON-LD fixture')
  }
  for (const action of fixture.actions) {
    if (!text.includes(action)) {
      throw new Error(
        `AI_KG_SEMANTIC_EDGE_LABEL_TOOLTIP missing action clause from JSON-LD fixture: ${action}`,
      )
    }
  }
  if (!text.includes(fixture.outcome)) {
    throw new Error('AI_KG_SEMANTIC_EDGE_LABEL_TOOLTIP missing outcome clause from JSON-LD fixture')
  }
  await Promise.resolve()
}
