import type { WidgetRegistryEntry, WidgetRegistryField, WidgetRegistryPort } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import {
  FLOW_ANNOTATION_ENGINE_FORM_ID,
  FLOW_ANNOTATION_ENGINE_NODE_LABEL,
  FLOW_ANNOTATION_ENGINE_NODE_TYPE_ID,
  FLOW_ANNOTATION_ENGINE_WIDGET_TYPE_ID,
} from '@/lib/config.storyboard-widget'

const ANNOTATION_ENGINE_FIELDS: WidgetRegistryField[] = [
  { fieldKey: 'asset_url', fieldType: 'text', schemaPath: 'properties.asset_url', label: 'Asset URL' },
  { fieldKey: 'asset_type', fieldType: 'text', schemaPath: 'properties.asset_type', label: 'Asset type' },
  { fieldKey: 'tasks', fieldType: 'textarea', schemaPath: 'properties.tasks', label: 'Tasks' },
  { fieldKey: 'model_hint', fieldType: 'text', schemaPath: 'properties.model_hint', label: 'Model hint' },
  { fieldKey: 'frame_timestamp_ms', fieldType: 'number', schemaPath: 'properties.frame_timestamp_ms', label: 'Frame timestamp ms' },
]

const ANNOTATION_ENGINE_PORTS: WidgetRegistryPort[] = [
  { portKey: 'asset_url_in', direction: 'input', schemaPath: 'properties.asset_url' },
  { portKey: 'tasks_in', direction: 'input', schemaPath: 'properties.tasks' },
  { portKey: 'annotation_json', direction: 'output', schemaPath: 'properties.outputPath' },
  { portKey: 'annotationId', direction: 'output', schemaPath: 'properties.annotationId' },
]

export function buildAnnotationEngineRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: FLOW_ANNOTATION_ENGINE_NODE_TYPE_ID,
    widgetTypeId: FLOW_ANNOTATION_ENGINE_WIDGET_TYPE_ID,
    formId: FLOW_ANNOTATION_ENGINE_FORM_ID,
    fields: ANNOTATION_ENGINE_FIELDS,
    ports: ANNOTATION_ENGINE_PORTS,
    schemaMappings: [],
  }
}

export function getAnnotationEngineWidgetLabel(): string {
  return FLOW_ANNOTATION_ENGINE_NODE_LABEL
}
