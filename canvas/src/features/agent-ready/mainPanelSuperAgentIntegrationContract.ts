import {
  CHAT_PROVIDER_AGNES,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_GOOGLE_CLOUD,
  CHAT_PROVIDER_MIROMIND,
  CHAT_PROVIDER_OPENAI,
  CHAT_PROVIDER_QWEN,
  getChatProviderLabel,
} from '@/lib/chatEndpoint'

export const KNOWGRPH_AGENT_READY_MAIN_PANEL_ENTRY_TABS = [
  'mcp',
  'integrations',
  'commerce',
] as const

export const KNOWGRPH_SUPERAGENT_MAIN_PANEL_ENTRY_TABS = [
  'integrations',
  'mcp',
] as const

export const KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_BASENAME = 'knowgrph-research-agent-demo.md'

export const KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_WORKSPACE_PATH =
  `/docs/${KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_BASENAME}` as const

export const KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_SOURCE_FILE =
  `workspace:${KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_WORKSPACE_PATH}` as const

export const KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_SHARE_URL = '/knowgrph/share/knowgrph-research-agent-demo'

export const KNOWGRPH_SUPERAGENT_MAIN_PANEL_PROVIDER_IDS = [
  CHAT_PROVIDER_OPENAI,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_AGNES,
  CHAT_PROVIDER_MIROMIND,
  CHAT_PROVIDER_QWEN,
  CHAT_PROVIDER_GOOGLE_CLOUD,
] as const

export const KNOWGRPH_SUPERAGENT_MAIN_PANEL_PROVIDER_LABELS =
  KNOWGRPH_SUPERAGENT_MAIN_PANEL_PROVIDER_IDS.map(providerId => getChatProviderLabel(providerId))

export const KNOWGRPH_SUPERAGENT_PROVIDER_NODE_IDS = {
  [CHAT_PROVIDER_OPENAI]: 'integration_openai',
  [CHAT_PROVIDER_BYTEPLUS]: 'integration_byteplus',
  [CHAT_PROVIDER_AGNES]: 'integration_agnes',
  [CHAT_PROVIDER_MIROMIND]: 'integration_miromind',
  [CHAT_PROVIDER_QWEN]: 'integration_qwen',
  [CHAT_PROVIDER_GOOGLE_CLOUD]: 'integration_google_cloud',
} as const satisfies Record<(typeof KNOWGRPH_SUPERAGENT_MAIN_PANEL_PROVIDER_IDS)[number], string>

export const KNOWGRPH_SUPERAGENT_HARNESS_NODE_ID = 'kgra_superagent_harness'

export const KNOWGRPH_SUPERAGENT_REVIEW_NODE_ID = 'review_audit'

export const KNOWGRPH_SUPERAGENT_REVIEW_EDGE_ID = 'edge_superagent_to_review'

export const KNOWGRPH_SUPERAGENT_INTEGRATION_EDGE_TYPE = 'integration_provider_signal'

export const KNOWGRPH_SUPERAGENT_RUNTIME_SURFACE_EDGE_TYPE = 'agent_runtime_surface_signal'

export const KNOWGRPH_SUPERAGENT_SUBAGENT_EDGE_TYPE = 'agent_subagent_signal'

export const KNOWGRPH_SUPERAGENT_CANVAS_RENDERER = 'flowEditor'

export const KNOWGRPH_SUPERAGENT_RICH_MEDIA_OUTPUT_NODE_IDS = [
  'panel_text_research_brief',
  'panel_image_evidence_map',
  'panel_chart_guardrails',
] as const

export const KNOWGRPH_SUPERAGENT_RUNTIME_SURFACE_KEYS = [
  'message_gateway',
  'sandbox',
  'memory',
  'tools',
  'skills',
  'subagents',
] as const

export const KNOWGRPH_SUPERAGENT_RUNTIME_SURFACE_NODE_TYPE = 'runtime_surface'

export const KNOWGRPH_SUPERAGENT_RUNTIME_SURFACE_NODE_IDS = {
  message_gateway: 'kgra_runtime_message_gateway',
  sandbox: 'kgra_runtime_sandbox',
  memory: 'kgra_runtime_memory',
  tools: 'kgra_runtime_tools',
  skills: 'kgra_runtime_skills',
  subagents: 'kgra_runtime_subagents',
} as const satisfies Record<(typeof KNOWGRPH_SUPERAGENT_RUNTIME_SURFACE_KEYS)[number], string>

export const KNOWGRPH_SUPERAGENT_SUBAGENT_NODE_TYPE = 'subagent'

export const KNOWGRPH_SUPERAGENT_SUBAGENT_IDS = [
  'source_scout',
  'thesis_compiler',
  'code_worker',
  'artifact_builder',
  'review_gate',
] as const

export const KNOWGRPH_SUPERAGENT_SUBAGENT_NODE_IDS = {
  source_scout: 'kgra_subagent_source_scout',
  thesis_compiler: 'kgra_subagent_thesis_compiler',
  code_worker: 'kgra_subagent_code_worker',
  artifact_builder: 'kgra_subagent_artifact_builder',
  review_gate: 'kgra_subagent_review_gate',
} as const satisfies Record<(typeof KNOWGRPH_SUPERAGENT_SUBAGENT_IDS)[number], string>

export const KNOWGRPH_SUPERAGENT_TASK_CAPABILITIES = [
  'research',
  'code',
  'create',
] as const

export const KNOWGRPH_SUPERAGENT_TASK_LEVELS = [
  'quick_triage',
  'bounded_compile',
  'deep_research',
  'parallel_build',
] as const
