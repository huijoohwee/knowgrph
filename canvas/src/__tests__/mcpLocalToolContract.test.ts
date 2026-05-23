import path from 'node:path'
import { pathToFileURL } from 'node:url'

type LocalToolContractModule = {
  KNOWGRPH_LOCAL_MCP_TOOL_NAMES: Record<string, string>
  buildKnowgrphLocalMcpToolDefinitions: (args?: {
    defaultUiHost?: string
    defaultUiPort?: number
  }) => Array<{
    name: string
    description: string
    inputSchema: {
      additionalProperties?: boolean
      properties?: Record<string, { description?: string }>
    }
  }>
}

const importLocalToolContract = async (): Promise<LocalToolContractModule> => {
  const contractUrl = pathToFileURL(path.resolve(process.cwd(), '..', 'mcp', 'local-tool-contract.js')).href
  return await import(contractUrl) as LocalToolContractModule
}

export async function testKnowgrphLocalMcpToolContractStaysSharedAndStable() {
  const contract = await importLocalToolContract()
  const tools = contract.buildKnowgrphLocalMcpToolDefinitions({
    defaultUiHost: '0.0.0.0',
    defaultUiPort: 4173,
  })
  const toolNames = tools.map(tool => tool.name)
  const expectedNames = [
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiLaunch,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiStop,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.pipeline,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.graphragPipeline,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.superagentRun,
    contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.browserApiRun,
  ]

  if (JSON.stringify(toolNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`expected stable local MCP tool order, got ${JSON.stringify(toolNames)}`)
  }

  if (new Set(toolNames).size !== toolNames.length) {
    throw new Error(`expected unique local MCP tool names, got ${JSON.stringify(toolNames)}`)
  }

  for (const tool of tools) {
    if (tool.inputSchema?.additionalProperties !== false) {
      throw new Error(`expected additionalProperties=false for ${tool.name}`)
    }
  }

  const launchTool = tools.find(tool => tool.name === contract.KNOWGRPH_LOCAL_MCP_TOOL_NAMES.uiLaunch)
  if (!launchTool) {
    throw new Error('expected knowgrph.ui.launch tool definition')
  }
  const hostDescription = String(launchTool.inputSchema.properties?.host?.description || '')
  const portDescription = String(launchTool.inputSchema.properties?.port?.description || '')
  if (!hostDescription.includes('0.0.0.0')) {
    throw new Error(`expected UI launch host description to reflect injected default host, got ${JSON.stringify(hostDescription)}`)
  }
  if (!portDescription.includes('4173')) {
    throw new Error(`expected UI launch port description to reflect injected default port, got ${JSON.stringify(portDescription)}`)
  }
}
