import type { TabSync } from '@/lib/tabSync'

export type CanvasTabSyncBooleanRef = { current: boolean }
export type CanvasTabSyncNumberRef = { current: number }
export type CanvasTabSyncStringRef = { current: string | null }
export type CanvasTabSyncSelectionSnapshot = { n: string | null; e: string | null } | null
export type CanvasTabSyncSelectionRef = { current: CanvasTabSyncSelectionSnapshot }
export type CanvasTabSyncRef = { current: TabSync | null }
