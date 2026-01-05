import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'

export type UpdateSettings = (patch: Partial<GraphFieldSettingsResolved>) => void

