import React from 'react'
import { createRoot } from 'react-dom/client'
import McpHubView from '@/features/panels/views/McpHubView'
import {
  CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL,
  CLOUDFLARE_AI_GATEWAY_MCP_SERVER_KEY,
  CLOUDFLARE_AI_GATEWAY_MCP_TOOL_NAMES,
  buildCloudflareAiGatewayMcpReadinessManifestJson,
  buildCloudflareAiGatewayMcpRemoteConfigJson,
} from '@/features/panels/views/cloudflareAiGatewayMcpApiDocs'
import { assertMcpHubSurfacesCloudflareAiGatewayMcpConfig } from '@/__tests__/helpers/mainPanelMcpExpectations'
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

    const doc = dom.window.document
    const container = doc.createElement('section')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(root, React.createElement(McpHubView), { window: dom.window, frames: 4 })

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

const assertNoSecretOrAccountMaterial = (text: string): void => {
  ;[
    'CLOUDFLARE_API_TOKEN=',
    'Authorization: Bearer',
    'YOUR_CLOUDFLARE_API_TOKEN',
    'YOUR_OPENAI_API_KEY',
    'sk-',
    '170e89fdb8679ff2fcc2900e25ed04f4',
  ].forEach(token => {
    if (text.includes(token)) {
      throw new Error(`expected Cloudflare AI Gateway MCP config to omit secret/account token ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    }
  })
}

export async function testMcpHubSurfacesCloudflareAiGatewayMcpConfig() {
  await withRenderedMcpHub(assertMcpHubSurfacesCloudflareAiGatewayMcpConfig)
}

export function testCloudflareAiGatewayMcpGeneratedConfigIsRemoteAndNonSecret() {
  const configText = buildCloudflareAiGatewayMcpRemoteConfigJson()
  const parsed = JSON.parse(configText) as {
    mcpServers?: Record<string, { command?: string; args?: string[] }>
  }
  const config = parsed.mcpServers?.[CLOUDFLARE_AI_GATEWAY_MCP_SERVER_KEY]

  if (config?.command !== 'npx') {
    throw new Error(`expected Cloudflare AI Gateway MCP config to use npx mcp-remote, got ${JSON.stringify(config)}`)
  }
  if (JSON.stringify(config?.args) !== JSON.stringify(['mcp-remote', CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL])) {
    throw new Error(`expected Cloudflare AI Gateway MCP remote URL ${CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL}, got ${JSON.stringify(config)}`)
  }
  assertNoSecretOrAccountMaterial(configText)
}

export function testCloudflareAiGatewayMcpReadinessManifestListsCurrentToolsAndBoundaries() {
  const manifestText = buildCloudflareAiGatewayMcpReadinessManifestJson()
  const parsed = JSON.parse(manifestText) as {
    cloudflareAiGatewayMcp?: {
      mcpServer?: { tools?: string[]; remoteUrl?: string; transport?: string }
      boundaries?: {
        devOnlyUntilOperatorDeploys?: boolean
        browserStoresCloudflareTokens?: boolean
        providerKeysRemainHostOwned?: boolean
      }
    }
  }
  const server = parsed.cloudflareAiGatewayMcp?.mcpServer
  const boundaries = parsed.cloudflareAiGatewayMcp?.boundaries

  if (server?.remoteUrl !== CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL || server?.transport !== 'streamable-http') {
    throw new Error(`expected readiness manifest to declare Cloudflare AI Gateway MCP streamable-http URL, got ${JSON.stringify(server)}`)
  }
  if (JSON.stringify(server?.tools) !== JSON.stringify(CLOUDFLARE_AI_GATEWAY_MCP_TOOL_NAMES)) {
    throw new Error(`expected readiness manifest to list current AI Gateway MCP tools, got ${JSON.stringify(server?.tools)}`)
  }
  if (
    boundaries?.devOnlyUntilOperatorDeploys !== true
    || boundaries.browserStoresCloudflareTokens !== false
    || boundaries.providerKeysRemainHostOwned !== true
  ) {
    throw new Error(`expected readiness manifest to keep dev-only and secret-boundary flags, got ${JSON.stringify(boundaries)}`)
  }
  assertNoSecretOrAccountMaterial(manifestText)
}
