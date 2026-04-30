import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'

import { NodeOverlayEditorSchemaTable } from '@/components/FlowEditor/NodeOverlayEditorSchemaTable'
import { NodeOverlayEditorRegistrySection } from '@/components/FlowEditor/NodeOverlayEditorRegistrySection'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT,
  CHAT_OPENAI_ENDPOINT_URL,
} from '@/lib/chatEndpoint'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  FLOW_EDITOR_ASPECT_RATIO_OPTIONS,
  FLOW_EDITOR_IMAGE_MODEL_OPTIONS,
  FLOW_EDITOR_VIDEO_MODEL_OPTIONS,
} from '@/lib/config.flow-editor'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'

export const testFlowWidgetPortHandleDomAnchorsPresent = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(
      'div',
      { style: { width: 360, height: 420 } },
      React.createElement(NodeOverlayEditorSchemaTable, {
        active: true,
        schemaFields: [{ id: 'prompt', label: 'Prompt', type: 'string' }],
        portHandlesEnabled: true,
        dotSizePx: 10,
        dotHitPx: 18,
        microLabelClass: 'text-xs',
        textSizeClass: 'text-sm',
        keyValueInputClass: 'border',
        onCommitSchemaFields: () => void 0,
      }),
      React.createElement(NodeOverlayEditorRegistrySection, {
        active: true,
        properties: {},
        registryEntry: {
          id: 'x',
          widgetTypeId: 'x',
          fields: [],
          ports: [{ portKey: 'prompt_out', direction: 'output' }],
        } as any,
        microLabelClass: 'text-xs',
        monospaceTextClass: 'font-mono',
        textSizeClass: 'text-sm',
        keyValueInputClass: 'border',
        keyLabelClass: 'text-xs',
        normalizeRegistrySchemaPath: () => '',
        ids: { registryField: (k: string) => k },
        dotSizePx: 10,
        dotHitPx: 18,
        portHandlesEnabled: true,
        onSetProperties: () => void 0,
      }),
    ),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const schemaIn = host.querySelector('button[data-kg-port-handle="1"][data-kg-port-dir="in"][data-kg-port-key^="field:"]')
  const schemaOut = host.querySelector('button[data-kg-port-handle="1"][data-kg-port-dir="out"][data-kg-port-key^="field:"]')
  if (!schemaIn || !schemaOut) throw new Error('expected schema port handle buttons to expose DOM anchor data')

  const regOut = host.querySelector('button[data-kg-port-handle="1"][data-kg-port-dir="out"][data-kg-port-key="prompt_out"]')
  if (!regOut) throw new Error('expected registry port handle button to expose DOM anchor data')
  const regOutRow = regOut.closest('tr')
  if (!regOutRow) throw new Error('expected registry port row to render')
  if (!regOutRow.textContent?.includes('handles.source')) {
    throw new Error('expected registry port key column to render shared handles.source path text')
  }
  const regOutValueInput = regOutRow.querySelector('input[readonly][disabled]')
  if (!regOutValueInput) throw new Error('expected registry port value column to reuse shared read-only input typography')

  root.unmount()
}

export const testTextWidgetCellsStayLocallyEditable = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  const patched: Array<Record<string, unknown>> = []

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        chatProvider: 'openai',
        prompt: 'hello',
        chatEndpointUrl: CHAT_OPENAI_ENDPOINT_URL,
        chatModel: 'gpt-5.4-nano',
        chatTopP: 0.7,
      },
      registryEntry: {
        id: 'text-widget',
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration',
        fields: [
          { fieldKey: 'prompt', fieldType: 'text', schemaPath: 'properties.prompt', label: 'Prompt' },
          { fieldKey: 'chatModel', fieldType: 'text', schemaPath: 'properties.chatModel', label: 'Model' },
          { fieldKey: 'chatTopP', fieldType: 'number', schemaPath: 'properties.chatTopP', label: 'Top P' },
        ],
        ports: [{ portKey: 'prompt_in', direction: 'input' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: next => patched.push(next),
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const promptInput = host.querySelector<HTMLInputElement>('#prompt')
  const modelInput = host.querySelector<HTMLInputElement>('#chatModel')
  const topPInput = host.querySelector<HTMLInputElement>('#chatTopP')
  if (!promptInput || !modelInput || !topPInput) {
    throw new Error('expected local BytePlus text widget inputs to render')
  }

  const promptPort = host.querySelector('button[data-kg-port-key="prompt_in"]')
  if (promptPort) throw new Error('expected BytePlus text widget to omit non-API registry port rows')

  promptInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  promptInput.value = 'updated prompt'
  promptInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

  modelInput.value = 'seed-2-0-lite-custom'
  modelInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  topPInput.value = '0.4'
  topPInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  if (patched.length === 0) {
    throw new Error('expected local BytePlus text widget field edits to patch widget properties')
  }

  root.unmount()
}

export const testWidgetRegistrySelectFieldsStayEditable = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  const patched: Array<Record<string, unknown>> = []

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        model: FLOW_EDITOR_IMAGE_MODEL_OPTIONS[0]?.value,
        aspect_ratio: 'landscape',
      },
      registryEntry: {
        id: 'image-widget',
        nodeTypeId: 'ImageGeneration',
        widgetTypeId: 'default',
        formId: 'imageGeneration',
        fields: [
          { fieldKey: 'model', fieldType: 'select', schemaPath: 'properties.model', label: 'Model', options: FLOW_EDITOR_IMAGE_MODEL_OPTIONS },
          { fieldKey: 'aspect_ratio', fieldType: 'select', schemaPath: 'properties.aspect_ratio', label: 'Aspect ratio', options: FLOW_EDITOR_ASPECT_RATIO_OPTIONS },
        ],
        ports: [{ portKey: 'imageUrl', direction: 'output', schemaPath: 'properties.imageUrl' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: next => patched.push(next),
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const selects = Array.from(host.querySelectorAll('select'))
  if (selects.length < 2) {
    throw new Error(`expected registry select fields to render shared dropdown editors, got ${selects.length} selects`)
  }
  const aspectSelect = host.querySelector<HTMLSelectElement>('#aspect_ratio')
  if (!aspectSelect) throw new Error('expected aspect ratio select to render')
  aspectSelect.value = 'portrait'
  aspectSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  if (!patched.some(entry => String(entry.aspect_ratio || '') === 'portrait')) {
    throw new Error(`expected shared select editor to patch aspect_ratio, got ${JSON.stringify(patched)}`)
  }

  root.unmount()
}

export const testOpenAiTextWidgetCellsStayLocallyEditable = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  const patched: Array<Record<string, unknown>> = []

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        chatProvider: 'openai',
        prompt: 'hello',
        chatEndpointUrl: CHAT_OPENAI_ENDPOINT_URL,
        chatModel: 'gpt-5.4-nano',
        chatTopP: 0.7,
      },
      registryEntry: {
        id: 'openai-text-widget',
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'openai',
        formId: 'textGeneration.openai',
        fields: [
          { fieldKey: 'prompt', fieldType: 'text', schemaPath: 'properties.prompt', label: 'Prompt' },
          { fieldKey: 'chatModel', fieldType: 'text', schemaPath: 'properties.chatModel', label: 'Model' },
          { fieldKey: 'chatTopP', fieldType: 'number', schemaPath: 'properties.chatTopP', label: 'Top P' },
        ],
        ports: [{ portKey: 'prompt_in', direction: 'input', schemaPath: 'properties.prompt' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: next => patched.push(next),
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const promptInput = host.querySelector<HTMLInputElement>('#prompt')
  const modelInput = host.querySelector<HTMLInputElement>('#chatModel')
  const topPInput = host.querySelector<HTMLInputElement>('#chatTopP')
  if (!promptInput || !modelInput || !topPInput) {
    throw new Error('expected OpenAI text widget inputs to render')
  }

  promptInput.value = 'updated openai prompt'
  promptInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  modelInput.value = 'gpt-5.4-mini'
  modelInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  topPInput.value = '0.4'
  topPInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  if (patched.length === 0) {
    throw new Error('expected OpenAI text widget field edits to patch widget properties')
  }

  root.unmount()
}

export const testSeedreamImageWidgetKvRowsStayEditable = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  const patched: Array<Record<string, unknown>> = []

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        model: FLOW_EDITOR_IMAGE_MODEL_OPTIONS[0]?.value,
        size: '2K',
        reference_image: 'https://example.invalid/seedream-ref.png',
      },
      registryEntry: {
        id: 'seedream-image-widget',
        nodeTypeId: 'ImageGeneration',
        widgetTypeId: 'default',
        formId: 'imageGeneration',
        fields: [
          { fieldKey: 'model', fieldType: 'select', schemaPath: 'properties.model', label: 'Model', options: FLOW_EDITOR_IMAGE_MODEL_OPTIONS },
          { fieldKey: 'size', fieldType: 'select', schemaPath: 'properties.size', label: 'Size', options: [{ value: '2K', label: '2K' }, { value: '4K', label: '4K' }] },
          { fieldKey: 'reference_image', fieldType: 'text', schemaPath: 'properties.reference_image', label: 'Reference image' },
        ],
        ports: [{ portKey: 'imageUrl', direction: 'output', schemaPath: 'properties.imageUrl' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: next => patched.push(next),
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const sizeSelect = host.querySelector<HTMLSelectElement>('#size')
  const refInput = host.querySelector<HTMLInputElement>('#reference_image')
  if (!sizeSelect || !refInput) throw new Error('expected Seedream image widget fields to render')
  sizeSelect.value = '4K'
  sizeSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  refInput.value = 'https://example.invalid/seedream-ref-updated.png'
  refInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  if (!patched.some(entry => String(entry.size || '') === '4K')) {
    throw new Error('expected Seedream image widget select field edits to patch widget properties')
  }
  if (!patched.some(entry => String(entry.reference_image || '').includes('seedream-ref-updated'))) {
    throw new Error('expected Seedream image widget text field edits to patch widget properties')
  }

  root.unmount()
}

export const testBytePlusVideoWidgetKvRowsStayEditable = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  const patched: Array<Record<string, unknown>> = []

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        model: FLOW_EDITOR_VIDEO_MODEL_OPTIONS[0]?.value,
        duration: 2,
        prompt: 'Imagination run wild, 2s; Singapore',
      },
      registryEntry: {
        id: 'byteplus-video-widget',
        nodeTypeId: 'VideoGeneration',
        widgetTypeId: 'default',
        formId: 'videoGeneration',
        fields: [
          { fieldKey: 'model', fieldType: 'select', schemaPath: 'properties.model', label: 'Model', options: FLOW_EDITOR_VIDEO_MODEL_OPTIONS },
          { fieldKey: 'duration', fieldType: 'select', schemaPath: 'properties.duration', label: 'Duration', options: [{ value: 2, label: '2s' }, { value: 4, label: '4s' }, { value: 6, label: '6s' }] },
          { fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt', label: 'Prompt' },
        ],
        ports: [{ portKey: 'videoUrl', direction: 'output', schemaPath: 'properties.videoUrl' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: next => patched.push(next),
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const durationSelect = host.querySelector<HTMLSelectElement>('#duration')
  const promptInput = host.querySelector<HTMLTextAreaElement>('#prompt')
  if (!durationSelect || !promptInput) throw new Error('expected BytePlus video widget fields to render')
  durationSelect.value = '6'
  durationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  promptInput.value = 'Imagination run wild, 6s; Singapore'
  promptInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  if (!patched.some(entry => Number(entry.duration) === 6)) {
    throw new Error('expected BytePlus video widget select field edits to patch widget properties')
  }
  if (!patched.some(entry => String(entry.prompt || '').includes('6s; Singapore'))) {
    throw new Error('expected BytePlus video widget text field edits to patch widget properties')
  }

  root.unmount()
}

export const testTextWidgetRegistryFieldRowsKeepPlaceholderPortHandles = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        chatProvider: 'byteplus',
        prompt: 'hello',
        chatMessagesJson: '[{"role":"user","content":"hi"}]',
        chatThinkingJson: '{"type":"enabled"}',
      },
      registryEntry: {
        id: 'text-widget',
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration',
        fields: [
          { fieldKey: 'prompt', fieldType: 'text', schemaPath: 'properties.prompt', label: 'Prompt' },
          { fieldKey: 'chatMessagesJson', fieldType: 'json', schemaPath: 'properties.chatMessagesJson', label: 'Messages' },
          { fieldKey: 'chatThinkingJson', fieldType: 'json', schemaPath: 'properties.chatThinkingJson', label: 'Thinking' },
        ],
        ports: [{ portKey: 'prompt_in', direction: 'input', schemaPath: 'properties.prompt' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: () => void 0,
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  ;['prompt', 'chatMessagesJson', 'chatThinkingJson'].forEach(fieldId => {
    const label = host.querySelector(`label[for="${fieldId}"]`)
    const row = label?.closest('tr')
    if (!row) throw new Error(`expected ${fieldId} field row to render`)
    const cells = Array.from(row.querySelectorAll('td')) as HTMLTableCellElement[]
    if (cells.length !== 5) throw new Error(`expected ${fieldId} field row to expose 5 cells, got ${cells.length}`)
    const inDot = cells[0]?.querySelector('button[disabled]')
    const outDot = cells[4]?.querySelector('button[disabled]')
    if (!inDot || !outDot) {
      throw new Error(`expected ${fieldId} field row to keep placeholder port handles on both sides`)
    }
  })

  root.unmount()
}

export const testBytePlusTextWidgetUsesGlobalDefaultsUntilLocallyOverridden = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  const storeApi = useGraphStore.getState()
  storeApi.setChatProvider('byteplus-modelark')
  storeApi.setChatEndpointUrl(CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL)
  storeApi.setChatModel(CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT)

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        prompt: 'hello',
      },
      registryEntry: {
        id: 'text-widget',
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration',
        fields: [
          { fieldKey: 'chatProvider', fieldType: 'text', schemaPath: 'properties.chatProvider', label: 'Provider' },
          { fieldKey: 'chatEndpointUrl', fieldType: 'text', schemaPath: 'properties.chatEndpointUrl', label: 'Endpoint URL' },
          { fieldKey: 'chatModel', fieldType: 'text', schemaPath: 'properties.chatModel', label: 'Model' },
          { fieldKey: 'prompt', fieldType: 'text', schemaPath: 'properties.prompt', label: 'Prompt' },
        ],
        ports: [{ portKey: 'prompt_in', direction: 'input', schemaPath: 'properties.prompt' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: () => void 0,
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const providerInput = host.querySelector<HTMLInputElement>('#chatProvider')
  const endpointInput = host.querySelector<HTMLInputElement>('#chatEndpointUrl')
  const modelInput = host.querySelector<HTMLInputElement>('#chatModel')
  if (!providerInput || !endpointInput || !modelInput) {
    throw new Error('expected BytePlus provider, endpoint, and model inputs to render')
  }
  if (providerInput.value !== 'byteplus-modelark') {
    throw new Error(`expected BytePlus text widget to fall back to global BytePlus provider, got ${JSON.stringify(providerInput.value)}`)
  }
  if (endpointInput.value !== CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL) {
    throw new Error(`expected BytePlus text widget to fall back to global BytePlus endpoint, got ${JSON.stringify(endpointInput.value)}`)
  }
  if (modelInput.value !== CHAT_BYTEPLUS_TEXT_MODEL_DEFAULT) {
    throw new Error(`expected BytePlus text widget to fall back to global BytePlus model, got ${JSON.stringify(modelInput.value)}`)
  }
  if (host.querySelector('button[data-kg-port-key="prompt_in"]')) {
    throw new Error('expected BytePlus text widget to hide non-API registry port rows')
  }

  root.unmount()
}

export const testBytePlusTextWidgetLocalOverridesStayEditable = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  const storeApi = useGraphStore.getState()
  storeApi.setChatProvider('openai')
  storeApi.setChatEndpointUrl(CHAT_OPENAI_ENDPOINT_URL)
  storeApi.setChatModel('gpt-5.4-nano')

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        chatProvider: 'byteplus-modelark',
        chatEndpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
        chatModel: 'seed-2-0-lite-custom',
        prompt: 'hello',
      },
      registryEntry: {
        id: 'text-widget',
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration',
        fields: [
          { fieldKey: 'chatProvider', fieldType: 'text', schemaPath: 'properties.chatProvider', label: 'Provider' },
          { fieldKey: 'chatEndpointUrl', fieldType: 'text', schemaPath: 'properties.chatEndpointUrl', label: 'Endpoint URL' },
          { fieldKey: 'chatModel', fieldType: 'text', schemaPath: 'properties.chatModel', label: 'Model' },
        ],
        ports: [{ portKey: 'prompt_in', direction: 'input', schemaPath: 'properties.prompt' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: () => void 0,
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const providerInput = host.querySelector<HTMLInputElement>('#chatProvider')
  const endpointInput = host.querySelector<HTMLInputElement>('#chatEndpointUrl')
  const modelInput = host.querySelector<HTMLInputElement>('#chatModel')
  if (!providerInput || !endpointInput || !modelInput) {
    throw new Error('expected BytePlus provider override inputs to render')
  }
  if (providerInput.value !== 'byteplus-modelark') {
    throw new Error(`expected local BytePlus provider override to stay editable, got ${JSON.stringify(providerInput.value)}`)
  }
  if (endpointInput.value !== CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL) {
    throw new Error(`expected local BytePlus endpoint override to stay editable, got ${JSON.stringify(endpointInput.value)}`)
  }
  if (modelInput.value !== 'seed-2-0-lite-custom') {
    throw new Error(`expected local BytePlus model override to stay editable, got ${JSON.stringify(modelInput.value)}`)
  }

  root.unmount()
}

export const testOpenAiTextWidgetPortHandleLinksToOpenAiIntegrations = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  const storeApi = useGraphStore.getState()
  storeApi.setChatProvider('openai')
  storeApi.setChatEndpointUrl(CHAT_OPENAI_ENDPOINT_URL)
  storeApi.setChatModel('gpt-5.4-nano')

  const events: Array<{ searchQuery?: string; anchorId?: string }> = []
  const eventWindow = dom.window as Window & typeof globalThis
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ searchQuery?: string; anchorId?: string }>
    events.push(custom.detail || {})
  }
  eventWindow.addEventListener(MAIN_PANEL_OPEN_EVENT, listener as EventListener)

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        chatProvider: 'openai',
        prompt: 'hello',
        chatEndpointUrl: CHAT_OPENAI_ENDPOINT_URL,
        chatModel: 'gpt-5.4-nano',
      },
      registryEntry: {
        id: 'text-widget-openai',
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration.openai',
        fields: [
          { fieldKey: 'chatProvider', fieldType: 'text', schemaPath: 'properties.chatProvider', label: 'Provider' },
        ],
        ports: [{ portKey: 'prompt_in', direction: 'input', schemaPath: 'properties.prompt' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: () => void 0,
      showFieldRows: false,
      showPortRows: true,
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const promptPort = host.querySelector<HTMLButtonElement>('button[data-kg-port-key="prompt_in"]')
  if (!promptPort) {
    throw new Error('expected OpenAI text widget prompt port handle button to render')
  }
  promptPort.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const last = events[events.length - 1]
  if (!last) {
    throw new Error('expected OpenAI text widget port click to dispatch an integrations deep-link event')
  }
  if (String(last.searchQuery || '') !== 'openaiApi.input') {
    throw new Error(`expected OpenAI port click to search openaiApi.input, got ${JSON.stringify(last)}`)
  }
  if (String(last.anchorId || '') !== 'openai-chat-api-row-openaiapi-input') {
    throw new Error(`expected OpenAI port click to target the exact OpenAI row anchor, got ${JSON.stringify(last)}`)
  }

  eventWindow.removeEventListener(MAIN_PANEL_OPEN_EVENT, listener as EventListener)
  root.unmount()
}

export const testBytePlusVideoWidgetPortHandleLinksToVideoIntegrations = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  const events: Array<{ searchQuery?: string; anchorId?: string }> = []
  const eventWindow = dom.window as Window & typeof globalThis
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ searchQuery?: string; anchorId?: string }>
    events.push(custom.detail || {})
  }
  eventWindow.addEventListener(MAIN_PANEL_OPEN_EVENT, listener as EventListener)

  root.render(
    React.createElement(NodeOverlayEditorRegistrySection, {
      active: true,
      properties: {
        model: FLOW_EDITOR_VIDEO_MODEL_OPTIONS[0]?.value,
        prompt: 'hello',
      },
      registryEntry: {
        id: 'video-widget',
        nodeTypeId: 'VideoGeneration',
        widgetTypeId: 'default',
        formId: 'videoGeneration',
        fields: [
          { fieldKey: 'model', fieldType: 'select', schemaPath: 'properties.model', label: 'Model', options: FLOW_EDITOR_VIDEO_MODEL_OPTIONS },
        ],
        ports: [{ portKey: 'videoUrl', direction: 'output', schemaPath: 'properties.videoUrl' }],
      } as any,
      microLabelClass: 'text-xs',
      monospaceTextClass: 'font-mono',
      textSizeClass: 'text-sm',
      keyValueInputClass: 'border',
      keyLabelClass: 'text-xs',
      normalizeRegistrySchemaPath: (schemaPath?: string) => String(schemaPath || ''),
      ids: { registryField: (k: string) => k },
      dotSizePx: 10,
      dotHitPx: 18,
      portHandlesEnabled: true,
      onSetProperties: () => void 0,
      showFieldRows: false,
      showPortRows: true,
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const outputPort = host.querySelector<HTMLButtonElement>('button[data-kg-port-key="videoUrl"]')
  if (!outputPort) {
    throw new Error('expected BytePlus video widget output port handle button to render')
  }
  outputPort.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const last = events[events.length - 1]
  if (!last) {
    throw new Error('expected BytePlus video widget port click to dispatch an integrations deep-link event')
  }
  if (String(last.searchQuery || '') !== 'byteplusVideoApi.polling_endpoint') {
    throw new Error(`expected BytePlus video port click to search byteplusVideoApi.polling_endpoint, got ${JSON.stringify(last)}`)
  }
  if (String(last.anchorId || '') !== 'byteplus-video-generation-api-row-byteplusvideoapi-polling-endpoint') {
    throw new Error(`expected BytePlus video port click to target the exact video row anchor, got ${JSON.stringify(last)}`)
  }

  eventWindow.removeEventListener(MAIN_PANEL_OPEN_EVENT, listener as EventListener)
  root.unmount()
}
