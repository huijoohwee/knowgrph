import React from 'react'
import { createRoot } from 'react-dom/client'
import McpHubView from '@/features/panels/views/McpHubView'
import {
  EXTERNAL_MCP_TOOL_SERVER_DOC_ENTRIES,
  EXTERNAL_MCP_TOOL_SERVER_HTTP_CONFIG_KEY,
  EXTERNAL_MCP_TOOL_SERVER_PLACEHOLDER_ENV,
  EXTERNAL_MCP_TOOL_SERVER_STDIO_CONFIG_KEY,
  buildExternalMcpStdioConfigJson,
  buildExternalMcpStreamableHttpConfigJson,
  getExternalMcpToolServerRowAnchorId,
} from '@/features/panels/views/externalMcpToolServerDocs'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'

const withRenderedMcpHub = async (assertions: (container: Element) => void): Promise<void> => {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    useGraphStore.getState().resetAll()

    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(
      root,
      React.createElement(McpHubView, { searchQuery: 'externalMcp' } as never),
      { window: dom.window, frames: 6 },
    )

    assertions(container)
  } finally {
    try {
      if (root) await unmountReactRoot(root, { window: dom.window })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

const assertNoSecretOrProviderMaterial = (text: string): void => {
  ;[
    'YOUR_API_KEY',
    'your_api_key',
    'sk-',
    'ghp_',
    'github',
    'linear',
    'firecrawl',
    'browserbase',
    'nous portal',
    'hermes',
  ].forEach(token => {
    if (text.toLowerCase().includes(token.toLowerCase())) {
      throw new Error(`expected external MCP template to omit secret/provider token ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    }
  })
}

export async function testMcpHubSurfacesExternalToolServerGatewayRows() {
  await withRenderedMcpHub(container => {
    const text = container.textContent || ''
    ;[
      'External MCP Tool Servers',
      'externalMcp.gateway.role',
      'externalMcp.transport.local_stdio',
      'externalMcp.transport.remote_http',
      'externalMcp.tool.bridge_ids',
      'externalMcp.config.stdio_template',
      'externalMcp.config.streamable_http_template',
      EXTERNAL_MCP_TOOL_SERVER_PLACEHOLDER_ENV,
    ].forEach(token => {
      if (!text.includes(token)) throw new Error(`expected external MCP hub row ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    })
    if (!getExternalMcpToolServerRowAnchorId('externalMcp.config.stdio_template').startsWith('mcp-row-external-tool-server-')) {
      throw new Error('external MCP anchors must use the external tool server namespace')
    }
    assertNoSecretOrProviderMaterial(text)
  })
}

export function testExternalMcpGeneratedConfigTemplatesStayGenericAndNonSecret() {
  const stdioText = buildExternalMcpStdioConfigJson()
  const httpText = buildExternalMcpStreamableHttpConfigJson()
  const stdio = JSON.parse(stdioText) as { mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }> }
  const http = JSON.parse(httpText) as { mcpServers?: Record<string, { type?: string; url?: string; headers?: Record<string, string> }> }

  const stdioServer = stdio.mcpServers?.['<server-key>']
  if (stdioServer?.command !== '<host-owned-command>') {
    throw new Error(`expected stdio template to keep host-owned command placeholder, got ${JSON.stringify(stdio)}`)
  }
  if (stdioServer?.env?.[EXTERNAL_MCP_TOOL_SERVER_PLACEHOLDER_ENV] !== `\${${EXTERNAL_MCP_TOOL_SERVER_PLACEHOLDER_ENV}}`) {
    throw new Error(`expected stdio template to use only env placeholder, got ${JSON.stringify(stdio)}`)
  }

  const httpServer = http.mcpServers?.['<server-key>']
  if (httpServer?.type !== 'streamable-http') {
    throw new Error(`expected streamable-http template, got ${JSON.stringify(http)}`)
  }
  if (httpServer?.url !== 'https://<host-owned-mcp-endpoint>/mcp') {
    throw new Error(`expected host-owned endpoint placeholder, got ${JSON.stringify(http)}`)
  }
  if (httpServer?.headers?.Authorization !== `Bearer \${${EXTERNAL_MCP_TOOL_SERVER_PLACEHOLDER_ENV}}`) {
    throw new Error(`expected Authorization placeholder, got ${JSON.stringify(http)}`)
  }

  assertNoSecretOrProviderMaterial(`${stdioText}\n${httpText}`)
}

export function testExternalMcpSsotRowsCoverDeferredDiscoveryAndBoundaries() {
  const keys = new Set(EXTERNAL_MCP_TOOL_SERVER_DOC_ENTRIES.map(entry => entry.meta.key))
  for (const key of [
    'externalMcp.gateway.role',
    'externalMcp.tool.bridge_ids',
    'externalMcp.tool.allowlist_policy',
    'externalMcp.schema.progressive_disclosure',
    'externalMcp.approval.policy',
    EXTERNAL_MCP_TOOL_SERVER_STDIO_CONFIG_KEY,
    EXTERNAL_MCP_TOOL_SERVER_HTTP_CONFIG_KEY,
    'externalMcp.secrets.boundary',
    'externalMcp.copy.boundary',
  ]) {
    if (!keys.has(key)) throw new Error(`missing external MCP SSOT row ${key}`)
  }

  const bridgeEntry = EXTERNAL_MCP_TOOL_SERVER_DOC_ENTRIES.find(entry => entry.meta.key === 'externalMcp.tool.bridge_ids')
  const boundaryEntry = EXTERNAL_MCP_TOOL_SERVER_DOC_ENTRIES.find(entry => entry.meta.key === 'externalMcp.copy.boundary')
  const combined = `${bridgeEntry?.value || ''}\n${bridgeEntry?.details.responsibility || ''}\n${boundaryEntry?.value || ''}\n${boundaryEntry?.details.responsibility || ''}`
  ;[
    'knowgrph.tool.search',
    'knowgrph.tool.describe',
    'knowgrph.tool.call',
    'Forbid copied external gateway code',
  ].forEach(token => {
    if (!combined.includes(token)) throw new Error(`expected external MCP row contract to include ${JSON.stringify(token)}, got ${JSON.stringify(combined)}`)
  })
}
