import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  FLOW_RICH_MEDIA_PANEL_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
} from '@/lib/config.flow-editor'

export function buildRichMediaPanelRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    widgetTypeId: FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
    formId: FLOW_RICH_MEDIA_PANEL_FORM_ID,
    fields: [
      { fieldKey: 'output', fieldType: 'textarea', schemaPath: 'properties.output', label: 'Output' },
      { fieldKey: 'imageUrl', fieldType: 'text', schemaPath: 'properties.imageUrl', label: 'Image URL' },
      { fieldKey: 'videoUrl', fieldType: 'text', schemaPath: 'properties.videoUrl', label: 'Video URL' },
      { fieldKey: 'audioUrl', fieldType: 'text', schemaPath: 'properties.audioUrl', label: 'Audio URL' },
      { fieldKey: 'outputSrcDoc', fieldType: 'textarea', schemaPath: 'properties.outputSrcDoc', label: 'HTML srcdoc' },
      { fieldKey: 'media_interactive', fieldType: 'boolean', schemaPath: 'properties.media_interactive', label: 'Interactive' },
    ],
    ports: [
      { portKey: 'output', direction: 'input', schemaPath: 'properties.output' },
      { portKey: 'imageUrl', direction: 'input', schemaPath: 'properties.imageUrl' },
      { portKey: 'videoUrl', direction: 'input', schemaPath: 'properties.videoUrl' },
      { portKey: 'audioUrl', direction: 'input', schemaPath: 'properties.audioUrl' },
      { portKey: 'outputSrcDoc', direction: 'input', schemaPath: 'properties.outputSrcDoc' },
      { portKey: 'output', direction: 'output', schemaPath: 'properties.output' },
      { portKey: 'imageUrl', direction: 'output', schemaPath: 'properties.imageUrl' },
      { portKey: 'videoUrl', direction: 'output', schemaPath: 'properties.videoUrl' },
      { portKey: 'audioUrl', direction: 'output', schemaPath: 'properties.audioUrl' },
      { portKey: 'outputSrcDoc', direction: 'output', schemaPath: 'properties.outputSrcDoc' },
    ],
    schemaMappings: [],
  }
}
