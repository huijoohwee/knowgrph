export type WorkspaceMirrorRootEntry = {
  relPath: string
  text: string
  updatedAtMs: number
}

type RootReader = (absRoot: string) => Promise<WorkspaceMirrorRootEntry[]>

const normalizeMirrorRootText = (value: string): string =>
  String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')

const normalizeMirrorRelPath = (value: string): string =>
  normalizeMirrorRootText(value).replace(/^\/+/, '')

const prefixWorkspaceMirrorEntries = (
  entries: ReadonlyArray<WorkspaceMirrorRootEntry>,
  workspaceRootName?: string,
): WorkspaceMirrorRootEntry[] => {
  const root = normalizeMirrorRelPath(workspaceRootName || '')
  return (Array.isArray(entries) ? entries : [])
    .map(entry => {
      const relPath = normalizeMirrorRelPath(String(entry?.relPath || ''))
      if (!relPath) return null
      return { ...entry, relPath: root ? `${root}/${relPath}` : relPath }
    })
    .filter((entry): entry is WorkspaceMirrorRootEntry => !!entry)
}

export async function readWorkspaceMirrorRootEntries(args: {
  absRoot: string
  workspaceRootName?: string
  readViaProxy: RootReader
  readViaNodeFs: RootReader
}): Promise<WorkspaceMirrorRootEntry[]> {
  const absRoot = normalizeMirrorRootText(args.absRoot)
  if (!absRoot) return []
  const viaProxy = await args.readViaProxy(absRoot)
  if (viaProxy.length > 0) return prefixWorkspaceMirrorEntries(viaProxy, args.workspaceRootName)
  if (typeof window !== 'undefined') return []
  return prefixWorkspaceMirrorEntries(await args.readViaNodeFs(absRoot), args.workspaceRootName)
}
