export type SettingSourceKind = 'store' | 'localStorage' | 'env' | 'backendEnv' | 'eslint'

export type SettingType = 'string' | 'number' | 'boolean'

export interface SettingMeta {
  key: string
  type: SettingType
  source: SettingSourceKind
  read: () => string | number | boolean | null
  write?: (value: string | number | boolean) => void
  docKey?: string
  default?: () => string | number | boolean | null
  options?: string[]
}

export interface FlowDetails {
  area?: string
  modules?: string[]
  classes?: string[]
  functions?: string[]
  responsibility?: string
  imports?: string[]
  notes?: string
  lineRange?: string
}
