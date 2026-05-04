export type MarkdownWorkspaceStatusInfoSetter = (label: string, opts?: { ttlMs?: number }) => void
export type MarkdownWorkspaceStatusErrorSetter = (label: string) => void
export type MarkdownWorkspaceStatusProgressSetter = (
  label: string,
  value?: number,
  max?: number,
  bytesDone?: number,
  bytesTotal?: number,
  opts?: { ttlMs?: number },
) => void
export type MarkdownWorkspaceStatusAutoClearSetter = (label: string, ttlMs?: number) => void

export type MarkdownWorkspaceRuntimeStatusBindings = {
  setStatusInfo: MarkdownWorkspaceStatusInfoSetter
  setStatusError: MarkdownWorkspaceStatusErrorSetter
  setStatusProgress: MarkdownWorkspaceStatusProgressSetter
  setStatusWithAutoClear: MarkdownWorkspaceStatusAutoClearSetter
}

export type MarkdownWorkspaceRuntimeProgressStatusBindings = Pick<
  MarkdownWorkspaceRuntimeStatusBindings,
  'setStatusError' | 'setStatusProgress' | 'setStatusWithAutoClear'
>

export type MarkdownWorkspaceRuntimeInteractionStatusBindings = Pick<
  MarkdownWorkspaceRuntimeStatusBindings,
  'setStatusError' | 'setStatusInfo' | 'setStatusProgress'
>

export function buildMarkdownWorkspaceRuntimeStatusBindings(
  args: MarkdownWorkspaceRuntimeStatusBindings,
): MarkdownWorkspaceRuntimeStatusBindings {
  return args
}
