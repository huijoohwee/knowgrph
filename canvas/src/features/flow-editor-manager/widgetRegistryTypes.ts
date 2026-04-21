export type WidgetRegistryField = {
  fieldKey: string
  label?: string
  fieldType: string
  schemaPath?: string
  required?: boolean
  isHidden?: boolean
}

export type WidgetRegistryPort = {
  portKey: string
  direction: 'input' | 'output'
  schemaPath?: string
  isHidden?: boolean
}

export type WidgetRegistrySchemaMapping = {
  fromPath: string
  toPath: string
  transformId?: string
  reduceId?: string
}

export type WidgetRegistryEntry = {
  id: string
  isEnabled: boolean
  nodeTypeId: string
  widgetTypeId: string
  formId: string
  fields: WidgetRegistryField[]
  ports: WidgetRegistryPort[]
  schemaMappings?: WidgetRegistrySchemaMapping[]
  updatedAt: string
}
