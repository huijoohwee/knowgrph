export type WorkspaceDocsMirrorLocalRootRequest = {
  absRoot: string
  workspaceRootName?: string
}

const AGENTIC_CANVAS_OS_DOCS_WORKSPACE_ROOT_NAME = 'agentic-canvas-os/docs'

const normalizeRoot = (value: unknown): string => String(value || '').trim()

export function resolveWorkspaceDocsMirrorLocalRootRequests(args: {
  docsAbsRoot: unknown
  agenticDocsAbsRoot: unknown
}): WorkspaceDocsMirrorLocalRootRequest[] {
  const docsAbsRoot = normalizeRoot(args.docsAbsRoot)
  const agenticDocsAbsRoot = normalizeRoot(args.agenticDocsAbsRoot)
  if (!docsAbsRoot) return agenticDocsAbsRoot ? [{ absRoot: agenticDocsAbsRoot }] : []
  const requests: WorkspaceDocsMirrorLocalRootRequest[] = [{ absRoot: docsAbsRoot }]
  if (agenticDocsAbsRoot) {
    requests.push({
      absRoot: agenticDocsAbsRoot,
      workspaceRootName: AGENTIC_CANVAS_OS_DOCS_WORKSPACE_ROOT_NAME,
    })
  }
  return requests
}
