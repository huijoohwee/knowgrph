import type { WidgetRegistryEntry, WidgetRegistryField, WidgetRegistryPort } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import {
  FLOW_HTML_VIDEO_RENDERER_FORM_ID,
  FLOW_HTML_VIDEO_RENDERER_NODE_LABEL,
  FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID,
  FLOW_HTML_VIDEO_RENDERER_WIDGET_TYPE_ID,
} from '@/lib/config.storyboard-widget'

const HTML_VIDEO_RENDERER_FIELDS: WidgetRegistryField[] = [
  { fieldKey: 'html', fieldType: 'textarea', schemaPath: 'properties.html', label: 'HTML' },
  { fieldKey: 'css', fieldType: 'textarea', schemaPath: 'properties.css', label: 'CSS' },
  { fieldKey: 'data_json', fieldType: 'textarea', schemaPath: 'properties.data_json', label: 'Data JSON' },
  { fieldKey: 'duration_ms', fieldType: 'number', schemaPath: 'properties.duration_ms', label: 'Duration ms' },
  { fieldKey: 'fps', fieldType: 'number', schemaPath: 'properties.fps', label: 'FPS' },
  { fieldKey: 'width', fieldType: 'number', schemaPath: 'properties.width', label: 'Width' },
  { fieldKey: 'height', fieldType: 'number', schemaPath: 'properties.height', label: 'Height' },
  { fieldKey: 'engine_hint', fieldType: 'text', schemaPath: 'properties.engine_hint', label: 'Engine hint' },
]

const HTML_VIDEO_RENDERER_PORTS: WidgetRegistryPort[] = [
  { portKey: 'html_in', direction: 'input', schemaPath: 'properties.html' },
  { portKey: 'css_in', direction: 'input', schemaPath: 'properties.css' },
  { portKey: 'data_json_in', direction: 'input', schemaPath: 'properties.data_json' },
  { portKey: 'videoUrl', direction: 'output', schemaPath: 'properties.videoUrl' },
  { portKey: 'outputSrcDoc', direction: 'output', schemaPath: 'properties.outputSrcDoc' },
  { portKey: 'outputPath', direction: 'output', schemaPath: 'properties.outputPath' },
  { portKey: 'renderJobId', direction: 'output', schemaPath: 'properties.renderJobId' },
]

export function buildHtmlVideoRendererRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID,
    widgetTypeId: FLOW_HTML_VIDEO_RENDERER_WIDGET_TYPE_ID,
    formId: FLOW_HTML_VIDEO_RENDERER_FORM_ID,
    fields: HTML_VIDEO_RENDERER_FIELDS,
    ports: HTML_VIDEO_RENDERER_PORTS,
    schemaMappings: [],
  }
}

export function getHtmlVideoRendererWidgetLabel(): string {
  return FLOW_HTML_VIDEO_RENDERER_NODE_LABEL
}
