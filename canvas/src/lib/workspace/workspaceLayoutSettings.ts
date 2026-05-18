import { LS_KEYS, type LsStorageKey } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'

export type PrintOrientation = 'portrait' | 'landscape'
export type InsetsSide = 'top' | 'right' | 'bottom' | 'left'
export type PrintInsetGroup = 'pageMarginMm' | 'rootPaddingMm'

type WorkspaceTokenDef = {
  key: string
  cssVar: string
  storageKey: LsStorageKey
  defaultValue: number
  min: number
  max: number
}

type PrintTokenDef = {
  key: string
  storageKey: LsStorageKey
  orientation: PrintOrientation
  group: PrintInsetGroup
  side: InsetsSide
  defaultValue: number
  min: number
  max: number
}

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

const readNumber = (storageKey: LsStorageKey, fallback: number, min: number, max: number): number =>
  clampNumber(
    lsJson<number>(storageKey, fallback, raw =>
      typeof raw === 'number' && Number.isFinite(raw) ? raw : null,
    ),
    min,
    max,
  )

const writeNumber = (storageKey: LsStorageKey, value: number, min: number, max: number): number => {
  const next = clampNumber(Number(value), min, max)
  lsSetJson(storageKey, next)
  return next
}

export const WORKSPACE_LAYOUT_TOKENS: readonly WorkspaceTokenDef[] = [
  {
    key: 'workspace.surface.padding.top',
    cssVar: '--kg-workspace-surface-pad-top',
    storageKey: LS_KEYS.workspaceSurfacePadTopRem,
    defaultValue: 0.5,
    min: 0,
    max: 6,
  },
  {
    key: 'workspace.surface.padding.right',
    cssVar: '--kg-workspace-surface-pad-right',
    storageKey: LS_KEYS.workspaceSurfacePadRightRem,
    defaultValue: 0.25,
    min: 0,
    max: 6,
  },
  {
    key: 'workspace.surface.padding.bottom',
    cssVar: '--kg-workspace-surface-pad-bottom',
    storageKey: LS_KEYS.workspaceSurfacePadBottomRem,
    defaultValue: 0.5,
    min: 0,
    max: 6,
  },
  {
    key: 'workspace.surface.padding.left',
    cssVar: '--kg-workspace-surface-pad-left',
    storageKey: LS_KEYS.workspaceSurfacePadLeftRem,
    defaultValue: 0.25,
    min: 0,
    max: 6,
  },
  {
    key: 'workspace.surface.margin.top',
    cssVar: '--kg-workspace-surface-margin-top',
    storageKey: LS_KEYS.workspaceSurfaceMarginTopRem,
    defaultValue: 0,
    min: 0,
    max: 6,
  },
  {
    key: 'workspace.surface.margin.right',
    cssVar: '--kg-workspace-surface-margin-right',
    storageKey: LS_KEYS.workspaceSurfaceMarginRightRem,
    defaultValue: 0,
    min: 0,
    max: 6,
  },
  {
    key: 'workspace.surface.margin.bottom',
    cssVar: '--kg-workspace-surface-margin-bottom',
    storageKey: LS_KEYS.workspaceSurfaceMarginBottomRem,
    defaultValue: 0,
    min: 0,
    max: 6,
  },
  {
    key: 'workspace.surface.margin.left',
    cssVar: '--kg-workspace-surface-margin-left',
    storageKey: LS_KEYS.workspaceSurfaceMarginLeftRem,
    defaultValue: 0,
    min: 0,
    max: 6,
  },
  {
    key: 'workspace.surface.gap',
    cssVar: '--kg-workspace-surface-gap',
    storageKey: LS_KEYS.workspaceSurfaceGapRem,
    defaultValue: 0.25,
    min: 0,
    max: 6,
  },
  {
    key: 'workspace.split.divider.gap',
    cssVar: '--kg-workspace-split-divider-gap',
    storageKey: LS_KEYS.workspaceSplitDividerGapRem,
    defaultValue: 0.25,
    min: 0,
    max: 6,
  },
] as const

export const PRINT_LAYOUT_TOKENS: readonly PrintTokenDef[] = [
  { key: 'print.portrait.pageMargin.top', storageKey: LS_KEYS.printPortraitPageMarginTopMm, orientation: 'portrait', group: 'pageMarginMm', side: 'top', defaultValue: 12, min: 0, max: 40 },
  { key: 'print.portrait.pageMargin.right', storageKey: LS_KEYS.printPortraitPageMarginRightMm, orientation: 'portrait', group: 'pageMarginMm', side: 'right', defaultValue: 2.25, min: 0, max: 40 },
  { key: 'print.portrait.pageMargin.bottom', storageKey: LS_KEYS.printPortraitPageMarginBottomMm, orientation: 'portrait', group: 'pageMarginMm', side: 'bottom', defaultValue: 12, min: 0, max: 40 },
  { key: 'print.portrait.pageMargin.left', storageKey: LS_KEYS.printPortraitPageMarginLeftMm, orientation: 'portrait', group: 'pageMarginMm', side: 'left', defaultValue: 2.25, min: 0, max: 40 },
  { key: 'print.portrait.rootPadding.top', storageKey: LS_KEYS.printPortraitRootPaddingTopMm, orientation: 'portrait', group: 'rootPaddingMm', side: 'top', defaultValue: 10, min: 0, max: 40 },
  { key: 'print.portrait.rootPadding.right', storageKey: LS_KEYS.printPortraitRootPaddingRightMm, orientation: 'portrait', group: 'rootPaddingMm', side: 'right', defaultValue: 2, min: 0, max: 40 },
  { key: 'print.portrait.rootPadding.bottom', storageKey: LS_KEYS.printPortraitRootPaddingBottomMm, orientation: 'portrait', group: 'rootPaddingMm', side: 'bottom', defaultValue: 10, min: 0, max: 40 },
  { key: 'print.portrait.rootPadding.left', storageKey: LS_KEYS.printPortraitRootPaddingLeftMm, orientation: 'portrait', group: 'rootPaddingMm', side: 'left', defaultValue: 2, min: 0, max: 40 },
  { key: 'print.landscape.pageMargin.top', storageKey: LS_KEYS.printLandscapePageMarginTopMm, orientation: 'landscape', group: 'pageMarginMm', side: 'top', defaultValue: 9, min: 0, max: 40 },
  { key: 'print.landscape.pageMargin.right', storageKey: LS_KEYS.printLandscapePageMarginRightMm, orientation: 'landscape', group: 'pageMarginMm', side: 'right', defaultValue: 6, min: 0, max: 40 },
  { key: 'print.landscape.pageMargin.bottom', storageKey: LS_KEYS.printLandscapePageMarginBottomMm, orientation: 'landscape', group: 'pageMarginMm', side: 'bottom', defaultValue: 9, min: 0, max: 40 },
  { key: 'print.landscape.pageMargin.left', storageKey: LS_KEYS.printLandscapePageMarginLeftMm, orientation: 'landscape', group: 'pageMarginMm', side: 'left', defaultValue: 6, min: 0, max: 40 },
  { key: 'print.landscape.rootPadding.top', storageKey: LS_KEYS.printLandscapeRootPaddingTopMm, orientation: 'landscape', group: 'rootPaddingMm', side: 'top', defaultValue: 8, min: 0, max: 40 },
  { key: 'print.landscape.rootPadding.right', storageKey: LS_KEYS.printLandscapeRootPaddingRightMm, orientation: 'landscape', group: 'rootPaddingMm', side: 'right', defaultValue: 5, min: 0, max: 40 },
  { key: 'print.landscape.rootPadding.bottom', storageKey: LS_KEYS.printLandscapeRootPaddingBottomMm, orientation: 'landscape', group: 'rootPaddingMm', side: 'bottom', defaultValue: 8, min: 0, max: 40 },
  { key: 'print.landscape.rootPadding.left', storageKey: LS_KEYS.printLandscapeRootPaddingLeftMm, orientation: 'landscape', group: 'rootPaddingMm', side: 'left', defaultValue: 5, min: 0, max: 40 },
] as const

const workspaceTokenByKey = new Map(WORKSPACE_LAYOUT_TOKENS.map(token => [token.key, token] as const))
const printTokenByKey = new Map(PRINT_LAYOUT_TOKENS.map(token => [token.key, token] as const))

export const readWorkspaceLayoutToken = (key: string): number => {
  const token = workspaceTokenByKey.get(key)
  if (!token) return 0
  return readNumber(token.storageKey, token.defaultValue, token.min, token.max)
}

export const writeWorkspaceLayoutToken = (key: string, value: number): number => {
  const token = workspaceTokenByKey.get(key)
  if (!token) return 0
  const next = writeNumber(token.storageKey, value, token.min, token.max)
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(token.cssVar, `${next}rem`)
  }
  return next
}

export const ensureWorkspaceLayoutTokensInstalled = (): void => {
  if (typeof document === 'undefined') return
  const rootStyle = document.documentElement.style
  WORKSPACE_LAYOUT_TOKENS.forEach(token => {
    const value = readNumber(token.storageKey, token.defaultValue, token.min, token.max)
    rootStyle.setProperty(token.cssVar, `${value}rem`)
  })
}

export const readPrintLayoutToken = (key: string): number => {
  const token = printTokenByKey.get(key)
  if (!token) return 0
  return readNumber(token.storageKey, token.defaultValue, token.min, token.max)
}

export const writePrintLayoutToken = (key: string, value: number): number => {
  const token = printTokenByKey.get(key)
  if (!token) return 0
  return writeNumber(token.storageKey, value, token.min, token.max)
}

export const resolvePrintInsetsMm = (
  orientation: PrintOrientation,
  group: PrintInsetGroup,
): Record<InsetsSide, number> => {
  const selected = PRINT_LAYOUT_TOKENS.filter(token => token.orientation === orientation && token.group === group)
  const fallback: Record<InsetsSide, number> = { top: 0, right: 0, bottom: 0, left: 0 }
  selected.forEach(token => {
    fallback[token.side] = readNumber(token.storageKey, token.defaultValue, token.min, token.max)
  })
  return fallback
}
