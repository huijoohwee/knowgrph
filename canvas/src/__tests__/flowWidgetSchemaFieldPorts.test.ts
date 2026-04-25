import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'

import { defaultSchema } from '@/lib/graph/schema'
import { NodeOverlayEditorForm } from '@/components/FlowEditor/NodeOverlayEditorForm'
import {
  buildTextGenerationRegistryDraft,
  buildWidgetDraftFromSmartFields,
} from '@/features/flow-editor-manager/registryTemplates'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { buildRichMediaPanelRegistryDraft } from '@/features/flow-editor-manager/registryTemplates'

export const testFlowWidgetSchemaFieldPortsRenderRowHandles = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const schema = {
    ...defaultSchema,
    behavior: { ...defaultSchema.behavior, portHandles: { ...defaultSchema.behavior.portHandles, enabled: true } },
  }

  const node = {
    id: 'table:products',
    label: 'Products',
    type: 'Schema',
    properties: {
      'schema:fields': ['id', { title: 'warehouse_id', type: 'uuid' }],
    },
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node,
      schema,
      hideFields: true,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      onSchemaPortHandleClick: () => void 0,
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const inButtons = host.querySelectorAll('button[data-kg-port-handle="1"][data-kg-port-dir="in"][data-kg-port-key^="field:"]')
  const outButtons = host.querySelectorAll('button[data-kg-port-handle="1"][data-kg-port-dir="out"][data-kg-port-key^="field:"]')
  if (inButtons.length !== 2) throw new Error(`expected 2 input port buttons, got ${inButtons.length}`)
  if (outButtons.length !== 2) throw new Error(`expected 2 output port buttons, got ${outButtons.length}`)

  root.unmount()
}

export const testTextGenerationWidgetDoesNotRenderLegacySmartMediaRows = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const registryDraft = buildTextGenerationRegistryDraft({ providerFamily: 'byteplus' })
  const registryEntry = {
    ...registryDraft,
    id: 'byteplus-text-default',
    updatedAt: '2026-02-06T00:00:00.000Z',
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node: {
        id: 'text:byteplus',
        label: 'BytePlus Text Widget',
        type: 'TextGeneration',
        properties: {
          chatProvider: 'byteplus',
          chatModel: 'doubao-1.5-pro-32k',
          prompt: 'hello',
          aspect_ratio: 'square',
          resolution: '1080p',
          duration: 4,
          generate_audio: true,
          fast: false,
          reference_image: 'https://example.invalid/image.png',
        },
      },
      schema: defaultSchema,
      hideFields: false,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      registryEntry: registryEntry as any,
      registryEntries: [registryEntry as any],
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  if (host.querySelector('section[aria-label="Smart fields"]')) {
    throw new Error('expected BytePlus TextGeneration widget to hide legacy smart-media rows')
  }
  ;['Aspect ratio', 'Resolution', 'Duration', 'Generate audio', 'Fast', 'Reference image'].forEach(label => {
    if (host.textContent?.includes(label)) {
      throw new Error(`expected BytePlus TextGeneration widget to omit legacy smart-media row ${label}`)
    }
  })
  ;['Provider', 'Model', 'Response format', 'Top P'].forEach(label => {
    if (!host.textContent?.includes(label)) {
      throw new Error(`expected BytePlus TextGeneration widget to keep registry row ${label}`)
    }
  })

  root.unmount()
}

export const testFlowWidgetHideFieldsRendersTextOutputPreviewAndKeepsPortRows = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const registryDraft = buildTextGenerationRegistryDraft({ providerFamily: 'byteplus' })
  const registryEntry = {
    ...registryDraft,
    id: 'byteplus-text-default',
    updatedAt: '2026-04-22T00:00:00.000Z',
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node: {
        id: 'text:compact',
        label: 'BytePlus Text Widget',
        type: 'TextGeneration',
        properties: {
          prompt: 'hello',
          output: '## Compact text preview',
        },
      },
      schema: defaultSchema,
      hideFields: true,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      registryEntry: registryEntry as any,
      registryEntries: [registryEntry as any],
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const preview = host.querySelector('textarea[aria-label="Widget text output preview"]') as HTMLTextAreaElement | null
  if (!preview) throw new Error('expected compact text output preview textarea')
  if (!preview.value.includes('Compact text preview')) {
    throw new Error('expected compact text preview to render widget output text')
  }
  if (host.textContent?.includes('Response format')) {
    throw new Error('expected hideFields compact mode to hide default registry field rows')
  }
  const portButtons = host.querySelectorAll('button[data-kg-port-handle="1"][data-kg-port-dir="out"]')
  if (portButtons.length < 1) throw new Error('expected compact mode to keep output-side port handle rows')

  root.unmount()
}

export const testFlowWidgetHideFieldsRendersImageOutputPreview = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const registryDraft = buildWidgetDraftFromSmartFields({
    nodeTypeId: FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
    mode: 'image',
  })
  const registryEntry = {
    ...registryDraft,
    id: 'image-widget-default',
    updatedAt: '2026-04-22T00:00:00.000Z',
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node: {
        id: 'image:compact',
        label: 'BytePlus Image Widget',
        type: FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
        properties: {
          imageUrl: 'https://example.invalid/generated-image.png',
        },
      },
      schema: defaultSchema,
      hideFields: true,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      registryEntry: registryEntry as any,
      registryEntries: [registryEntry as any],
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const preview = host.querySelector('img[src="https://example.invalid/generated-image.png"]') as HTMLImageElement | null
  if (!preview) throw new Error('expected compact image output preview')

  root.unmount()
}

export const testFlowWidgetHideFieldsRendersVideoOutputPreview = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const registryDraft = buildWidgetDraftFromSmartFields({
    nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
    mode: 'video',
  })
  const registryEntry = {
    ...registryDraft,
    id: 'video-widget-default',
    updatedAt: '2026-04-22T00:00:00.000Z',
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node: {
        id: 'video:compact',
        label: 'Video Widget',
        type: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
        properties: {
          videoUrl: 'https://example.invalid/generated-video.mp4',
        },
      },
      schema: defaultSchema,
      hideFields: true,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      registryEntry: registryEntry as any,
      registryEntries: [registryEntry as any],
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const preview = host.querySelector('video[src="https://example.invalid/generated-video.mp4"]') as HTMLVideoElement | null
  if (!preview) throw new Error('expected compact video output preview')

  root.unmount()
}

export const testFlowWidgetHideFieldsRendersConnectedImagePreviewFromGenericOutputEdge = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const registryDraft = buildRichMediaPanelRegistryDraft()
  const registryEntry = {
    ...registryDraft,
    id: 'rich-media-panel-default',
    updatedAt: '2026-04-22T00:00:00.000Z',
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node: {
        id: 'rich-media:compact:image-from-output',
        label: 'Rich Media Panel',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        properties: {},
      },
      schema: defaultSchema,
      hideFields: true,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      registryEntry: registryEntry as any,
      registryEntries: [registryEntry as any],
      connectedValuesBySchemaPath: {
        'properties.output': {
          value: 'https://example.invalid/connected-image.png',
          sources: [{ edgeId: 'edge-image', nodeId: 'image-widget', portKey: 'imageUrl' }],
        },
      },
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const preview = host.querySelector('img[src="https://example.invalid/connected-image.png"]') as HTMLImageElement | null
  if (!preview) throw new Error('expected connected image source port on generic output edge to render image preview')

  root.unmount()
}

export const testFlowWidgetHideFieldsRendersConnectedVideoPreviewFromGenericOutputEdge = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const registryDraft = buildRichMediaPanelRegistryDraft()
  const registryEntry = {
    ...registryDraft,
    id: 'rich-media-panel-default',
    updatedAt: '2026-04-22T00:00:00.000Z',
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node: {
        id: 'rich-media:compact:video-from-output',
        label: 'Rich Media Panel',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        properties: {},
      },
      schema: defaultSchema,
      hideFields: true,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      registryEntry: registryEntry as any,
      registryEntries: [registryEntry as any],
      connectedValuesBySchemaPath: {
        'properties.output': {
          value: 'https://example.invalid/connected-video.mp4',
          sources: [{ edgeId: 'edge-video', nodeId: 'video-widget', portKey: 'videoUrl' }],
        },
      },
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const preview = host.querySelector('video[src="https://example.invalid/connected-video.mp4"]') as HTMLVideoElement | null
  if (!preview) throw new Error('expected connected video source port on generic output edge to render video preview')

  root.unmount()
}

export const testRichMediaPanelDefaultViewReusesSharedViewerSsot = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const registryDraft = buildRichMediaPanelRegistryDraft()
  const registryEntry = {
    ...registryDraft,
    id: 'rich-media-panel-default',
    updatedAt: '2026-04-24T00:00:00.000Z',
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node: {
        id: 'rich-media:viewer-default',
        label: 'Rich Media Panel',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        properties: {},
      },
      schema: defaultSchema,
      hideFields: false,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      registryEntry: registryEntry as any,
      registryEntries: [registryEntry as any],
      connectedValuesBySchemaPath: {
        'properties.output': {
          value: '# Hello from Rich Media Panel',
          sources: [{ edgeId: 'edge-text', nodeId: 'text-widget', portKey: 'text_out' }],
        },
      },
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const viewer = host.querySelector('[data-kg-rich-media-panel="1"]')
  if (!viewer) throw new Error('expected Rich Media Panel default view to mount the shared RichMediaPanel viewer')
  const resizeHandle = host.querySelector('[data-kg-resize-handle="se"]')
  if (!resizeHandle) throw new Error('expected Rich Media Panel default view to keep the bottom-right resize handle on the same panel surface')
  const markdownPreview = host.querySelector('[data-kg-rich-media-markdown-preview="1"]')
  if (!markdownPreview) throw new Error('expected Rich Media Panel default view to reuse markdown/image/video viewer SSOT')
  if (host.textContent?.includes('Widget Registry')) {
    throw new Error('expected Rich Media Panel default view to avoid duplicate registry/KTV sections')
  }
  ;['Model', 'Prompt', 'Aspect ratio', 'Duration', 'Resolution', 'Generate audio', 'Fast'].forEach(text => {
    if (host.textContent?.includes(text)) {
      throw new Error(`expected Rich Media Panel default view to avoid stale smart-media editor field ${text}`)
    }
  })

  root.unmount()
}

export const testRichMediaPanelKtvRowsReuseSharedWidgetKvTableSsot = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const registryDraft = buildRichMediaPanelRegistryDraft()
  const registryEntry = {
    ...registryDraft,
    id: 'rich-media-panel-default',
    updatedAt: '2026-04-24T00:00:00.000Z',
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node: {
        id: 'rich-media:ktv-rows',
        label: 'Rich Media Panel',
        type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        properties: {
          output: 'hello',
          imageUrl: 'https://example.invalid/panel.png',
        },
      },
      schema: defaultSchema,
      hideFields: true,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      registryEntry: registryEntry as any,
      registryEntries: [registryEntry as any],
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const viewer = host.querySelector('[data-kg-rich-media-panel="1"]')
  if (viewer) throw new Error('expected Rich Media Panel KTV mode to hide the viewer surface')
  const resizeHandle = host.querySelector('[data-kg-resize-handle="se"]')
  if (resizeHandle) throw new Error('expected Rich Media Panel KTV mode to hide the resize-handle viewer surface')
  ;['Key', 'Type', 'Value', 'Output', 'Image URL', 'Video URL', 'HTML srcdoc'].forEach(text => {
    if (!host.textContent?.includes(text)) {
      throw new Error(`expected Rich Media Panel KTV mode to reuse shared widget table content ${text}`)
    }
  })
  const portButtons = host.querySelectorAll('button[data-kg-port-handle="1"]')
  if (portButtons.length < 4) throw new Error(`expected Rich Media Panel KTV mode to keep shared port handles, got ${portButtons.length}`)

  root.unmount()
}
