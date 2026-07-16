import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'

import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { StoryboardCardOutputEditSurface, StoryboardCardTextEditSurface } from '@/components/StoryboardWidgetCanvas/StoryboardCardTextEditSurface'
import { buildStoryboardCardTextModel } from '@/components/StoryboardWidgetCanvas/storyboardCardTextModel'
import type { GraphNodeCardTextFieldSpec } from '@/lib/cards/graphNodeCardFields'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { waitForFrames } from '@/tests/lib/reactRootHarness'

const buildProbeTreeCard = (): StoryboardCardModel => ({
  id: 'probe-option',
  title: 'Which evidence confirms the current facts?',
  summary: 'Which evidence confirms the current facts?',
  output: '',
  lane: 'Probe',
  lanePropertyKey: 'lane',
  typeLabel: 'Probe-Tree Card',
  indexLabel: 'P1',
  slugline: '',
  action: 'Verify a source-backed answer.',
  dialogue: '',
  prompt: '/knowgrph.probe-tree',
  style: '',
  tags: ['probe-tree'],
  meta: [],
  invocationTokens: [],
  sourceModelLabel: '',
  sourcePromptLabel: '',
  href: '',
  media: null,
  references: [],
  order: 1,
  inputIndex: 0,
  candidateScore: 1,
  structural: false,
})

export async function testStoryboardProbeTreeOutputReplacesMediaSlotWithEditableViewer() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const card = buildProbeTreeCard()
  const textModel = buildStoryboardCardTextModel(card)
  const blankTextModel = buildStoryboardCardTextModel({ ...card, summary: '', output: '' })
  if (blankTextModel.primaryField.id !== 'summary' || blankTextModel.secondaryField?.id !== 'output' || !blankTextModel.secondaryEditable) {
    throw new Error(`expected a newly dropped Probe-Tree Type 1 layout to expose Summary and Output before text is authored, got ${JSON.stringify(blankTextModel)}`)
  }
  const commits: Array<{ field: GraphNodeCardTextFieldSpec; value: string }> = []
  try {
    await act(async () => {
      root.render(
        <section className="grid grid-cols-2">
          <StoryboardCardTextEditSurface
            card={card}
            textModel={textModel}
            projectedMediaAttachments={null}
            storyboardCommandContextText=""
            onActivate={() => void 0}
            onCommitLane={() => void 0}
            onCommitText={(_card, field, value) => commits.push({ field, value })}
            onCommitType={() => void 0}
            onMediaCommandSelect={() => void 0}
          />
          <StoryboardCardOutputEditSurface
            card={card}
            textModel={textModel}
            onActivate={() => void 0}
            onCommitText={(_card, field, value) => commits.push({ field, value })}
          />
        </section>,
      )
      await waitForFrames(dom.window, 4)
    })
    const summaryFrame = container.querySelector('[data-kg-storyboard-card-summary-scroll="1"]')
    const outputPane = container.querySelector('[data-kg-storyboard-card-output-pane="1"]')
    const outputDisplay = container.querySelector('[aria-label="Output for probe-option"][data-kg-card-inline-edit="1"]')
    if (summaryFrame?.getAttribute('data-kg-storyboard-card-active-text-field') !== 'summary' || !(outputPane instanceof dom.window.HTMLElement) || !(outputDisplay instanceof dom.window.HTMLElement)) {
      throw new Error(`expected Summary plus a dedicated right-hand Add output pane, html=${container.innerHTML}`)
    }
    await act(async () => {
      Simulate.pointerDown(outputDisplay)
      await waitForFrames(dom.window, 8)
    })
    const outputEditor = container.querySelector('[aria-label="Output for probe-option"][data-kg-card-inline-viewer-edit-surface="1"][contenteditable="true"]')
    const activeFrame = container.querySelector('[data-kg-storyboard-card-summary-scroll="1"]')
    const editors = container.querySelectorAll('[data-kg-card-inline-viewer-edit-surface="1"][contenteditable="true"]')
    if (!(outputEditor instanceof dom.window.HTMLElement) || editors.length !== 1) {
      throw new Error(`expected the right-hand Add output pane to reuse one Viewer editor, html=${container.innerHTML}`)
    }
    if (activeFrame?.getAttribute('data-kg-storyboard-card-active-text-field') !== 'summary' || outputPane.querySelector('[data-kg-storyboard-card-active-text-field="output"]') == null) {
      throw new Error(`expected Summary to remain visible while the replacement media pane owns Output editing, html=${container.innerHTML}`)
    }
    if (!container.querySelector('[aria-label="Summary for probe-option"]') || container.querySelector('[data-kg-storyboard-card-secondary-edit-trigger="1"]')) {
      throw new Error(`expected Summary to stay mounted with no compact duplicate Output trigger, html=${container.innerHTML}`)
    }
    await act(async () => {
      outputEditor.textContent = 'Source-backed answer.'
      Simulate.input(outputEditor)
      Simulate.keyDown(outputEditor, { key: 'Enter', metaKey: true })
      await waitForFrames(dom.window, 6)
    })
    const lastCommit = commits.at(-1)
    if (lastCommit?.field.id !== 'output' || lastCommit.value !== 'Source-backed answer.') {
      throw new Error(`expected the shared Viewer to mutate canonical Output, got ${JSON.stringify(lastCommit)}`)
    }
    if (!container.querySelector('[aria-label="Summary for probe-option"]') || !container.querySelector('[data-kg-storyboard-card-output-pane="1"]')) {
      throw new Error(`expected committed Output to retain the two-column Summary and Output layout, html=${container.innerHTML}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
