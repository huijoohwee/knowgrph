import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import FloatingPanelChat from '@/features/chat/FloatingPanelChat'
import { CHAT_SKILL_OPTIONS, DEFAULT_CHAT_SKILL_ID } from '@/features/chat/chatSkillRegistry'
import { shouldRenderFloatingChatApiKeyPrompt } from '@/features/chat/floatingPanelChat/floatingPanelChatApiKeyPrompt'
import { FloatingPanelChatFooter } from '@/features/chat/FloatingPanelChatSections'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames, waitForTasks } from '@/tests/lib/reactRootHarness'

export async function testFloatingPanelChatFooterModelSelectStaysNativeLabeledAndChangeable() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const changedModels: string[] = []

  try {
    await mountReactRoot(
      root,
      React.createElement(FloatingPanelChatFooter, {
        input: '',
        setInput: () => undefined,
        isLoading: false,
        errorText: null,
        connectivity: 'unknown',
        connectivityDetail: null,
        currentNode: null,
        modelId: 'gpt-5-nano',
        modelOptions: ['gpt-5-nano', 'gpt-5-mini', 'gpt-5'],
        onModelChanged: modelId => changedModels.push(modelId),
        skillId: DEFAULT_CHAT_SKILL_ID,
        skillOptions: CHAT_SKILL_OPTIONS,
        onSkillChanged: () => undefined,
        uiPanelTextFontClass: 'text-sm',
        uiPanelMicroLabelTextSizeClass: 'text-xs',
        isSubmitDisabled: true,
        onSubmit: event => event.preventDefault(),
        onStop: () => undefined,
      }),
      { window: dom.window as unknown as Window, frames: 2 },
    )

    const control = container.querySelector('[data-kg-chat-model-control="true"]')
    if (!control) throw new Error('expected chat model control row to expose the stable data hook')
    const modelIcon = container.querySelector('[data-kg-chat-model-icon="true"]') as HTMLElement | null
    if (!modelIcon || modelIcon.tagName !== 'SPAN' || !modelIcon.className.includes('kg-responsive-control-icon-cell')) {
      throw new Error('expected model row to render a fixed-width model icon cell when BYOK is absent')
    }

    const select = container.querySelector('[data-kg-chat-model-select="true"]') as HTMLSelectElement | null
    if (!select) throw new Error('expected chat model select to expose the stable data hook')
    if (select.disabled) throw new Error('expected chat model select to stay enabled when not loading and multiple options exist')
    if (select.getAttribute('aria-label') !== 'Model') throw new Error('expected chat model select to expose a semantic label')
    if (!select.className.includes('kg-responsive-control-inline-fill') || !select.className.includes('kg-responsive-compact-panel-field-input')) {
      throw new Error('expected chat model select to use shared fill and compact field owners')
    }

    if (container.querySelector('[data-kg-chat-api-key-toggle="true"]') || container.querySelector('[data-kg-chat-api-key-input="true"]')) {
      throw new Error('expected non-BYOK footer not to render API-key controls')
    }
    const skillControl = container.querySelector('[data-kg-chat-skill-control="true"]')
    const skillSelect = container.querySelector('[data-kg-chat-skill-select="true"]') as HTMLSelectElement | null
    if (!skillControl || !skillSelect) throw new Error('expected chat footer to render the Skills control row')
    if (skillSelect.getAttribute('aria-label') !== 'Skills') throw new Error('expected Skills select to expose a semantic label')
    if (skillSelect.value !== 'storybuilding' || skillSelect.options[0]?.text !== 'Storybuilding') {
      throw new Error(`expected Storybuilding to be the provisioned chat skill, got ${JSON.stringify({ value: skillSelect.value, label: skillSelect.options[0]?.text })}`)
    }
    if (!skillSelect.className.includes('kg-responsive-control-inline-fill') || !skillSelect.className.includes('kg-responsive-compact-panel-field-input')) {
      throw new Error('expected Skills select to use shared fill and compact field owners')
    }

    await act(async () => {
      select.value = 'gpt-5-mini'
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      await waitForFrames(dom.window as unknown as Window, 1)
    })
    if (changedModels[0] !== 'gpt-5-mini') {
      throw new Error(`expected native select change to publish next model, got ${JSON.stringify(changedModels)}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}

export function testFloatingPanelChatApiKeyPromptIsByokOnly() {
  if (!shouldRenderFloatingChatApiKeyPrompt({ chatAuthMode: 'byok', chatProvider: 'miromind-api' })) {
    throw new Error('expected BYOK MiroMind provider to render the floating chat API-key prompt')
  }
  if (shouldRenderFloatingChatApiKeyPrompt({ chatAuthMode: 'serverManaged', chatProvider: 'miromind-api' })) {
    throw new Error('expected server-managed MiroMind provider not to render BYOK API-key prompt UI')
  }
  if (shouldRenderFloatingChatApiKeyPrompt({ chatAuthMode: 'byok', chatProvider: 'lmstudio-local' })) {
    throw new Error('expected providers without API-key requirements not to render BYOK API-key prompt UI')
  }
}

export async function testFloatingPanelChatNewChatCreatesAndFollowsCanonicalWorkspaceFile() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  resetWorkspaceFsForTests()
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setWorkspaceViewMode('canvas')
  useGraphStore.getState().setEditorWorkspacePane('markdown')
  useGraphStore.getState().setChatStorageTarget('chatKnowgrph')
  useGraphStore.getState().setChatKnowgrphWorkspacePath(null)
  useMarkdownExplorerStore.getState().setActivePath(null)
  try {
    await mountReactRoot(root, React.createElement(FloatingPanelChat), {
      window: dom.window as unknown as Window,
      frames: 2,
      tasks: 1,
    })
    const newChatButton = (Array.from(container.querySelectorAll('button')) as HTMLButtonElement[])
      .find(button => String(button.textContent || '').trim() === 'New Chat') as HTMLButtonElement | undefined
    if (!newChatButton) throw new Error('expected FloatingPanel chat to render the New Chat command')
    await act(async () => {
      newChatButton.click()
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (String(useGraphStore.getState().chatKnowgrphWorkspacePath || '').trim()) break
        await waitForTasks(1)
      }
      await waitForFrames(dom.window as unknown as Window, 2)
    })
    const state = useGraphStore.getState()
    const chatPath = String(state.chatKnowgrphWorkspacePath || '')
    if (state.workspaceViewMode !== 'editor') throw new Error(`expected New Chat to open editor workspace, got ${state.workspaceViewMode}`)
    if (!/^\/.+\/\d{8}T\d{6}Z\/kgc_\d{8}T\d{6}Z\.md$/.test(chatPath)) {
      throw new Error(`expected New Chat to allocate canonical KGC workspace path, got ${JSON.stringify(chatPath)}`)
    }
    if (useMarkdownExplorerStore.getState().activePath !== chatPath) throw new Error('expected New Chat to select the canonical KGC workspace file')
    const workspaceFileText = await (await getWorkspaceFs()).readFileText(chatPath)
    if (workspaceFileText !== '') throw new Error(`expected New Chat to create an empty canonical KGC workspace file, got ${JSON.stringify(workspaceFileText)}`)
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    useMarkdownExplorerStore.getState().setActivePath(null)
    useGraphStore.getState().resetAll()
    resetWorkspaceFsForTests()
    restore()
  }
}

export async function testFloatingPanelChatFooterByokApiKeyToggleStaysAtModelIconAndAlignsInput() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const apiKeyWrites: string[] = []

  try {
    await mountReactRoot(
      root,
      React.createElement(FloatingPanelChatFooter, {
        input: '',
        setInput: () => undefined,
        isLoading: false,
        errorText: null,
        connectivity: 'unknown',
        connectivityDetail: null,
        apiKeyPrompt: {
          providerLabel: 'MiroMind API',
          value: '',
          onChange: value => apiKeyWrites.push(value),
        },
        currentNode: null,
        modelId: 'mirothinker-1-7-deepresearch-mini',
        modelOptions: ['mirothinker-1-7-deepresearch-mini', 'mirothinker-1-7-deepresearch', 'gpt-5-nano'],
        onModelChanged: () => undefined,
        skillId: DEFAULT_CHAT_SKILL_ID,
        skillOptions: CHAT_SKILL_OPTIONS,
        onSkillChanged: () => undefined,
        uiPanelTextFontClass: 'text-sm',
        uiPanelMicroLabelTextSizeClass: 'text-xs',
        isSubmitDisabled: true,
        onSubmit: event => event.preventDefault(),
        onStop: () => undefined,
      }),
      { window: dom.window as unknown as Window, frames: 2 },
    )

    const modelControl = container.querySelector('[data-kg-chat-model-control="true"]') as HTMLElement | null
    const modelSelect = container.querySelector('[data-kg-chat-model-select="true"]') as HTMLSelectElement | null
    const toggle = container.querySelector('[data-kg-chat-api-key-toggle="true"]') as HTMLButtonElement | null
    if (!modelControl || !modelSelect || !toggle) {
      throw new Error('expected BYOK footer to render model control, model select, and API-key toggle')
    }
    if (toggle.getAttribute('data-kg-chat-model-icon') !== 'true' || toggle.tagName !== 'BUTTON') {
      throw new Error('expected API-key expand/collapse control to be restored at the model icon')
    }
    if ((toggle.compareDocumentPosition(modelSelect) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING) === 0) {
      throw new Error('expected model-icon API-key toggle to render before the model select')
    }
    if (toggle.getAttribute('aria-expanded') !== 'false' || container.querySelector('[data-kg-chat-api-key-input="true"]')) {
      throw new Error('expected BYOK API-key input to be collapsed by default')
    }
    if (!toggle.className.includes('kg-responsive-control-icon-cell')) {
      throw new Error('expected model-icon toggle to use the shared fixed icon cell')
    }

    await act(async () => {
      toggle.click()
      await waitForFrames(dom.window as unknown as Window, 1)
    })

    const prompt = container.querySelector('[data-kg-chat-api-key-prompt="true"]') as HTMLElement | null
    const keyIcon = container.querySelector('[data-kg-chat-api-key-icon="true"]') as HTMLElement | null
    const keyInput = container.querySelector('[data-kg-chat-api-key-input="true"]') as HTMLInputElement | null
    const skillControl = container.querySelector('[data-kg-chat-skill-control="true"]') as HTMLElement | null
    if (!prompt || !keyIcon || !keyInput) {
      throw new Error('expected model-icon toggle to expand the API-key row')
    }
    if (!skillControl || (prompt.compareDocumentPosition(skillControl) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING) === 0) {
      throw new Error('expected Skills row to render below the expanded API-key row')
    }
    if (prompt.querySelector('[data-kg-chat-api-key-toggle="true"]')) {
      throw new Error('expected expanded API-key row not to contain the collapse toggle')
    }
    if (!keyIcon.className.includes('kg-responsive-control-icon-cell') || !toggle.className.includes('kg-responsive-control-icon-cell')) {
      throw new Error('expected model and API-key rows to share the fixed icon cell for alignment')
    }
    if (keyInput.getAttribute('aria-label') !== 'MiroMind API BYOK API key') {
      throw new Error(`expected API-key input to expose provider-specific label, got ${keyInput.getAttribute('aria-label')}`)
    }

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(keyInput, 'sk-miromind-test')
      Simulate.change(keyInput)
      await waitForFrames(dom.window as unknown as Window, 1)
    })
    if (apiKeyWrites[0] !== 'sk-miromind-test') {
      throw new Error(`expected API-key input to write through callback, got ${JSON.stringify(apiKeyWrites)}`)
    }

    await act(async () => {
      toggle.click()
      await waitForFrames(dom.window as unknown as Window, 1)
    })
    if (container.querySelector('[data-kg-chat-api-key-input="true"]')) {
      throw new Error('expected model-icon toggle to collapse only the API-key input')
    }
    if (!container.querySelector('[data-kg-chat-model-select="true"]')) {
      throw new Error('expected model select to remain visible after API-key collapse')
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
