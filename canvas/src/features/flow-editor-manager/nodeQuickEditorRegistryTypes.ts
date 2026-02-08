export type NodeQuickEditorRegistryField = {
  fieldKey: string
  label?: string
  fieldType: string
  schemaPath?: string
  required?: boolean
  isHidden?: boolean
}

export type NodeQuickEditorRegistryPort = {
  portKey: string
  direction: 'input' | 'output'
  schemaPath?: string
  isHidden?: boolean
}

export type NodeQuickEditorRegistrySchemaMapping = {
  fromPath: string
  toPath: string
  transformId?: string
  reduceId?: string
}

export type NodeQuickEditorRegistryEntry = {
  id: string
  isEnabled: boolean
  nodeTypeId: string
  quickEditorTypeId: string
  formId: string
  fields: NodeQuickEditorRegistryField[]
  ports: NodeQuickEditorRegistryPort[]
  schemaMappings?: NodeQuickEditorRegistrySchemaMapping[]
  updatedAt: string
}
