import type { WidgetRegistryField } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  FLOW_EDITOR_IMAGE_MODEL_OPTIONS,
  FLOW_EDITOR_IMAGE_OUTPUT_FORMAT_OPTIONS,
  FLOW_EDITOR_IMAGE_SIZE_OPTIONS,
} from '@/lib/config.flow-editor'

function toFieldOptions(options: ReadonlyArray<{ value: string | number; label: string }>): WidgetRegistryField['options'] {
  return options.map(option => ({
    value: option.value,
    label: option.label,
  }))
}

export function buildBytePlusImageGenerationFields(): WidgetRegistryField[] {
  return [
    {
      fieldKey: 'model',
      fieldType: 'select',
      schemaPath: 'properties.model',
      required: true,
      label: 'Model',
      options: toFieldOptions(FLOW_EDITOR_IMAGE_MODEL_OPTIONS),
    },
    {
      fieldKey: 'prompt',
      fieldType: 'textarea',
      schemaPath: 'properties.prompt',
      required: true,
      label: 'Prompt',
    },
    {
      fieldKey: 'size',
      fieldType: 'select',
      schemaPath: 'properties.size',
      required: true,
      label: 'Size',
      options: toFieldOptions(FLOW_EDITOR_IMAGE_SIZE_OPTIONS),
    },
    {
      fieldKey: 'output_format',
      fieldType: 'select',
      schemaPath: 'properties.output_format',
      required: true,
      label: 'Output format',
      options: toFieldOptions(FLOW_EDITOR_IMAGE_OUTPUT_FORMAT_OPTIONS),
    },
    {
      fieldKey: 'response_format',
      fieldType: 'select',
      schemaPath: 'properties.response_format',
      required: true,
      label: 'Response format',
      options: [
        { value: 'b64_json', label: 'b64_json (Default)' },
        { value: 'url', label: 'url' },
      ],
    },
    {
      fieldKey: 'optimize_prompt_options',
      fieldType: 'select',
      schemaPath: 'properties.optimize_prompt_options',
      label: 'Optimize prompt',
      options: [
        { value: 'fast', label: 'fast (Default)' },
        { value: 'standard', label: 'standard' },
      ],
    },
    {
      fieldKey: 'aspect_ratio',
      fieldType: 'number',
      schemaPath: 'properties.aspect_ratio',
      label: 'Aspect ratio',
    },
    {
      fieldKey: 'stream',
      fieldType: 'boolean',
      schemaPath: 'properties.stream',
      label: 'Stream',
    },
    {
      fieldKey: 'watermark',
      fieldType: 'boolean',
      schemaPath: 'properties.watermark',
      label: 'Watermark',
    },
    {
      fieldKey: 'seed',
      fieldType: 'number',
      schemaPath: 'properties.seed',
      label: 'Seed',
    },
    {
      fieldKey: 'guidance_scale',
      fieldType: 'number',
      schemaPath: 'properties.guidance_scale',
      label: 'Guidance scale',
    },
    {
      fieldKey: 'reference_image',
      fieldType: 'text',
      schemaPath: 'properties.reference_image',
      label: 'Reference image',
    },
  ]
}
