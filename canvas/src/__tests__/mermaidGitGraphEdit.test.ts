import {
  appendMermaidGitGraphCommand,
  deleteMermaidGitGraphCommandLine,
  findMermaidGitGraphCommandForLabel,
  parseMermaidGitGraphModel,
  replaceMermaidGitGraphCodeInMarkdown,
  updateMermaidGitGraphCommandLine,
} from '@/lib/mermaid/mermaidGitGraphEdit'
import { buildVersionHistoryGitGraphCode, readVersionHistoryIndexFromCommitId } from '@/features/gitgraph/versionHistoryGitGraph'
import type { VersionHistoryEntry } from '@/features/history/versionHistoryTypes'
import { parseMermaidDiagramCodeModel } from '@/lib/mermaid/mermaidDiagramCode'
import { findGitGraphCommandForRowKey, resolveGitGraphCommandRowKey } from '@/lib/mermaid/mermaidGitGraphSelection'

const sampleGitGraphCode = [
  '---',
  'config:',
  '  theme: base',
  '---',
  'gitGraph LR',
  '  commit id:"root" tag:"v1" type:HIGHLIGHT',
  '  branch feature',
  '  checkout feature',
  '  commit id:"feature_a"',
  '  checkout main',
  '  merge feature',
  '  cherry-pick id:"root" parent:"feature_a"',
].join('\n')

export function testMermaidGitGraphEditParsesCrudCommandsAndFindsSvgLabel() {
  const model = parseMermaidGitGraphModel(sampleGitGraphCode)
  if (model.declarationLineIndex !== 4) {
    throw new Error(`expected GitGraph declaration after Mermaid config header, got ${model.declarationLineIndex}`)
  }
  if (model.commands.length !== 7) {
    throw new Error(`expected seven editable GitGraph commands, got ${model.commands.length}`)
  }
  const commit = findMermaidGitGraphCommandForLabel(model.commands, 'feature_a')
  if (!commit || commit.kind !== 'commit' || commit.commitId !== 'feature_a') {
    throw new Error('expected SVG label lookup to resolve commit id to an editable command')
  }
  const branch = findMermaidGitGraphCommandForLabel(model.commands, 'feature')
  if (!branch || branch.kind !== 'branch' || branch.target !== 'feature') {
    throw new Error('expected SVG label lookup to resolve branch label to an editable command')
  }
  const cherryPick = model.commands.find(command => command.kind === 'cherry-pick') || null
  if (!cherryPick || cherryPick.commitId !== 'root' || cherryPick.parent !== 'feature_a') {
    throw new Error('expected cherry-pick id and parent attrs to be parsed')
  }
}

export function testMermaidGitGraphEditUpdatesAddsAndDeletesCommands() {
  const model = parseMermaidGitGraphModel(sampleGitGraphCode)
  const root = findMermaidGitGraphCommandForLabel(model.commands, 'root')
  if (!root) throw new Error('expected root commit command')

  const updated = updateMermaidGitGraphCommandLine(sampleGitGraphCode, root.lineIndex, 'commit id:"root_renamed" tag:"v2"')
  if (!updated.includes('  commit id:"root_renamed" tag:"v2"')) {
    throw new Error('expected command update to preserve indentation and replace the selected command')
  }
  if (updated.includes('id:"root" tag:"v1"')) {
    throw new Error('expected old command text to be removed')
  }

  const withCommit = appendMermaidGitGraphCommand(updated, 'commit')
  if (!withCommit.endsWith('  commit id:"commit_1"')) {
    throw new Error('expected append commit to generate a neutral unique commit id')
  }
  const withBranch = appendMermaidGitGraphCommand(withCommit, 'branch')
  if (!withBranch.endsWith('  branch branch_1')) {
    throw new Error('expected append branch to generate a neutral unique branch name')
  }
  const withMerge = appendMermaidGitGraphCommand(withBranch, 'merge')
  if (!withMerge.endsWith('  merge feature')) {
    throw new Error('expected append merge to target an existing branch')
  }
  const withCherryPick = appendMermaidGitGraphCommand(withMerge, 'cherry-pick')
  if (!withCherryPick.endsWith('  cherry-pick id:"root_renamed"')) {
    throw new Error('expected append cherry-pick to target an existing commit id')
  }

  const branch = findMermaidGitGraphCommandForLabel(parseMermaidGitGraphModel(withCherryPick).commands, 'branch_1')
  if (!branch) throw new Error('expected generated branch command')
  const deleted = deleteMermaidGitGraphCommandLine(withCherryPick, branch.lineIndex)
  if (deleted.includes('branch branch_1')) {
    throw new Error('expected delete command to remove the selected GitGraph command line')
  }
}

export function testMermaidGitGraphEditReplacesYamlMermaidFrontmatterOnly() {
  const markdown = [
    '---',
    'title: Demo',
    'mermaid: |',
    '  flowchart LR',
    '    A --> B',
    'kgCanvas2dRenderer: "gitGraph"',
    '---',
    '',
    '# Body',
  ].join('\n')
  const replaced = replaceMermaidGitGraphCodeInMarkdown(markdown, 'gitGraph\n  commit id:"root"')
  if (!replaced.includes('title: Demo')) {
    throw new Error('expected unrelated frontmatter keys to be preserved')
  }
  if (!replaced.includes('kgCanvas2dRenderer: "gitGraph"')) {
    throw new Error('expected following top-level frontmatter keys to be preserved')
  }
  if (!replaced.includes('mermaid: |\n  gitGraph\n    commit id:"root"')) {
    throw new Error('expected mermaid YAML block to be replaced with GitGraph code')
  }
  if (replaced.includes('flowchart LR')) {
    throw new Error('expected stale Mermaid code to be removed from the mermaid frontmatter section')
  }
  if (!replaced.endsWith('\n# Body')) {
    throw new Error('expected markdown body to be preserved')
  }
}

export function testMermaidGitGraphEditCreatesFrontmatterWhenMissing() {
  const replaced = replaceMermaidGitGraphCodeInMarkdown('# Body', 'gitGraph\n  commit id:"root"')
  if (!replaced.startsWith('---\nmermaid: |\n  gitGraph\n    commit id:"root"\n---\n\n# Body')) {
    throw new Error('expected GitGraph frontmatter to be created when markdown has no YAML block')
  }
}

export function testVersionHistoryGitGraphUsesCanonicalDeclaration() {
  const graphData = { type: 'Graph' as const, nodes: [], edges: [] }
  const history: VersionHistoryEntry[] = [{
    id: 'h1',
    parentId: null,
    label: 'Initial version',
    timestamp: 1,
    source: 'manual',
    contentSignature: 'signature-1',
    graphData,
    graphFieldSettingsById: {},
    markdownDocumentName: null,
    markdownDocumentText: null,
    activeSourceFileSnapshot: null,
  }]
  const code = buildVersionHistoryGitGraphCode(history)
  if (!code.startsWith('gitGraph\n  commit')) {
    throw new Error(`expected canonical GitGraph declaration, got ${JSON.stringify(code.split('\n')[0])}`)
  }
  if (/^gitGraph\s+(?:LR|TB|BT)(?!:)/m.test(code)) {
    throw new Error('expected version-history GitGraph not to emit an unpunctuated orientation suffix')
  }
  if (readVersionHistoryIndexFromCommitId('version_1') !== 0 || readVersionHistoryIndexFromCommitId('version_2') !== 1) {
    throw new Error('expected generated GitGraph commit ids to map to zero-based history indexes')
  }
  if (readVersionHistoryIndexFromCommitId('authored_commit') !== -1) {
    throw new Error('expected authored GitGraph commit ids not to resolve as runtime history versions')
  }
  const diagramModel = parseMermaidDiagramCodeModel(code, 'gitgraph')
  const commandModel = parseMermaidGitGraphModel(code)
  const firstCommand = commandModel.commands[0]
  const rowKey = resolveGitGraphCommandRowKey(firstCommand, 0, diagramModel)
  const selectedCommand = findGitGraphCommandForRowKey(commandModel.commands, rowKey, diagramModel)
  if (readVersionHistoryIndexFromCommitId(selectedCommand?.commitId) !== 0) {
    throw new Error('expected a derived Chart row key to resolve back to its runtime history index')
  }
}
