export const createPublishedAgentReadyToolExecutors = (args = {}) => {
  const toolNames = args.toolNames || {}
  const defaultWorkspaceId = String(args.defaultWorkspaceId || '').trim()
  const buildStorageDocPath = args.buildStorageDocPath
  const fetchSourceFilesIndexResponse = args.fetchSourceFilesIndexResponse
  const fetchStorageMarkdownResponse = args.fetchStorageMarkdownResponse
  const resolveSharedDocumentInput = args.resolveSharedDocumentInput
  const inspectSharedDocumentStructure = args.inspectSharedDocumentStructure
  const buildAgentSurfaceInspection = args.buildAgentSurfaceInspection
  const normalizeString = (value) => String(value || '').trim()

  if (typeof buildStorageDocPath !== 'function') {
    throw new Error('buildStorageDocPath is required')
  }
  if (typeof fetchSourceFilesIndexResponse !== 'function') {
    throw new Error('fetchSourceFilesIndexResponse is required')
  }
  if (typeof fetchStorageMarkdownResponse !== 'function') {
    throw new Error('fetchStorageMarkdownResponse is required')
  }
  if (typeof resolveSharedDocumentInput !== 'function') {
    throw new Error('resolveSharedDocumentInput is required')
  }
  if (typeof inspectSharedDocumentStructure !== 'function') {
    throw new Error('inspectSharedDocumentStructure is required')
  }
  if (typeof buildAgentSurfaceInspection !== 'function') {
    throw new Error('buildAgentSurfaceInspection is required')
  }

  const readSourceFile = async (input = {}) => {
    const canonicalPath = normalizeString(input.canonicalPath)
    if (!canonicalPath) {
      throw new Error('canonicalPath is required')
    }
    const workspaceId = normalizeString(input.workspaceId)
    const response = await fetchStorageMarkdownResponse(buildStorageDocPath(canonicalPath, workspaceId))
    if (!response.ok) {
      throw new Error(`read_source_file failed with ${response.status}`)
    }
    return {
      workspaceId: workspaceId || defaultWorkspaceId,
      canonicalPath,
      markdown: await response.text(),
    }
  }

  const readSharedDocument = async (input = {}) => {
    const resolvedDocument = resolveSharedDocumentInput(input)
    if (!resolvedDocument) {
      throw new Error('shareToken or shareUrl must resolve to a published Knowgrph document')
    }
    const workspaceId = normalizeString(resolvedDocument.workspaceId)
    const canonicalPath = normalizeString(resolvedDocument.canonicalPath)
    const response = await fetchStorageMarkdownResponse(buildStorageDocPath(canonicalPath, workspaceId))
    if (!response.ok) {
      throw new Error(`read_shared_document failed with ${response.status}`)
    }
    return {
      workspaceId: workspaceId || defaultWorkspaceId,
      canonicalPath,
      markdown: await response.text(),
    }
  }

  const inspectSharedDocument = async (input = {}) => {
    const sharedDocument = await readSharedDocument(input)
    return inspectSharedDocumentStructure(sharedDocument)
  }

  return {
    [toolNames.listSourceFiles]: async () => {
      const response = await fetchSourceFilesIndexResponse()
      if (!response.ok) {
        throw new Error(`list_source_files failed with ${response.status}`)
      }
      return {
        workspaceId: defaultWorkspaceId,
        markdownIndex: await response.text(),
      }
    },
    [toolNames.readSourceFile]: readSourceFile,
    [toolNames.readSharedDocument]: readSharedDocument,
    [toolNames.inspectSharedDocumentStructure]: inspectSharedDocument,
    [toolNames.inspectAgentSurface]: async () => buildAgentSurfaceInspection(),
  }
}
