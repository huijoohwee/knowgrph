import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import RichMediaPanel, { type RichMediaPanelProps } from '@/components/RichMediaPanel'
import { RichMediaOutputVersionSelector } from '@/components/RichMediaOutputVersionSelector'
import { WidgetEditorActionsToolbar } from '@/components/StoryboardWidget/WidgetEditorActionsToolbar'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForTasks } from '@/tests/lib/reactRootHarness'

const outputVersions = [
  { id: 'version-1', createdAt: '2026-07-19T01:00:00.000Z', output: '# Version one' },
  { id: 'version-2', createdAt: '2026-07-19T02:00:00.000Z', output: '# Version two' },
]

const versionedPanel: NonNullable<RichMediaPanelProps['panel']> = {
  activeTab: 'text',
  freezeConnectedOutput: false,
  hasText: true,
  hasImage: false,
  hasVideo: false,
  hasAudio: false,
  hasPoi: false,
  text: '# Version two',
  connectedText: '',
  outputVersions,
  selectedOutputVersionId: 'version-2',
}

const resetPanelStore = () => {
  const state = useGraphStore.getState()
  state.setWorkspaceViewMode('canvas')
  state.setWorkspaceCanvasPaneOpen(false)
  state.setRichMediaPanelMode('snapshot')
  state.setInfiniteCanvasInteractionMode('static')
}

const renderVersionedPanel = async (args: {
  container: HTMLElement
  window: Window
  panelChrome?: 'storyboardWidget'
  changes: Array<{ selectedOutputVersionId?: string }>
}) => {
  const root = createRoot(args.container)
  await mountReactRoot(root, React.createElement(RichMediaPanel, {
    overlayId: 'rich-media-panel-versioned-output',
    title: 'Rich Media Panel',
    url: '',
    srcDoc: '<p>Stale latest-output snapshot.</p>',
    kind: 'iframe',
    interactive: false,
    panelChrome: args.panelChrome,
    panel: versionedPanel,
    onPanelChange: next => args.changes.push(next),
  }), { window: args.window, frames: 20 })
  return root
}

export async function testRichMediaPanelTextOutputVersionSelectorPublishesSelection() {
  const { dom, restore } = initJsdomHarness()
  try {
    resetPanelStore()
    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    const changes: Array<{ selectedOutputVersionId?: string }> = []
    const root = await renderVersionedPanel({ container, window: dom.window, changes })

    const selector = container.querySelector('select[aria-label="Output version"]') as HTMLSelectElement | null
    if (!selector || selector.value !== 'version-2' || selector.options.length !== 2) {
      throw new Error(`expected latest output version to be selected by default, html=${container.innerHTML}`)
    }
    if (selector.options[0]?.textContent !== 'Version 2 (latest)' || selector.options[1]?.textContent !== 'Version 1') {
      throw new Error(`expected newest-first version labels, got ${selector.innerHTML}`)
    }
    await act(async () => {
      selector.value = 'version-1'
      selector.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      await waitForTasks(1)
    })
    if (changes.at(-1)?.selectedOutputVersionId !== 'version-1') {
      throw new Error(`expected version selection to publish through the panel mutation owner, got ${JSON.stringify(changes)}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restore()
  }
}

export async function testRichMediaPanelTextOutputVersionSelectorUsesStoryboardChrome() {
  const { dom, restore } = initJsdomHarness()
  try {
    resetPanelStore()
    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    const changes: Array<{ selectedOutputVersionId?: string }> = []
    const root = await renderVersionedPanel({
      container,
      window: dom.window,
      panelChrome: 'storyboardWidget',
      changes,
    })

    const selectors = container.querySelectorAll('select[aria-label="Output version"]')
    const header = container.querySelector('[data-kg-rich-media-storyboard-widget-header="1"]')
    const bodyControl = container.querySelector('[data-kg-rich-media-output-version-placement="body"]')
    if (selectors.length !== 1 || !header?.contains(selectors[0]) || bodyControl) {
      throw new Error(`expected one version selector in always-mounted Storyboard chrome, html=${container.innerHTML}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restore()
  }
}

export async function testRichMediaPanelTextOutputVersionSelectorUsesBubbleToolbar() {
  const { dom, restore } = initJsdomHarness()
  try {
    resetPanelStore()
    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    const changes: Array<{ selectedOutputVersionId?: string }> = []
    const root = createRoot(container)
    await mountReactRoot(root, React.createElement(WidgetEditorActionsToolbar, {
      visible: true,
      active: true,
      iconSizeClass: 'h-3 w-3',
      iconStrokeWidth: 1.5,
      enableHandlesDisabled: true,
      convertToLoopDisabled: true,
      duplicateDisabled: false,
      actionVisibility: { run: false, clearOutput: false, updateKvEntry: false, enableHandles: false, probeTree: false, convertToLoop: false, duplicate: false, help: false, remove: false },
      outputVersionControl: React.createElement(RichMediaOutputVersionSelector, {
        panel: versionedPanel,
        onPanelChange: next => changes.push(next),
        placement: 'toolbar',
      }),
      onRun: () => undefined,
      onDuplicate: () => undefined,
      onClearOutput: () => undefined,
      onHelp: () => undefined,
      onRemove: () => undefined,
      onConvertToLoopNode: () => undefined,
    }), { window: dom.window, frames: 20 })

    const toolbar = container.querySelector('[data-kg-bubble-toolbar="1"]')
    const selector = container.querySelector('select[aria-label="Output version"]') as HTMLSelectElement | null
    const placement = container.querySelector('[data-kg-rich-media-output-version-placement="toolbar"]')
    if (!toolbar?.contains(selector) || !placement || selector?.value !== 'version-2') {
      throw new Error(`expected the output version selector inside the selected-node bubble toolbar, html=${container.innerHTML}`)
    }
    await act(async () => {
      selector.value = 'version-1'
      selector.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      await waitForTasks(1)
    })
    if (changes.at(-1)?.selectedOutputVersionId !== 'version-1') {
      throw new Error(`expected the bubble-toolbar selector to publish its version change, got ${JSON.stringify(changes)}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restore()
  }
}
