import React from 'react'
import { createRoot } from 'react-dom/client'
import McpHubView from '@/features/panels/views/McpHubView'
import { feishuBaseMcpSettingsRegistry } from '@/features/settings/registry-feishu-base-mcp'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import { assertMcpHubSurfacesFeishuBaseMcpConfig } from '@/__tests__/helpers/mainPanelMcpExpectations'
import {
  FEISHU_BASE_MCP_DEFAULT_AUTH_BOUNDARY,
  FEISHU_BASE_MCP_DEFAULT_CONNECTION_MODE,
  FEISHU_BASE_MCP_DEFAULT_PHASE,
  FEISHU_BASE_MCP_DEFAULT_SERVER_KEY,
  FEISHU_BASE_MCP_DOCS_URL,
  FEISHU_BASE_MCP_OPERATOR_GUIDANCE,
  FEISHU_BASE_MCP_PHASE_2_STATUS,
  FEISHU_BASE_MCP_PHASE_3_STATUS,
  FEISHU_BASE_MCP_PHASE_SCOPE,
  FEISHU_BASE_MCP_SKILL_ROUTE,
  FEISHU_BASE_MCP_TROUBLESHOOTING,
} from 'grph-shared/search/feishuBaseMcpSsot'

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

export async function testMcpHubSurfacesFeishuBaseMcpConfig() {
  await withRenderedMcpHub(assertMcpHubSurfacesFeishuBaseMcpConfig)
}

export function testFeishuBaseMcpRegistryDefaultsStayNonSecretAndPhaseOneOnly() {
  const keys = feishuBaseMcpSettingsRegistry.map(setting => setting.key)
  const defaults = feishuBaseMcpSettingsRegistry.map(setting => String(setting.default?.() ?? ''))
  const combined = `${keys.join('\n')}\n${defaults.join('\n')}\n${FEISHU_BASE_MCP_OPERATOR_GUIDANCE}\n${FEISHU_BASE_MCP_PHASE_SCOPE}\n${FEISHU_BASE_MCP_TROUBLESHOOTING}`

  ;[
    'search.feishuBase.mcp.serverKey',
    'search.feishuBase.mcp.connectionMode',
    'search.feishuBase.mcp.authBoundary',
    'search.feishuBase.mcp.docsUrl',
    'search.feishuBase.mcp.phase',
    'search.feishuBase.mcp.phase2Status',
    'search.feishuBase.mcp.phase3Status',
    FEISHU_BASE_MCP_DEFAULT_SERVER_KEY,
    FEISHU_BASE_MCP_DEFAULT_CONNECTION_MODE,
    FEISHU_BASE_MCP_DEFAULT_AUTH_BOUNDARY,
    FEISHU_BASE_MCP_DOCS_URL,
    FEISHU_BASE_MCP_DEFAULT_PHASE,
    FEISHU_BASE_MCP_PHASE_2_STATUS,
    FEISHU_BASE_MCP_PHASE_3_STATUS,
    FEISHU_BASE_MCP_SKILL_ROUTE,
  ].forEach(token => {
    if (!combined.includes(token)) {
      throw new Error(`expected Feishu Base MCP registry defaults to include ${JSON.stringify(token)}, got ${JSON.stringify(combined)}`)
    }
  })

  ;[
    'tenant_access_token',
    'app_secret',
    'access_token',
    'write-back-ready',
    'source-adapter-ready',
  ].forEach(token => {
    if (combined.includes(token)) {
      throw new Error(`expected Feishu Base MCP Phase 1 defaults to avoid ${JSON.stringify(token)}, got ${JSON.stringify(combined)}`)
    }
  })
}
