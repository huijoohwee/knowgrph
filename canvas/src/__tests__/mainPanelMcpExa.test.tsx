import React from 'react'
import { createRoot } from 'react-dom/client'
import McpHubView from '@/features/panels/views/McpHubView'
import {
  buildExaCodexMcpAddCommand,
  buildExaRemoteMcpConfigJson,
} from '@/features/panels/views/exaMcpApiDocs'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import { assertMcpHubSurfacesExaMcpConfig } from '@/__tests__/helpers/mainPanelMcpExpectations'
import {
  EXA_MCP_ALL_NON_DEPRECATED_REMOTE_URL,
  EXA_MCP_ALL_NON_DEPRECATED_TOOL_NAMES,
  EXA_MCP_DEPRECATED_TOOL_REPLACEMENTS,
  EXA_MCP_LOCAL_API_KEY_ENV,
  EXA_MCP_REMOTE_URL,
  normalizeExaMcpToolNames,
} from 'grph-shared/search/exaMcpSsot'

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
    const container = doc.createElement('div')
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

const assertNoSecretMaterial = (text: string): void => {
  ;[
    'x-api-key',
    EXA_MCP_LOCAL_API_KEY_ENV,
    'YOUR_EXA_API_KEY',
    'your_api_key',
    'exaApiKey=',
  ].forEach(token => {
    if (text.includes(token)) {
      throw new Error(`expected generated Exa MCP config to omit secret token ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    }
  })
}

const assertNoDeprecatedTools = (text: string): void => {
  Object.keys(EXA_MCP_DEPRECATED_TOOL_REPLACEMENTS).forEach(tool => {
    if (text.includes(tool)) {
      throw new Error(`expected generated Exa MCP config to omit deprecated tool ${JSON.stringify(tool)}, got ${JSON.stringify(text)}`)
    }
  })
}

export async function testMcpHubSurfacesExaMcpConfig() {
  await withRenderedMcpHub(assertMcpHubSurfacesExaMcpConfig)
}

export function testExaMcpDefaultGeneratedConfigIsNonSecretAndHosted() {
  const codexCommand = buildExaCodexMcpAddCommand({})
  const configText = buildExaRemoteMcpConfigJson({})
  const parsed = JSON.parse(configText) as { mcpServers?: Record<string, { url?: string }> }

  if (parsed.mcpServers?.exa?.url !== EXA_MCP_REMOTE_URL) {
    throw new Error(`expected default Exa MCP URL ${EXA_MCP_REMOTE_URL}, got ${JSON.stringify(parsed)}`)
  }
  if (codexCommand !== `codex mcp add exa --url '${EXA_MCP_REMOTE_URL}'`) {
    throw new Error(`expected Codex command to use default hosted Exa MCP URL, got ${JSON.stringify(codexCommand)}`)
  }
  const combined = `${codexCommand}\n${configText}`
  assertNoSecretMaterial(combined)
  assertNoDeprecatedTools(combined)
}

export function testExaMcpAllNonDeprecatedProfileBuildsExactToolsUrl() {
  const values = {
    'search.exa.mcp.toolProfile': 'all_non_deprecated',
  }
  const configText = buildExaRemoteMcpConfigJson(values)
  const parsed = JSON.parse(configText) as { mcpServers?: Record<string, { url?: string }> }
  const url = parsed.mcpServers?.exa?.url || ''

  if (url !== EXA_MCP_ALL_NON_DEPRECATED_REMOTE_URL) {
    throw new Error(`expected all-non-deprecated Exa URL ${EXA_MCP_ALL_NON_DEPRECATED_REMOTE_URL}, got ${JSON.stringify(url)}`)
  }
  const tools = new URL(url).searchParams.get('tools')?.split(',') || []
  if (JSON.stringify(tools) !== JSON.stringify(EXA_MCP_ALL_NON_DEPRECATED_TOOL_NAMES)) {
    throw new Error(`expected exact Exa all-tools profile, got ${JSON.stringify(tools)}`)
  }
  assertNoSecretMaterial(configText)
  assertNoDeprecatedTools(configText)
}

export function testExaMcpGeneratedConfigFiltersDeprecatedTools() {
  const values = {
    'search.exa.mcp.enabledTools': JSON.stringify([
      'company_research_exa',
      'web_fetch_exa',
      'web_search_advanced_exa',
      'web_fetch_exa',
      'crawling_exa',
    ]),
  }
  const configText = buildExaRemoteMcpConfigJson(values)
  const parsed = JSON.parse(configText) as { mcpServers?: Record<string, { url?: string }> }
  const url = parsed.mcpServers?.exa?.url || ''
  const tools = new URL(url).searchParams.get('tools')?.split(',') || []
  const normalized = normalizeExaMcpToolNames([
    'company_research_exa',
    'web_fetch_exa',
    'web_search_advanced_exa',
    'web_fetch_exa',
    'crawling_exa',
  ])

  if (JSON.stringify(tools) !== JSON.stringify(normalized)) {
    throw new Error(`expected deprecated Exa tools to be filtered from generated URL, got ${JSON.stringify(tools)}`)
  }
  assertNoSecretMaterial(configText)
  assertNoDeprecatedTools(configText)
}
