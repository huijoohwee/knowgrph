const readViteEnvString = (key: string): string => {
  if (typeof import.meta === 'undefined') return ''
  const meta = import.meta as unknown as { env?: Record<string, unknown> }
  const env = meta.env
  const val = env && env[key]
  return typeof val === 'string' ? val : ''
}

const normalizeUrlBase = (value: string): string => value.replace(/\/+$/, '')

const agenticRagSchemaBase = normalizeUrlBase(
  readViteEnvString('VITE_AGENTIC_RAG_SCHEMA_URL') || 'https://huijoohwee.github.io/schema/AgenticRAG',
)

export const AGENTIC_RAG_SCHEMA_URL = agenticRagSchemaBase

export const AGENTIC_RAG_CONTEXT_URL = `${agenticRagSchemaBase}/v1/context.jsonld`

export const AGENTIC_RAG_NODE_SCHEMA_URL = `${agenticRagSchemaBase}/node-schema.jsonld`

export const AGENTIC_RAG_EDGE_SCHEMA_URL = `${agenticRagSchemaBase}/edge-schema.jsonld`

export const AGENTIC_RAG_GRAPH_SCHEMA_URL = `${agenticRagSchemaBase}/graph-schema.jsonld`

export const AGENTIC_RAG_GRAPH_RAG_PATH_IRI = 'https://huijoohwee.github.io/schema/AgenticRAG/v1/rag#graphRAGPath'

export const AGENTIC_RAG_NODE_TYPE_IRI = 'kg:Node'

export const AGENTIC_RAG_EDGE_TYPE_IRI = 'kg:Edge'

export const KG_PREFIX = 'kg:'
export const KG_CLASS_PREFIX = 'kg:class:'
export const KG_PROP_PREFIX = 'kg:prop:'
export const KG_NODE_TYPE_CLASS = 'kg:NodeType'
export const KG_EDGE_LABEL_CLASS = 'kg:EdgeLabel'
export const KG_PROPERTY_CLASS = 'kg:Property'
export const KG_SUBJECT = 'kg:subject'
export const KG_PREDICATE = 'kg:predicate'
export const KG_OBJECT = 'kg:object'
