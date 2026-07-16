import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { KnowgrphRuntimeIdentityPanel } from '@/features/agentic-os/KnowgrphRuntimeIdentityGate'
import type { AgenticOsRemoteGrammarSnapshot } from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'

export async function testMainPanelSettingsOwnsGlobalCrossDeviceIdentityGate() {
  const settingsViewSource = readFileSync(resolve(process.cwd(), 'src/features/panels/views/SettingsView.tsx'), 'utf8')
  const skillsCommandsSource = readFileSync(resolve(process.cwd(), 'src/features/panels/views/SkillsCommandsView.tsx'), 'utf8')
  if (
    !settingsViewSource.includes("import KnowgrphRuntimeIdentityGate from '@/features/agentic-os/KnowgrphRuntimeIdentityGate'")
    || !settingsViewSource.includes("mode === 'all' && <KnowgrphRuntimeIdentityGate />")
  ) {
    throw new Error('Expected global MainPanel Settings to own the cross-device identity gate')
  }
  if (skillsCommandsSource.includes('KnowgrphRuntimeIdentityGate') || skillsCommandsSource.includes('RuntimeIdentityPanel')) {
    throw new Error('Expected Skills & Commands to contain no runtime identity surface')
  }

  const snapshot: AgenticOsRemoteGrammarSnapshot = {
    version: 1,
    entries: [],
    sourceRevision: 'a'.repeat(40),
    hydration: { status: 'fresh', attempts: 1, error: '' },
    counts: { slash: 78, hash: 94, at: 95 },
  }
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  try {
    await mountReactRoot(root, React.createElement(KnowgrphRuntimeIdentityPanel, { snapshot }), {
      window: dom.window as unknown as Window,
      frames: 2,
    })
    const gate = container.querySelector('[data-kg-main-panel-settings-runtime-identity="1"]')
    if (
      !gate
      || gate.getAttribute('aria-label') !== 'Cross-device Identity Gate'
      || gate.getAttribute('data-kg-runtime-identity-surface') !== 'main-panel-settings'
      || gate.getAttribute('data-kg-runtime-catalog-counts') !== null
    ) {
      throw new Error('Expected MainPanel Settings to render the global cross-device identity gate contract')
    }
    const counts = gate.querySelector('[data-kg-runtime-catalog-counts="78/94/95"]')
    const buttons = Array.from<HTMLButtonElement>(gate.querySelectorAll('button')).map(button => button.textContent?.trim())
    if (!counts || !buttons.includes('Refresh identity catalog') || !buttons.includes('Copy identity JSON')) {
      throw new Error('Expected the identity gate to expose counts, bounded refresh, and JSON export')
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
