export type NodeQuickEditorRegistryField = {
  fieldKey: string
  label?: string
  fieldType: string
  schemaPath?: string
  required?: boolean
}

export type NodeQuickEditorRegistryPort = {
  portKey: string
  direction: 'input' | 'output'
  schemaPath?: string
}

export type NodeQuickEditorRegistrySchemaMapping = {
  fromPath: string
  toPath: string
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

