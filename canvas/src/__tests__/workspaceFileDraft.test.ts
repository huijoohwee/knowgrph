import {
  getDefaultNewWorkspaceFileName,
  resolveNewWorkspaceFileDraft,
} from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/fileDraft'

export function testResolveNewWorkspaceFileDraftSupportsMarkdownAndJsonLd() {
  if (getDefaultNewWorkspaceFileName() !== 'note.md') {
    throw new Error(`expected markdown default new-file name, got ${String(getDefaultNewWorkspaceFileName())}`)
  }

  const markdown = resolveNewWorkspaceFileDraft('roadmap')
  if (!markdown || markdown.name !== 'roadmap.md' || markdown.text !== '') {
    throw new Error(`expected markdown draft fallback to append .md, got ${JSON.stringify(markdown)}`)
  }

  const jsonld = resolveNewWorkspaceFileDraft('schema.jsonld')
  if (!jsonld || jsonld.name !== 'schema.jsonld' || jsonld.text !== '{\n}\n') {
    throw new Error(`expected jsonld draft to preserve extension and seed JSON text, got ${JSON.stringify(jsonld)}`)
  }

  const invalid = resolveNewWorkspaceFileDraft('   ')
  if (invalid !== null) {
    throw new Error(`expected blank draft name to be rejected, got ${JSON.stringify(invalid)}`)
  }
}
