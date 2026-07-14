import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import {
  IMAGE_TO_THREEJS_SKILL_FORM_ID,
  IMAGE_TO_THREEJS_SKILL_NODE_TYPE_ID,
  IMAGE_TO_THREEJS_SKILL_WIDGET_TYPE_ID,
} from './imageToThreeJsContract'

export function buildImageToThreeJsSkillRegistryDraft(): Omit<WidgetRegistryEntry, 'updatedAt'> {
  return {
    id: '',
    isEnabled: true,
    nodeTypeId: IMAGE_TO_THREEJS_SKILL_NODE_TYPE_ID,
    widgetTypeId: IMAGE_TO_THREEJS_SKILL_WIDGET_TYPE_ID,
    formId: IMAGE_TO_THREEJS_SKILL_FORM_ID,
    fields: [
      { fieldKey: 'sourceImageUrl', fieldType: 'text', schemaPath: 'properties.sourceImageUrl', required: true, label: 'PNG, JPG, or SVG URL' },
      { fieldKey: 'imageUrl', fieldType: 'text', schemaPath: 'properties.imageUrl', label: 'Three.js render source' },
      { fieldKey: 'output', fieldType: 'textarea', schemaPath: 'properties.output', label: 'Conversion manifest' },
    ],
    ports: [
      { portKey: 'image_in', direction: 'input', schemaPath: 'properties.sourceImageUrl' },
      { portKey: 'imageUrl', direction: 'output', schemaPath: 'properties.imageUrl' },
      { portKey: 'manifest_out', direction: 'output', schemaPath: 'properties.output' },
    ],
    schemaMappings: [],
  }
}
