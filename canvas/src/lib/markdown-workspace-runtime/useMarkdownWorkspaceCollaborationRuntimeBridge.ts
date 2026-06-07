import { useP2PCollaborationRuntime } from '@/features/collaboration/useP2PCollaborationRuntime'

type SetActiveMarkdownDocument = (args: {
  name: string
  text: string
  autoEnableFrontmatter?: boolean
  applyViewPreset?: boolean
  normalizeMermaidMmd?: boolean
}) => Promise<boolean>

export const useMarkdownWorkspaceCollaborationRuntimeBridge = (args: {
  active: boolean
  activeDocumentKey: string | null
  activeText: string
  setActiveMarkdownDocument: SetActiveMarkdownDocument
  revealLineInEditor: (line: number) => void
}) => {
  return useP2PCollaborationRuntime({
    active: args.active,
    activeDocumentKey: args.activeDocumentKey,
    activeText: args.activeText,
    applyRemoteDocument: async ({ documentKey, text }) => {
      await args.setActiveMarkdownDocument({
        name: documentKey,
        text,
        normalizeMermaidMmd: false,
        autoEnableFrontmatter: false,
        applyViewPreset: false,
      })
    },
    revealRemoteLine: line => {
      args.revealLineInEditor(line)
    },
  })
}
