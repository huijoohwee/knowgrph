export const KNOWGRPH_AGENT_READY_TOOL_IDS = Object.freeze({
  listSourceFiles: 'list_source_files',
  readSourceFile: 'read_source_file',
  readSharedDocument: 'read_shared_document',
  inspectAgentSurface: 'inspect_agent_surface',
})

export const KNOWGRPH_AGENT_READY_WEB_MCP_NAMESPACE = 'knowgrph'

const READ_ONLY_TOOL_ANNOTATIONS = Object.freeze({ readOnlyHint: true })

export const buildKnowgrphWebMcpToolName = (
  toolName,
  namespace = KNOWGRPH_AGENT_READY_WEB_MCP_NAMESPACE,
) => `${String(namespace || '').trim()}.${String(toolName || '').trim()}`

export const buildKnowgrphAgentReadyToolContracts = (args = {}) => {
  const defaultWorkspaceId = String(args.defaultWorkspaceId || '').trim()
  return [
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles),
      title: 'List Source Files',
      description: 'List published Knowgrph Source Files.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile),
      title: 'Read Source File',
      description: 'Read published Knowgrph Editor Workspace markdown content. Defaults to the canonical docs workspace when workspaceId is omitted.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['canonicalPath'],
        properties: {
          canonicalPath: { type: 'string' },
          workspaceId: defaultWorkspaceId ? { type: 'string', default: defaultWorkspaceId } : { type: 'string' },
        },
      },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.readSharedDocument,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.readSharedDocument),
      title: 'Read Shared Document',
      description: 'Read published Knowgrph markdown content from a share token or public Knowgrph share/document URL.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          shareToken: { type: 'string' },
          shareUrl: { type: 'string' },
        },
        anyOf: [{ required: ['shareToken'] }, { required: ['shareUrl'] }],
      },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    {
      name: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface,
      webName: buildKnowgrphWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface),
      title: 'Inspect Agent Surface',
      description: 'Inspect the deployed Knowgrph agent-ready discovery surface, including health, OpenAPI, MCP, and skill metadata.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
  ]
}
