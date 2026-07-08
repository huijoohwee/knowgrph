import React from 'react'
import { createRoot } from 'react-dom/client'
import McpHubView from '@/features/panels/views/McpHubView'
import {
  KNOWGRPH_TOOL_SERVER_DOC_ENTRIES,
  KNOWGRPH_TOOL_SERVER_KEY,
  KNOWGRPH_TOOL_SERVER_LOCAL_CONFIG_KEY,
  KNOWGRPH_TOOL_SERVER_PAGES_CONFIG_KEY,
  buildKnowgrphToolServerLocalStdioConfigJson,
  buildKnowgrphToolServerPagesHttpConfigJson,
  getKnowgrphToolServerRowAnchorId,
} from '@/features/panels/views/knowgrphToolServerDocs'
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
      React.createElement(McpHubView, { searchQuery: 'knowgrphToolServer' } as never),
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

const assertNoSecretOrLiveDeployMaterial = (text: string): void => {
  ;[
    'YOUR_API_KEY',
    'your_api_key',
    'sk-',
    'ghp_',
    'airvio.co',
    'optional-mcps',
    '~/.hermes',
    'mcp_servers:',
  ].forEach(token => {
    if (text.toLowerCase().includes(token.toLowerCase())) {
      throw new Error(`expected Knowgrph tool-server config to omit secret/live/copy token ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    }
  })
}

export async function testMcpHubSurfacesKnowgrphToolServerRows() {
  await withRenderedMcpHub(container => {
    const text = container.textContent || ''
    ;[
      'Knowgrph Tool Servers',
      'knowgrphToolServer.server.role',
      'knowgrphToolServer.surface.local_stdio',
      'knowgrphToolServer.surface.pages_http_readonly',
      'knowgrphToolServer.tool.groups',
      'knowgrphToolServer.config.local_stdio',
      'knowgrphToolServer.config.pages_http_readonly',
      '<ABS_PATH_TO_KNOWGRPH>',
      '<knowgrph-origin>',
      'KNOWGRPH_ROOT',
      'KNOWGRPH_PYTHON',
    ].forEach(token => {
      if (!text.includes(token)) throw new Error(`expected Knowgrph tool-server hub row ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    })
    if (!getKnowgrphToolServerRowAnchorId('knowgrphToolServer.config.local_stdio').startsWith('mcp-row-knowgrph-tool-server-')) {
      throw new Error('Knowgrph tool-server anchors must use the Knowgrph tool-server namespace')
    }
    assertNoSecretOrLiveDeployMaterial(text)
  })
}

export function testKnowgrphToolServerGeneratedConfigsStayPlaceholderOnly() {
  const localText = buildKnowgrphToolServerLocalStdioConfigJson()
  const pagesText = buildKnowgrphToolServerPagesHttpConfigJson()
  const local = JSON.parse(localText) as { mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }> }
  const pages = JSON.parse(pagesText) as { mcpServers?: Record<string, { type?: string; url?: string; tools?: { include?: string[] } }> }

  const localServer = local.mcpServers?.[KNOWGRPH_TOOL_SERVER_KEY]
  if (localServer?.command !== 'node') {
    throw new Error(`expected local Knowgrph MCP to launch through node, got ${JSON.stringify(local)}`)
  }
  if (JSON.stringify(localServer?.args) !== JSON.stringify(['<ABS_PATH_TO_KNOWGRPH>/mcp/server.js'])) {
    throw new Error(`expected local Knowgrph MCP server path placeholder, got ${JSON.stringify(local)}`)
  }
  if (localServer?.env?.KNOWGRPH_ROOT !== '<ABS_PATH_TO_KNOWGRPH>' || localServer?.env?.KNOWGRPH_PYTHON !== '<ABS_PATH_TO_PYTHON>') {
    throw new Error(`expected local Knowgrph MCP env placeholders, got ${JSON.stringify(local)}`)
  }

  const pagesServer = pages.mcpServers?.[KNOWGRPH_TOOL_SERVER_KEY]
  if (pagesServer?.type !== 'streamable-http' || pagesServer?.url !== 'https://<knowgrph-origin>/knowgrph/mcp') {
    throw new Error(`expected read-only Pages HTTP placeholder, got ${JSON.stringify(pages)}`)
  }
  if (JSON.stringify(pagesServer?.tools?.include) !== JSON.stringify(['search', 'fetch'])) {
    throw new Error(`expected Pages HTTP config to include only read-only source tools, got ${JSON.stringify(pages)}`)
  }

  assertNoSecretOrLiveDeployMaterial(`${localText}\n${pagesText}`)
}

export function testKnowgrphToolServerSsotRowsCoverInternalToolsAndBoundaries() {
  const keys = new Set(KNOWGRPH_TOOL_SERVER_DOC_ENTRIES.map(entry => entry.meta.key))
  for (const key of [
    'knowgrphToolServer.server.role',
    'knowgrphToolServer.surface.local_stdio',
    'knowgrphToolServer.surface.pages_http_readonly',
    'knowgrphToolServer.tool.groups',
    'knowgrphToolServer.selection.policy',
    'knowgrphToolServer.approval.boundary',
    'knowgrphToolServer.secrets.boundary',
    KNOWGRPH_TOOL_SERVER_LOCAL_CONFIG_KEY,
    KNOWGRPH_TOOL_SERVER_PAGES_CONFIG_KEY,
    'knowgrphToolServer.copy.boundary',
  ]) {
    if (!keys.has(key)) throw new Error(`missing Knowgrph tool-server SSOT row ${key}`)
  }

  const groupsEntry = KNOWGRPH_TOOL_SERVER_DOC_ENTRIES.find(entry => entry.meta.key === 'knowgrphToolServer.tool.groups')
  const copyEntry = KNOWGRPH_TOOL_SERVER_DOC_ENTRIES.find(entry => entry.meta.key === 'knowgrphToolServer.copy.boundary')
  const combined = `${groupsEntry?.value || ''}\n${groupsEntry?.details.responsibility || ''}\n${copyEntry?.value || ''}\n${copyEntry?.details.responsibility || ''}`
  ;[
    'published Source Files search/fetch',
    'Agentic Canvas OS dry-run planning',
    'memory layer',
    'probe tree',
    'do not copy Hermes code',
  ].forEach(token => {
    if (!combined.includes(token)) throw new Error(`expected Knowgrph tool-server contract to include ${JSON.stringify(token)}, got ${JSON.stringify(combined)}`)
  })
}
