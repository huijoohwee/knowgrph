export type NumericTooltipValue = number | string;

export interface NumericTooltipOptions {
  defaultValue: NumericTooltipValue;
  min?: NumericTooltipValue;
  max?: NumericTooltipValue;
  interval?: NumericTooltipValue;
  impact: string;
}

export function buildNumericTooltip(options: NumericTooltipOptions): string {
  const segments: string[] = [];
  segments.push(`Default: ${options.defaultValue}`);
  if (typeof options.min !== 'undefined') {
    segments.push(`Min: ${options.min}`);
  }
  if (typeof options.max !== 'undefined') {
    segments.push(`Max: ${options.max}`);
  }
  if (typeof options.interval !== 'undefined') {
    segments.push(`Interval: ${options.interval}`);
  }
  segments.push(options.impact);
  return segments.join('; ');
}

export interface RoleActionOutcomeTooltipOptions {
  role: string;
  actions: string[];
  outcome: string;
}

export function buildRoleActionOutcomeTooltip(options: RoleActionOutcomeTooltipOptions): string {
  const actionsPart = options.actions.join(' \u2192 ');
  return `${options.role} \u2192 ${actionsPart} \u2192 ${options.outcome}`;
}

export function buildSettingsAreaTooltip(area: string, responsibility?: string): string {
  const normalizedResponsibility = responsibility ? responsibility.trim() : '';
  const base =
    normalizedResponsibility.length > 0
      ? `Settings area for ${normalizedResponsibility.toLowerCase()} keys. Expand to see modules, functions, and notes.`
      : 'Settings area grouping related keys. Expand to see modules, functions, and notes.';
  if (area === 'UI Density: Icons') {
    return `${base} Use uiIconScale to switch between compact and default icon sizes across toolbars and panels.`;
  }
  return base;
}

export const ORCHESTRATOR_TRAVERSAL_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Orchestrator',
  actions: [
    'execute AgenticRAG traversal presets and edit GraphRAG paths',
    'adjust traversal delay and view mode via bottom panel and Settings \u2192 Orchestrator',
  ],
  outcome: 'deliver controlled, customizable graph navigation for consistent analysis and sharing',
});

export const ORCHESTRATOR_TRAVERSAL_DELAY_ROW_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Orchestrator traversal delay row',
  actions: [
    'share traversalDelayMs across Orchestrator, Renderer, and Graph Traversal floating panel',
    'tune step pacing for graphRAGPath replays and generic traversals',
  ],
  outcome: 'keep AgenticRAG graph navigation smooth, debuggable, and reproducible across runs',
});

export const WORKFLOW_INDEXING_PARAMETERS_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'GraphRAG workflow indexing',
  actions: [
    'configure dataset paths, chunking, embedding model, and maxHops for a run',
    'mirror offline GraphRAG workflow JSON-LD fields in the Orchestrator bottom panel',
  ],
  outcome: 'keep indexing configuration consistent across AgenticRAG workflows, traversals, and exports',
});

export const TRAVERSAL_PRESETS_SECTION_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Traversal presets and helpers',
  actions: [
    'edit rag:TraversalRule entries, DuckDbQueryConfig helpers, and graphRAGPath presets used by Orchestrator and Renderer',
    'run generic graph queries while keeping traversal paths, label filters, and selection-driven helpers aligned with Renderer highlights and workflow JSON-LD',
  ],
  outcome:
    'keep AgenticRAG graphRAGPath presets reproducible across sessions and shared between Orchestrator and Renderer.',
});

export const TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Traversal editor',
  actions: [
    'edit traversal delay and traversal helpers over AgenticRAG GraphData',
    'coordinate Orchestrator playback with 2D/3D Renderer appearance',
  ],
  outcome:
    'produce readable, repeatable graph navigation tuned to current AgenticRAG graph state.',
});

export const TRAVERSAL_SEQUENCE_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Traversal sequence',
  actions: [
    'inspect nodes, edges, hops, and multiHop chains from the last traversal',
  ],
  outcome:
    'debug AgenticRAG graphRAGPath IRI steps for GraphRAG and generic queries without leaving Orchestrator playback.',
});

export const TRAVERSAL_SEQUENCE_MODE_LABEL_GRAPH_RAG = 'Agentic GraphRAG path';

export const TRAVERSAL_SEQUENCE_MODE_LABEL_GENERIC = 'Generic traversal query';

export const DUCKDB_SQL_FIELD_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'DuckDB SQL field',
  actions: [
    'edit parameterized graph queries for traversal helpers',
  ],
  outcome:
    'keep text-mode SQL aligned with AgenticRAG traversal and Renderer overlays.',
});

export const DUCKDB_QUERY_PRESETS_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'DuckDB query presets',
  actions: [
    'map duckdbQueries[].id to reusable traversal helpers',
  ],
  outcome:
    'keep SQL-based graph queries discoverable alongside Orchestrator presets.',
});

export const DUCKDB_QUERY_PRESET_ID_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'DuckDB query preset id',
  actions: [
    'select which duckdbQueries[].sql and description are active',
  ],
  outcome:
    'keep traversal helper labels in sync with underlying DuckDB SQL and GraphRAG overlays.',
});

export const DUCKDB_QUERY_PRESET_DESCRIPTION_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'DuckDB query preset description',
  actions: [
    'summarize traversal helper purpose and scope',
  ],
  outcome:
    'keep DuckDB presets self-documenting in Graph Traversal UI.',
});

export const GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'GraphRAG workflow summary',
  actions: [
    'show graphId, retrieval method, and workflow source for the active GraphRAG workflow',
    'connect Workflow, Orchestrator, and Renderer views back to the same rag:GraphRAGWorkflow JSON-LD',
  ],
  outcome:
    'keep traversal presets, traces, and exports anchored to a single AgenticRAG workflow document.',
});

export const AGENTIC_RAG_CONTEXT_IRI_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'AgenticRAG context IRI',
  actions: [
    'share graphContextUrl across GraphRAG workflows, generic traversals, and QA',
    'align workspace context with codebase index context IRIs and offline AgenticRAG runs',
  ],
  outcome:
    'keep reasoning, tracing, and exports aligned around a single AgenticRAG context URL.',
});

export const ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Orchestrator tracing options',
  actions: [
    'reuse workspace-wide traversalDelayMs configured in the traversal delay row',
    'tune graphRAGPath replay pacing, debug logs, and trace exports for traversals',
  ],
  outcome:
    'keep AgenticRAG graph navigation timing and tracing controls consistent across runs and workflows.',
});

export const IGNORE_CODEBASE_PATHS_LABEL = 'Ignore codebase paths';

export const IGNORE_CODEBASE_PATHS_TOOLTIP =
  'Ignore codebase paths \u2192 exclude selected files and directories from AgenticRAG indexing and traversal \u2192 keep GraphRAG workflows focused on relevant code while avoiding noisy or generated artifacts.';

export const GRAPH_FIELDS_ICON_LEGEND_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Graph Fields icon legend',
  actions: [
    'align scope, origin, visibility, and field-type badges with AgenticRAG-style node and edge properties',
  ],
  outcome:
    'keep schema design, curation flows, and Graph Data Table behavior grounded in the same JSON-LD-backed graph schema.',
});

export const WORKFLOW_LINKS_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Workflow links',
  actions: [
    'jump into Workflow and Graph Fields tabs mapped to the 8-stage GraphRAG pipeline',
  ],
  outcome:
    'keep Schema, Curation, Index, and Agentic reasoning steps aligned with AgenticRAG JSON-LD exports.',
});

export const AGENTIC_REASONING_LABELS_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Agentic reasoning labels',
  actions: [
    'mirror the Agentic GraphRAG pipeline from docs/knowgrph-raci-document.md',
  ],
  outcome:
    'keep Workflow, Orchestrator, and Renderer steps aligned with the same end-to-end AgenticRAG graph pipeline.',
});

export const GRAPHRAG_PATH_METADATA_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'graphRAGPath metadata',
  actions: [
    'capture end-to-end GraphRAG paths for the codebase index',
  ],
  outcome:
    'trace how AgenticRAG pipelines move from Canvas, through parser scripts, into a GraphRAG-ready JSON-LD index.',
});

export const GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Graph Fields',
  actions: [
    'define node and edge field metadata, JSON-LD roles, and Graph Data Table mapping',
    'sync column visibility, frozen areas, and samples with schema presets',
  ],
  outcome:
    'see docs/knowgrph-schema-document.md for AgenticRAG JSON-LD table mapping examples.',
});

export const GRAPH_DATA_TABLE_CURATION_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Graph Data Table',
  actions: [
    'curate, filter, and export node and edge records',
  ],
  outcome:
    'produce JSON (default), AgenticRAG JSON-LD, or CSV snapshots aligned with schema and codebase index.',
});

export const TOOL_MENU_SOURCE_FILES_DESCRIPTION =
  'Source Files \u2192 import or export supported formats \u2192 keep Markdown, HTML, PDF, JSON-LD, and JSON ingest paths consistent without hardcoding dataset-specific rules.';

export const TOOL_MENU_VALIDATION_DESCRIPTION =
  'Validation \u2192 export graph-wide and selection-only validation reports \u2192 keep JSON and Markdown summaries aligned with AgenticRAG schema and Graph Data Table curation.';

export const TOOL_MENU_PARSER_DESCRIPTION =
  'Parser \u2192 manage parser scripts and custom configurations \u2192 keep AgenticRAG graph ingestion paths versioned so CSV, JSON, and JSON-LD inputs map cleanly into schema-aligned GraphData.';

export const TOOL_MENU_SCHEMA_CONFIG_DESCRIPTION =
  'Schema Configurator (Graph Fields) \u2192 define generic node/edge types, validation rules, and visualization presets \u2192 ensure GraphData, AgenticRAG Node/Edge schema, and Graph Fields stay aligned for ingest, traversal, and export.';

export const TOOL_MENU_GRAPH_FIELDS_DESCRIPTION =
  'Graph Fields \u2192 configure node/edge field mappings and table columns \u2192 keep Graph Data Table, schema-config, and AgenticRAG JSON-LD mapping aligned with Orchestrator traversal semantics.';

export const TOOL_MENU_RENDER_DESCRIPTION =
  'Renderer \u2192 manage 2D/3D render presets and layout configurations \u2192 store JSON-LD (default) and YAML definitions that align camera, forces, and layer opacity with AgenticRAG traversal and selection semantics.';

export const RENDERER_LAYOUT_MODE_ROW_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Renderer',
  actions: [
    'set schema.layout.mode for the active graph view',
    'switch between force, radial, and tree layouts',
  ],
  outcome: 'keep layout selection consistent across renderer panels and the toolbar',
});

export const RENDERER_LAYOUT_MODE_VALUE_TOOLTIP =
  'Default: force; Options: force, radial, tree; radial/tree switch to 2D.';

export const RENDERER_PALETTE_LIFECYCLE_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Renderer palette lifecycle roles',
  actions: [
    'map renderer:palette.nodes.idea/hypothesis/execution/pivot/alert to lifecycle buckets',
  ],
  outcome:
    'keep blue/yellow/green/orange/red colors aligned with core ideas, hypotheses, execution, pivots, and alerts.',
});

export const RENDERER_TREE_CURVE_ROW_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Renderer tree curve',
  actions: [
    'set graph.layout.tree.curve style for Tree layout',
    'choose bump, linear, or step link shapes',
  ],
  outcome: 'improve Tree layout readability in dense hierarchies',
});

export const RENDERER_TREE_CURVE_VALUE_TOOLTIP =
  'Default: bump; Options: bump, linear, step; Changes tree link shape.';

export const RENDERER_TREE_ORIENTATION_ROW_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Renderer tree orientation',
  actions: [
    'set graph.layout.tree.orientation axis',
    'render Tree layout horizontal or vertical',
  ],
  outcome: 'fit Tree layouts to panel and screen space',
});

export const RENDERER_TREE_ORIENTATION_VALUE_TOOLTIP =
  'Default: horizontal; Options: horizontal, vertical; Rotates tree layout axis.';

export const RENDERER_TREE_LINK_OPACITY_ROW_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Renderer tree link opacity',
  actions: [
    'set graph.layout.tree.linkOpacity',
    'tune link visibility against node and label density',
  ],
  outcome: 'keep tree edges readable without overpowering nodes',
});

export const RENDERER_TREE_LINK_OPACITY_VALUE_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.4,
  min: 0,
  max: 1,
  interval: 0.05,
  impact: 'Higher increases link prominence.',
});

export const TOOL_MENU_SETTINGS_DESCRIPTION =
  'Settings \u2192 manage workspace-level presets and defaults \u2192 store JSON-LD (default) and YAML configuration for canvas UI, traversal, and rendering so sessions reload with consistent AgenticRAG behavior.';

export const TOOL_MENU_HISTORY_DESCRIPTION =
  'History \u2192 manage snapshots of GraphData and schema state \u2192 import or export AgenticRAG JSON-LD history files that capture curated graph states, schema presets, and traversal workflows for later comparison or rollback.';

export const AGENTIC_RAG_PARSER_DESCRIPTION =
  'Parser \u2192 map CSV, JSON, or JSON-LD into AgenticRAG graph JSON-LD \u2192 apply schema-aware defaults and Custom Parser configs to keep node, edge types and metadata aligned with the AgenticRAG schema and codebase index.';

export const AGENTIC_RAG_CONTEXT_AND_IGNORE_FILTERS_LABEL = 'AgenticRAG context and ignore filters';

export const WORKFLOW_STEP3_PARSER_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Parser tab',
  actions: [
    'load parser specs, apply presets, and run ingest flows',
  ],
  outcome:
    'keep CSV/JSON inputs mapped predictably into AgenticRAG GraphData.',
});

export const WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Orchestrator presets',
  actions: [
    'run Agentic GraphRAG traversal helpers from the Orchestrator tab',
  ],
  outcome:
    'keep traversal docs and behavior aligned with the Graph Traversal floating panel.',
});

export const WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Bottom panel tabs',
  actions: [
    'combine Data, Table, and Render views on GraphData',
  ],
  outcome:
    'validate, visualize, and export layouts with consistent AgenticRAG semantics.',
});

export const TRAVERSAL_PRESET_UI_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Traversal controls',
  actions: [
    'set start node, max depth, label filters, helpers, and DuckDB queries',
  ],
  outcome:
    'drive Agentic GraphRAG traversals from the renderer.',
});

export const HELP_CHEATSHEET_ALIGNMENT_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Canvas cheatsheet',
  actions: [
    'pair selection and creation modes with bottom panel behavior',
  ],
  outcome:
    'keep Orchestrator traversal and AgenticRAG node inspector aligned with current Canvas focus.',
});

export const RENDER_TRAVERSAL_BUTTON_LABEL_GRAPH_RAG =
  'Agentic GraphRAG path (graphRAGPath.traverse)';

export const HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Markdown pipeline entry points',
  actions: [
    'copy or show the markdown-to-graph pipeline command',
  ],
  outcome:
    'run the markdown \u2192 JSON-LD graph and schema pipeline from your terminal.',
});

export const LAUNCH_SPOTLIGHT_TOUR_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Launch Spotlight tour',
  actions: [
    'guide users through parser, data, schema, and render tabs',
    'track prerequisites like dataset load, schema apply, and traversal run',
  ],
  outcome:
    'keep onboarding aligned with AgenticRAG GraphRAG workflow stages in the bottom panel.',
});

export const WORKFLOW_TAB_HEADER_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Workflow tab',
  actions: [
    'organize the 8-step AgenticRAG graph pipeline across parser, schema, curation, orchestrator, and render stages',
    'anchor bottom panel tabs and exports to the same rag:GraphRAGWorkflow JSON-LD document',
  ],
  outcome:
    'keep step ordering and workflow JSON-LD exports reproducible across AgenticRAG runs.',
});

export const HELP_TAB_HEADER_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Help tab',
  actions: [
    'surface shortcuts, canvas behavior, panel tours, and workflow links for the workspace',
    'connect Workflow, Graph Fields, Parser, Schema, and Orchestrator views when navigating AgenticRAG presets and graph views',
  ],
  outcome:
    'keep panel usage aligned with GraphRAG workflow stages and AgenticRAG graph navigation.',
});

export const SETTINGS_TAB_HEADER_TOOLTIP = buildRoleActionOutcomeTooltip({
  role: 'Settings tab',
  actions: [
    'centralize AgenticRAG presets, layout, canvas interaction, and renderer defaults',
    'share UI settings and traversal tuning across Parser, Orchestrator, and Render tabs',
  ],
  outcome:
    'keep AgenticRAG graph navigation, rendering, and panel behavior consistent across sessions.',
});

export const PANEL_TOUR_GRAPH_DATA_TABLE_LOCATION =
  'The canvas UI is organized into the toolbar, main panel, and bottom panel so that data curation, schema design, and workflow exports stay in sync. The Graph Data Table lives in the bottom panel Curation tab as the spreadsheet-like view of nodes and edges.';

export const GRAPH_FIELDS_ICON_LEGEND_REUSE_TEXT =
  'Node/edge tooltip field-type icons reuse this legend: hover badges in the canvas show the same type glyphs based on schema property types and follow the same UI Density: Icons setting.';

export const GRAPH_FIELDS_HIDDEN_TOGGLE_TOOLTIP_TEXT =
  'Directive: Toggle · Subject: Graph Data Table visibility · Verb: controls · Object: whether this field appears as a column while remaining available to AgenticRAG pipelines.';

import { readEnvString } from '../config.env';

export const GRAPH_FIELDS_DESCRIPTION_TOOLTIP_TEXT =
  'Directive: Document · Subject: field meaning · Verb: describes · Object: how this field maps to AgenticRAG JSON-LD so agents, schema docs, and Graph Data Table share a consistent interpretation.';

export const AGENTIC_GRAPHRAG_PIPELINE_DESCRIPTION =
  'Agentic GraphRAG pipeline \u2192 align Workflow, Orchestrator, Renderer, and codebase index traversals with a shared rag:GraphRAGWorkflow JSON-LD document \u2192 keep graphRAGPath metadata, context IRIs, and traversal rules consistent across UI and offline pipelines.';

const MARKDOWN_PIPELINE_INPUT_REL_PATH = readEnvString(
  'VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH',
  'docs/knowgrph-pipeline-document.md',
);

export const CODEBASE_INDEX_PIPELINE_OUTPUT_DIR = readEnvString(
  'VITE_MARKDOWN_PIPELINE_OUTPUT_DIR',
  'data/knowgrph-workflow-preview',
);

const MARKDOWN_PIPELINE_BASENAME = readEnvString(
  'VITE_MARKDOWN_PIPELINE_BASENAME',
  'knowgrph-pipeline-document',
);

function buildMarkdownPipelineCommand(inputRelPath: string, outputDirRelPath: string): string {
  const input = inputRelPath.trim();
  const outputDir = outputDirRelPath.trim();
  return `python -m knowgrph_parser markdown --input ${input} --output-dir ${outputDir}`;
}

export const CODEBASE_INDEX_PIPELINE_COMMAND = buildMarkdownPipelineCommand(
  MARKDOWN_PIPELINE_INPUT_REL_PATH,
  CODEBASE_INDEX_PIPELINE_OUTPUT_DIR,
);

export const CODEBASE_INDEX_PIPELINE_GRAPH_REL_PATH = `${CODEBASE_INDEX_PIPELINE_OUTPUT_DIR}/${MARKDOWN_PIPELINE_BASENAME}-graph-data.jsonld`;

export const CODEBASE_INDEX_PIPELINE_SCHEMA_REL_PATH = `${CODEBASE_INDEX_PIPELINE_OUTPUT_DIR}/${MARKDOWN_PIPELINE_BASENAME}-schema-config.jsonld`;

export const CODEBASE_INDEX_PIPELINE_ORCHESTRATOR_REL_PATH = `${CODEBASE_INDEX_PIPELINE_OUTPUT_DIR}/${MARKDOWN_PIPELINE_BASENAME}-orchestrator-config.yaml`;

export const HELP_PIPELINE_COMMAND_TEXT = CODEBASE_INDEX_PIPELINE_COMMAND;

export const PIPELINE_COMMAND_COPIED_STATUS_TEXT = 'Copied markdown pipeline command to clipboard';

export const PIPELINE_COMMAND_FALLBACK_STATUS_TEXT = `Run markdown pipeline in terminal: ${HELP_PIPELINE_COMMAND_TEXT}`;

export const PIPELINE_COMMAND_RUNNING_STATUS_TEXT =
  'Running markdown pipeline and loading markdown graph, schema, and workflow outputs\u2026';

export const PIPELINE_COMMAND_LOADED_STATUS_TEXT =
  'Loaded markdown graph, schema, and workflow from markdown pipeline outputs.';

export const DATASET_EMPTY_TEXT = 'No dataset loaded.';

export const NODE_EDITOR_EMPTY_TEXT = 'Select a node to edit its properties.';

export const PARSER_JSONLD_EDGE_MAPPING_PIPELINE_DESCRIPTION =
  'Load into GraphData \u2192 JSON-LD \u2192 Graph edges/@id \u2192 Orchestrator. Checked relations become allowedRelations in the generated GraphRAG workflow JSON-LD.';

export const AGENTIC_RAG_SCHEMA_LABEL = 'AgenticRAG schema:';

export const AGENTIC_RAG_CONTEXT_LABEL = 'AgenticRAG context:';

export const AGENTIC_RAG_DATASET_CONTEXT_VOCAB_LABEL = 'Dataset context/vocab:';

export const GRAPHRAG_PATH_IRI_LABEL = 'graphRAGPath IRI:';

export const AGENTIC_RAG_PATH_EDITOR_INTRO_TEXT =
  'Agentic GraphRAG path metadata for the current graph or selected node.';

export const AGENTIC_RAG_PATH_LEGEND_EMPTY_TEXT = 'No AgenticRAG paths detected.';

export const AGENTIC_RAG_PATH_LEGEND_TRAVERSE_TEXT =
  'Active AgenticRAG path: traverse (query + multi-hop path over node ids).';

export const AGENTIC_RAG_PATH_LEGEND_EXAMPLE_TEXT =
  'Active AgenticRAG path: example (hops[] describing narrative reasoning steps).';

export const AGENTIC_RAG_PATH_LEGEND_MIXED_TEXT =
  'Active AgenticRAG path: mixed (both traverse[] node ids and hops[] narrative steps).';

export const AGENTIC_RAG_PATH_LEGEND_PARSE_ERROR_TEXT =
  'AgenticRAG path metadata is present but could not be parsed for legend.';

export const GRAPHRAG_PATH_TRAVERSAL_METADATA_MISSING_TEXT =
  'No graphRAGPath traversal metadata found on this graph.';

export const RUN_CODEBASE_INDEX_PIPELINE_LABEL = 'Run markdown pipeline';

export const AGENTIC_RAG_NODE_JSON_COPY_LABEL = 'Copy AgenticRAG node JSON';

export const AGENTIC_RAG_NODE_JSON_STATUS_NONE = 'No AgenticRAG node selected';

export const AGENTIC_RAG_NODE_JSON_STATUS_COPIED = 'AgenticRAG node JSON copied';
