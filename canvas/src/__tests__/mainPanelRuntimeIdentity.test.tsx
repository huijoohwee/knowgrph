import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { CrossDeviceIdentitySettingsRowsContent } from '@/features/panels/views/CrossDeviceIdentitySettingsRows'
import type { KnowgrphRuntimeIdentity } from '@/features/runtime-identity/knowgrphRuntimeIdentity'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'

export async function testMainPanelSettingsOwnsGlobalCrossDeviceIdentityGate() {
  const settingsViewSource = readFileSync(resolve(process.cwd(), 'src/features/panels/views/SettingsView.tsx'), 'utf8')
  const skillsCommandsSource = readFileSync(resolve(process.cwd(), 'src/features/panels/views/SkillsCommandsView.tsx'), 'utf8')
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
  const settingsRowsSource = readFileSync(resolve(process.cwd(), 'src/features/panels/views/CrossDeviceIdentitySettingsRows.tsx'), 'utf8')
  if (
    !settingsViewSource.includes("area: CROSS_DEVICE_IDENTITY_SETTINGS_AREA")
    || !settingsViewSource.includes("return <CrossDeviceIdentitySettingsRows />")
    || settingsViewSource.includes('<KnowgrphRuntimeIdentityGate />')
  ) {
    throw new Error('Expected Cross-device Identity Gate to be a normal MainPanel Settings section')
  }
  if (
    !appSource.includes('<KnowgrphRuntimeIdentityRuntime />')
    || !settingsRowsSource.includes('useKnowgrphRuntimeIdentity()')
    || settingsRowsSource.includes('useAgenticOsRemoteGrammarCatalog')
    || !settingsRowsSource.includes('<KeyTypeValueStaticRow')
  ) {
    throw new Error('Expected app-global canonical identity ownership with a KTV-only Settings projection')
  }
  if (skillsCommandsSource.includes('KnowgrphRuntimeIdentityGate') || skillsCommandsSource.includes('RuntimeIdentityPanel')) {
    throw new Error('Expected Skills & Commands to contain no runtime identity surface')
  }

  const identity: KnowgrphRuntimeIdentity = {
    schema: 'knowgrph-runtime-identity/v1',
    device: 'test-device',
    branch: 'main',
    knowgrphRevision: 'b'.repeat(40),
    agenticCanvasOsRevision: 'a'.repeat(40),
    catalogRevision: 'a'.repeat(40),
    catalogHydration: { status: 'fresh', attempts: 1 },
    catalogCounts: { slash: 78, hash: 94, at: 95 },
  }
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  try {
    await mountReactRoot(root, React.createElement(CrossDeviceIdentitySettingsRowsContent, { identity }), {
      window: dom.window as unknown as Window,
      frames: 2,
    })
    const gate = container.querySelector('[data-kg-main-panel-settings-runtime-identity="1"]')
    if (
      !gate
      || gate.getAttribute('data-kg-runtime-identity-surface') !== 'main-panel-settings'
    ) {
      throw new Error('Expected MainPanel Settings to render the global cross-device identity gate contract')
    }
    const counts = container.querySelector('[data-kg-runtime-catalog-counts="78/94/95"]')
    const buttons = Array.from<HTMLButtonElement>(container.querySelectorAll('button')).map(button => button.textContent?.trim())
    if (!counts || !buttons.includes('Refresh identity catalog') || !buttons.includes('Copy identity JSON')) {
      throw new Error('Expected the identity gate to expose counts, bounded refresh, and JSON export')
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
