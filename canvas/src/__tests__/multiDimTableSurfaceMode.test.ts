import fs from 'node:fs'
import path from 'node:path'
import {
  applyStructuredSourceDataViewReplacement,
  buildStructuredSourceDataViewProjection,
  buildMarkdownPipeTableFromStructuredSourceMetadata,
} from '@/features/markdown-workspace/main/viewer/sourceStructuredDataViewTable'
import { coerceWorkspaceDataViewConfig } from '@/features/markdown-workspace/main/viewer/workspaceDataViewConfig'

const readQuotedYamlValue = (line: string): string =>
  String(line || '')
    .replace(/^[^:]+:\s*/, '')
    .trim()
    .replace(/^['"]|['"]$/g, '')

const removedWorkspaceFilename = ['Graph', 'Table', 'Workspace', '.impl.tsx'].join('')
const forbiddenFallbackTokens = [
  ['graph', 'Data', 'Markdown', 'Table'].join(''),
  ['build', 'Graph', 'Data', 'Markdown', 'Table'].join(''),
  ['has', 'Spec', 'Markdown', 'Table'].join(''),
  ['graph', 'Data', ': s.graphData'].join(''),
]
const forbiddenWorkspaceModeToken = ['graph', 'Table', 'View', 'Mode'].join('')
export function testMultiDimTableSurfacePreservesWorkspaceModeOwners() {
  const workspacePath = path.resolve(process.cwd(), 'src', 'lib', ['graph', '-', 'table'].join(''), 'ui', removedWorkspaceFilename)
  const surfacePath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'MultiDimTableSurface.tsx')
  const workspaceModePath = path.resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceEditorMode.ts')
  const surfaceText = fs.readFileSync(surfacePath, { encoding: 'utf8' })
  const workspaceModeText = fs.readFileSync(workspaceModePath, { encoding: 'utf8' })

  if (fs.existsSync(workspacePath)) {
    throw new Error('expected removed legacy table workspace runtime to stay deleted')
  }
  if (!surfaceText.includes('MarkdownWorkspaceDerivedViewer') || !surfaceText.includes('viewerMode="multiDimTable"')) {
    throw new Error('expected MultiDimTableSurface to reuse the Markdown workspace derived-viewer owner')
  }
  if (!surfaceText.includes('replaceMarkdownLineRange') || !surfaceText.includes('setMarkdownDocument') || !surfaceText.includes('writeWorkspaceSourceTextIfPresent')) {
    throw new Error('expected MultiDimTableSurface inline edits to reuse shared Markdown viewer mutation utilities')
  }
  if (!surfaceText.includes('resolvePreferredComposedSourceRawText') || !surfaceText.includes('readComposedSourceFilePath')) {
    throw new Error('expected MultiDimTableSurface to read refreshed Source Files text through the shared composed-source owner')
  }
  if (
    forbiddenFallbackTokens.some(token => surfaceText.includes(token))
  ) {
    throw new Error('expected MultiDimTableSurface to avoid graph-data table fallback/backfill coupling')
  }
  if (!surfaceText.includes('buildStructuredSourceDataViewProjection') || !surfaceText.includes('applyStructuredSourceDataViewReplacement')) {
    throw new Error('expected MultiDimTableSurface to render and edit source-structured tables through the shared Viewer mutation path')
  }
  if (!surfaceText.includes('sourceStructuredProjection?.markdownText')) {
    throw new Error('expected MultiDimTableSurface to keep source-structured Markdown tables as the rendered surface owner')
  }
  if (!surfaceText.includes('disableViewerMutations={!canMutate}') || surfaceText.includes('disableViewerMutations={true}')) {
    throw new Error('expected MultiDimTableSurface to keep Markdown-backed data views editable')
  }
  if (!surfaceText.includes('onInlineDraftTextChange={handleInlineDraftTextChange}') || !surfaceText.includes('onReplaceLineRange={handleReplaceLineRange}')) {
    throw new Error('expected MultiDimTableSurface to wire the shared Viewer WYSIWYG edit callbacks')
  }
  if (!workspaceModeText.includes('export function toWorkspaceBackedTableViewMode(')) {
    throw new Error('expected workspace editor mode module to expose the shared workspace->table mode mapper')
  }
  if (!workspaceModeText.includes('export function toWorkspaceEditorModeFromTableViewMode(')) {
    throw new Error('expected workspace editor mode module to expose the shared table->workspace mode mapper')
  }
  const derivedViewerPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'MarkdownWorkspaceDerivedViewer.tsx')
  const dataViewCandidatesPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'markdownWorkspaceDataViewCandidates.ts')
  const dataViewTablePath = path.resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'MarkdownDataViewTableView.tsx')
  const derivedViewerText = fs.readFileSync(derivedViewerPath, { encoding: 'utf8' })
  const dataViewCandidatesText = fs.readFileSync(dataViewCandidatesPath, { encoding: 'utf8' })
  const dataViewTableText = fs.readFileSync(dataViewTablePath, { encoding: 'utf8' })
  if (!dataViewCandidatesText.includes('structuredSource?: boolean') || !dataViewCandidatesText.includes("normalized === 'markdown yaml frontmatter'") || !dataViewCandidatesText.includes("normalized === 'markdown body'")) {
    throw new Error('expected data-view candidates to tag generated structured-source tables without file-specific conditions')
  }
  if (!derivedViewerText.includes('renderAllRows={selected.structuredSource === true}')) {
    throw new Error('expected derived viewer to render source-structured Multi-dimensional Table rows without progressive row hiding')
  }
  if (!dataViewTableText.includes('renderAllRows?: boolean') || !dataViewTableText.includes('props.renderAllRows ? view.rows : view.rows.slice')) {
    throw new Error('expected MarkdownDataViewTableView to preserve default progressive rendering behind a source-table opt-in')
  }
}

export function testMultiDimTableStructuredSourceMetadataBuildsVisibleTable() {
  const nestedKey = ['renderer', 'Modes'].join('')
  const nestedPrefix = 'Renderer'
  const sourceText = [
    'title: "Runnable Demo"',
    'graphId: "md:runnable-demo"',
    'status: active',
    'date: "2026-06-13"',
    `${nestedKey}:`,
    `  - "${nestedPrefix}: Storyboard"`,
    `  - "${nestedPrefix}: Flow Editor"`,
    'surfaces:',
    '  - "2D Renderer: Storyboard"',
    '  - "2D Renderer: Multi-dimensional Table"',
    'flow:',
    '  nodes:',
    '    - id: {key: id, type: string, value: "typed_node"}',
    '      type: StoryboardElement',
    '      label: "Opening beat"',
    '      properties:',
    '        lane: "Storyboard"',
    '        "kgc:readingSummary": "Opening summary"',
    '        action: "Review source"',
    '',
    '# Runnable Demo',
    '',
    'Body content stays source-owned.',
    '',
    '## Body Table',
    '',
    '| Stage | Owner |',
    '| Import | Launch |',
    '| Render | Multi-dimensional Table |',
  ].join('\n')
  const table = buildMarkdownPipeTableFromStructuredSourceMetadata(sourceText)
  if (!table) throw new Error('expected leading structured source metadata to build a Markdown data-view table')
  if (table.includes('| Line | Indent | Content |')) {
    throw new Error(`expected structured source tables to present source content before line metadata, got:\n${table}`)
  }
  if (!table.includes('| L0 | L1 | L2 | L3 | L4 | Key | Type | Value | Summary | Output | Action | Reference Pack | Source Value | Level | Content | Line | Indent |') || !table.includes('| date |  |  |  |  | date | scalar | 2026-06-13 |  |  |  |  | 2026-06-13 | L0 | date: "2026-06-13" | 4 | 0 |')) {
    throw new Error(`expected structured source metadata table to expose frontmatter as key/value rows, got:\n${table}`)
  }
  if (!table.includes(`| ${nestedKey} |  |  |  |  | ${nestedKey} | map |  |  |  |  |  |  | L0 | ${nestedKey}: | 5 | 0 |`) || !table.includes(`| ${nestedKey} | ${nestedPrefix} |  |  |  | ${nestedPrefix} | list | Storyboard |  |  |  |  | ${nestedPrefix}: Storyboard | L1 | - "${nestedPrefix}: Storyboard" | 6 | 2 |`) || !table.includes(`| ${nestedKey} | ${nestedPrefix} |  |  |  | ${nestedPrefix} | list | Flow Editor |  |  |  |  | ${nestedPrefix}: Flow Editor | L1 | - "${nestedPrefix}: Flow Editor" | 7 | 2 |`)) {
    throw new Error(`expected structured source metadata table to expose nested YAML list values as hierarchy rows, got:\n${table}`)
  }
  if (!table.includes('| surfaces |  |  |  |  | surfaces | map |  |  |  |  |  |  | L0 | surfaces: | 8 | 0 |') || !table.includes('| surfaces | 2D Renderer |  |  |  | 2D Renderer | list | Storyboard |  |  |  |  | 2D Renderer: Storyboard | L1 | - "2D Renderer: Storyboard" | 9 | 2 |')) {
    throw new Error(`expected structured source metadata table to preserve structural YAML source lines, got:\n${table}`)
  }
  if (!table.includes('| flow | nodes | id |  |  | id | string | typed_node |  |  |  |  | {key: id, type: string, value: "typed_node"} | L2 | - id: {key: id, type: string, value: "typed_node"} | 13 | 4 |') || !table.includes('| flow | nodes | id | properties | lane | lane | scalar | Storyboard |  |  |  |  | Storyboard | L4 | lane: "Storyboard" | 17 | 8 |')) {
    throw new Error(`expected YAML list-map rows to preserve native - key: value hierarchy, got:\n${table}`)
  }
  if (!table.includes('| flow | nodes | id |  |  | id | string | typed_node |  |  |  |  | {key: id, type: string, value: "typed_node"} | L2 | - id: {key: id, type: string, value: "typed_node"} | 13 | 4 |')) {
    throw new Error(`expected YAML list-map rows with typed inline maps to be visible as native source rows, got:\n${table}`)
  }
  if (!table.includes('| flow | nodes | id | properties | kgc:readingSummary | kgc:readingSummary | scalar | Opening summary | Opening summary |  |  |  | Opening summary | L4 | "kgc:readingSummary": "Opening summary" | 18 | 8 |') || !table.includes('| flow | nodes | id | properties | action | action | scalar | Review source |  |  | Review source |  | Review source | L4 | action: "Review source" | 19 | 8 |')) {
    throw new Error(`expected structured source metadata table to derive Summary and Action columns from YAML-native fields, got:\n${table}`)
  }
  if (!table.includes('## Markdown YAML Frontmatter') || table.includes('## Storyboard Cards')) {
    throw new Error(`expected structured source metadata table to expose only Markdown YAML Frontmatter and Markdown Body tables, got:\n${table}`)
  }
  if (!table.includes('## Markdown Body') || !table.includes('| # Runnable Demo | 21 | 0 |') || !table.includes('| Body content stays source-owned. | 23 | 0 |')) {
    throw new Error(`expected structured source metadata table to preserve Markdown body lines, got:\n${table}`)
  }
  if (!table.includes('| \\| Stage \\| Owner \\| | 27 | 0 |') || !table.includes('| \\| Render \\| Multi-dimensional Table \\| | 29 | 0 |')) {
    throw new Error(`expected structured source metadata table to preserve Markdown pipe table lines once in the body table, got:\n${table}`)
  }
  const projection = buildStructuredSourceDataViewProjection(sourceText)
  if (!projection) throw new Error('expected source projection')
  const metadataReplacement = projection.replacements.find(replacement => replacement.kind === 'metadata')
  if (!metadataReplacement) throw new Error('expected Markdown YAML Frontmatter replacement map')
  const bodyReplacement = projection.replacements.find(replacement => replacement.kind === 'body')
  if (!bodyReplacement) throw new Error('expected Markdown body replacement map')
  if (projection.replacements.length !== 2 || projection.replacements.some(replacement => replacement.kind !== 'metadata' && replacement.kind !== 'body')) {
    throw new Error(`expected only Markdown YAML Frontmatter and Markdown Body replacement maps, got ${projection.replacements.map(replacement => replacement.kind).join(', ')}`)
  }
  const projectedLineCount = projection.replacements.reduce((count, replacement) => count + (replacement.sourceLineByRowIndex?.length || 0), 0)
  const sourceLineCount = sourceText.split('\n').length
  if (projectedLineCount !== sourceLineCount) {
    throw new Error(`expected source projection to cover every source line once, got ${projectedLineCount}/${sourceLineCount}`)
  }
  const nextMetadata = applyStructuredSourceDataViewReplacement({
    sourceText,
    projection,
    startLine: metadataReplacement.generatedStartLine,
    endLine: metadataReplacement.generatedEndLine,
    replacementLines: [
      '| L0 | L1 | L2 | L3 | L4 | Key | Type | Value | Level | Content | Line | Indent |',
      '| -- | -- | -- | -- | -- | --- | ---- | ----- | ----- | ------- | ---- | ------ |',
      '| title |  |  |  |  | title | scalar | Runnable Demo | L0 | title: "Runnable Demo" | 1 | 0 |',
      '| graphId |  |  |  |  | graphId | scalar | md:runnable-demo | L0 | graphId: "md:runnable-demo" | 2 | 0 |',
      '| status |  |  |  |  | status | scalar | active | L0 | status: active | 3 | 0 |',
      '| date |  |  |  |  | date | scalar | 2026-06-14 | L0 | date: "2026-06-13" | 4 | 0 |',
      `| ${nestedKey} | ${nestedPrefix} |  |  |  | ${nestedPrefix} | list | Kanban | L1 | - "${nestedPrefix}: Storyboard" | 6 | 2 |`,
    ],
  })
  if (!nextMetadata?.includes('date: "2026-06-14"') || !nextMetadata.includes(`- "${nestedPrefix}: Kanban"`) || !nextMetadata.includes('# Runnable Demo')) {
    throw new Error(`expected YAML Frontmatter key/value edit to write back while preserving body, got:\n${nextMetadata}`)
  }
  const nextListMap = applyStructuredSourceDataViewReplacement({
    sourceText,
    projection,
    startLine: metadataReplacement.generatedStartLine,
    endLine: metadataReplacement.generatedEndLine,
    replacementLines: [
      '| L0 | L1 | L2 | L3 | L4 | Key | Type | Value | Level | Content | Line | Indent |',
      '| -- | -- | -- | -- | -- | --- | ---- | ----- | ----- | ------- | ---- | ------ |',
      '| flow | nodes | id |  |  | id | string | storyboard_card_2 | L2 | - id: {key: id, type: string, value: "typed_node"} | 13 | 4 |',
    ],
  })
  if (!nextListMap?.includes('    - id: {key: id, type: string, value: "storyboard_card_2"}') || nextListMap.includes('    - id: "storyboard_card_2"')) {
    throw new Error(`expected YAML list-map edit to preserve native - key: value syntax, got:\n${nextListMap}`)
  }
  const nextBody = applyStructuredSourceDataViewReplacement({
    sourceText,
    projection,
    startLine: bodyReplacement.generatedStartLine,
    endLine: bodyReplacement.generatedEndLine,
    replacementLines: [
      '| Content | Line | Indent |',
      '| ------- | ---- | ------ |',
      '| # Runnable Demo | 21 | 0 |',
      '|  | 22 | 0 |',
      '| Body content was edited inline. | 23 | 0 |',
    ],
  })
  if (!nextBody?.includes('Body content was edited inline.')) {
    throw new Error(`expected structured source body edit to write back through source lines, got:\n${nextBody}`)
  }
  const nextPipe = applyStructuredSourceDataViewReplacement({
    sourceText,
    projection,
    startLine: bodyReplacement.generatedStartLine,
    endLine: bodyReplacement.generatedEndLine,
    replacementLines: [
      '| Content | Line | Indent |',
      '| ------- | ---- | ------ |',
      '| # Runnable Demo | 21 | 0 |',
      '|  | 22 | 0 |',
      '| Body content stays source-owned. | 23 | 0 |',
      '|  | 24 | 0 |',
      '| ## Body Table | 25 | 0 |',
      '|  | 26 | 0 |',
      '| \\| Stage \\| Owner \\| | 27 | 0 |',
      '| \\| Import \\| Launch \\| | 28 | 0 |',
      '| \\| Render \\| Edited Owner \\| | 29 | 0 |',
    ],
  })
  if (!nextPipe?.includes('| Render | Edited Owner |')) {
    throw new Error(`expected structured source pipe table edit to write back through source table lines, got:\n${nextPipe}`)
  }
}

export function testMultiDimTableYamlFrontmatterReflectsStrybldrValidationSource() {
  const sourcePath = path.resolve(process.cwd(), '..', '..', 'huijoohwee', 'docs', 'knowgrph-strybldr-demo.md')
  const sourceText = fs.readFileSync(sourcePath, { encoding: 'utf8' })
  const validationKey = 'validation_input_forbid_hardcode_in_repo'
  const storyboardKey = 'strybldr_storyboard'
  const sourceLines = sourceText.replace(/\r\n/g, '\n').split('\n')
  const validationLine = sourceLines.findIndex(line => line.trim().startsWith(`${validationKey}:`)) + 1
  const storyboardLine = sourceLines.findIndex(line => line.trim() === `${storyboardKey}:`) + 1
  const frontmatterEndLine = sourceLines.findIndex((line, index) => index > 0 && line.trim() === '---') + 1

  if (!sourceText.startsWith('---\n')) {
    throw new Error('expected Strybldr validation source doc to keep byte-zero YAML frontmatter')
  }
  if (validationLine < 1 || storyboardLine < 1 || frontmatterEndLine < 1) {
    throw new Error('expected Strybldr validation source doc to expose validation and storyboard YAML frontmatter keys')
  }
  if (sourceLines[storyboardLine - 1]?.includes('|')) {
    throw new Error('expected Strybldr validation source doc to use YAML-native storyboard frontmatter, not a JSON literal block')
  }

  const projection = buildStructuredSourceDataViewProjection(sourceText)
  if (!projection) throw new Error('expected Multi-dimensional Table source projection for Strybldr validation doc')
  const metadataReplacement = projection.replacements.find(replacement => replacement.kind === 'metadata')
  if (!metadataReplacement) throw new Error('expected YAML Frontmatter replacement map for Strybldr validation doc')
  if (metadataReplacement.sourceStartLine !== 2 || metadataReplacement.sourceEndLine !== frontmatterEndLine - 1) {
    throw new Error(`expected YAML Frontmatter projection to span the authored frontmatter source lines, got ${metadataReplacement.sourceStartLine}-${metadataReplacement.sourceEndLine}`)
  }
  const sourceRows = metadataReplacement.sourceLineByRowIndex || []
  const expectedRows = metadataReplacement.sourceEndLine - metadataReplacement.sourceStartLine + 1
  if (sourceRows.length !== expectedRows || new Set(sourceRows).size !== sourceRows.length) {
    throw new Error(`expected YAML Frontmatter projection to cover every source frontmatter line once, got ${sourceRows.length}/${expectedRows}`)
  }
  if (!projection.markdownText.includes('## Markdown YAML Frontmatter')) {
    throw new Error('expected Multi-dimensional Table projection to render a Markdown YAML Frontmatter section')
  }
  if (projection.markdownText.includes('## Storyboard Cards')) {
    throw new Error('expected Multi-dimensional Table projection to omit Storyboard Cards table')
  }
  if (!projection.markdownText.includes(`| ${validationKey} |  |  |  |  | ${validationKey} | scalar | true |  |  |  |  | true | L0 | ${validationKey}: "true" | ${validationLine} | 0 |`)) {
    throw new Error(`expected YAML Frontmatter table to reflect the validation guard source line, got:\n${projection.markdownText.slice(0, 2000)}`)
  }
  if (!projection.markdownText.includes(`| ${storyboardKey} |  |  |  |  | ${storyboardKey} | map |  |  |  |  |  |  | L0 | ${storyboardKey}: | ${storyboardLine} | 0 |`)) {
    throw new Error('expected YAML Frontmatter table to reflect YAML-native Strybldr storyboard root')
  }
  if (!projection.markdownText.includes('| flow | direction |  |  |  | direction | string | LR |  |  |  |  | {key: direction, type: string, value: "LR"} | L1 | direction: {key: direction, type: string, value: "LR"} | 182 | 2 |')) {
    throw new Error('expected YAML Frontmatter table to show typed inline flow.direction maps as semantic and source-value cells')
  }
  if (!projection.markdownText.includes('| flow | nodes | id |  |  | id | string | strybldr_flow_source |  |  |  |  | {key: id, type: string, value: "strybldr_flow_source"} | L2 | - id: {key: id, type: string, value: "strybldr_flow_source"} | 186 | 4 |')) {
    throw new Error('expected YAML Frontmatter table to show typed native flow.nodes list-map ids without quoted scalar fallback')
  }
  if (!projection.markdownText.includes('| flow | nodes | id | properties | kgc:readingSummary | kgc:readingSummary | string |')) {
    throw new Error('expected YAML Frontmatter table to expose Strybldr reading summaries in the Summary column')
  }
  const sourceUrlLine = sourceLines.find(line => /^\s*source_url:\s*["']?https:\/\/www\.youtube\.com\/watch\?v=/i.test(line.trim())) || ''
  const validationSourceUrl = readQuotedYamlValue(sourceUrlLine)
  if (!validationSourceUrl) throw new Error('expected Strybldr validation source doc to carry a source_url')
  if (!projection.markdownText.includes('| flow | nodes | id | properties | outputSrcDoc | outputSrcDoc | html_srcdoc | <!doctype html') || !projection.markdownText.includes(`| source_url | scalar | ${validationSourceUrl} |`)) {
    throw new Error('expected YAML Frontmatter table to expose Output and Reference Pack columns from validation source fields')
  }
  const nextTypedListMap = applyStructuredSourceDataViewReplacement({
    sourceText,
    projection,
    startLine: metadataReplacement.generatedStartLine,
    endLine: metadataReplacement.generatedEndLine,
    replacementLines: [
      '| L0 | L1 | L2 | L3 | L4 | Key | Type | Value | Level | Content | Line | Indent |',
      '| -- | -- | -- | -- | -- | --- | ---- | ----- | ----- | ------- | ---- | ------ |',
      '| flow | nodes | id |  |  | id | string | strybldr_flow_source_edited | L2 | - id: {key: id, type: string, value: "strybldr_flow_source"} | 186 | 4 |',
    ],
  })
  if (!nextTypedListMap?.includes('    - id: {key: id, type: string, value: "strybldr_flow_source_edited"}') || nextTypedListMap.includes('    - id: "strybldr_flow_source_edited"')) {
    throw new Error(`expected typed YAML list-map edit to preserve {key,type,value} syntax, got:\n${nextTypedListMap}`)
  }
  if (projection.markdownText.includes('| strybldr_storyboard | workflow | stages | stages |') || projection.markdownText.includes('| strybldr_storyboard | workflow | fork | branches | branches |')) {
    throw new Error('expected YAML Frontmatter list paths to avoid duplicated parent keys')
  }
  if (projection.replacements.length !== 2 || projection.replacements.some(replacement => replacement.kind !== 'metadata' && replacement.kind !== 'body')) {
    throw new Error(`expected only Markdown YAML Frontmatter and Markdown Body replacement maps, got ${projection.replacements.map(replacement => replacement.kind).join(', ')}`)
  }
}

export function testWorkspaceTableViewModeSupportsMultiDimTableSsot() {
  const workspaceMainPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'MarkdownWorkspaceMain.tsx')
  const workspaceModePath = path.resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceEditorMode.ts')
  const presentationPath = path.resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceEditorModePresentation.ts')
  const workspaceMainText = fs.readFileSync(workspaceMainPath, { encoding: 'utf8' })
  const workspaceModeText = fs.readFileSync(workspaceModePath, { encoding: 'utf8' })
  const presentationText = fs.readFileSync(presentationPath, { encoding: 'utf8' })

  if (
    !workspaceMainText.includes("const disableDerivedMarkdownMutations = !!disableViewerMutations")
    || workspaceMainText.includes('disableDerivedMarkdownMutations = !!disableViewerMutations || isSourceAttachedMarkdownTable')
  ) {
    throw new Error('expected source-attached Multi-dimensional Table views to stay inline-editable through the shared Viewer')
  }
  if (!workspaceMainText.includes('sourceAttachedMarkdownTableText || activeJsonSourcePreviewText || viewerText')) {
    throw new Error('expected Multi-dimensional Table source views to render the editable Markdown table before readonly JSON candidates')
  }
  if (!workspaceMainText.includes('buildStructuredSourceDataViewProjection(activeText)') || !workspaceMainText.includes('structuredSourceDataViewProjection?.markdownText')) {
    throw new Error('expected Editor Workspace Multi-dimensional Table to prefer structured Markdown source projections before generic JSON-row tables')
  }
  if (!workspaceMainText.includes('applyStructuredSourceDataViewReplacement({') || !workspaceMainText.includes('if (isStructuredSourceAttachedMarkdownTable) return')) {
    throw new Error('expected Editor Workspace Multi-dimensional Table edits to route through structured source replacement without falling back to generated-table source writes')
  }
  if (workspaceMainText.includes('if (nextText !== activeText) setActiveText(nextText); return')) {
    throw new Error('expected structured source projection edits to avoid committing generated table text back into the source Markdown document')
  }
  if (!workspaceMainText.includes('serializeJsonMarkdownDraftToSourceText({') || !workspaceMainText.includes('if (isSourceAttachedMarkdownTable)')) {
    throw new Error('expected source-attached table edits to commit through the existing JSON-Markdown serialization utility')
  }
  if (!workspaceModeText.includes("export type WorkspaceTableViewMode = WorkspaceEditorMode | 'geospatial'")) {
    throw new Error('expected WorkspaceTableViewMode to keep workspace-backed modes and the geospatial overlay mode in the shared workspace-table SSOT')
  }
  if (!workspaceModeText.includes("if (raw === 'table' || raw === 'multiDimTable' || raw === 'kanban') return raw")) {
    throw new Error("expected parseWorkspaceEditorMode to accept 'multiDimTable' without legacy table-local parsing")
  }
  if (!presentationText.includes('WORKSPACE_TABLE_VIEW_MODE_SELECT_OPTIONS')) {
    throw new Error('expected shared workspace-table presentation options to expose table view labels')
  }
  if (workspaceModeText.includes(forbiddenWorkspaceModeToken) || presentationText.includes(forbiddenWorkspaceModeToken)) {
    throw new Error('expected workspace table view mode to avoid duplicate legacy table-mode persistence')
  }
}

export function testMultiDimTableSupportsRowsColumnsPivot() {
  const headerPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'WorkspaceDataViewHeader.tsx')
  const derivedViewerPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'MarkdownWorkspaceDerivedViewer.tsx')
  const tableViewPath = path.resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'MarkdownDataViewTableView.tsx')
  const configPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'viewer', 'workspaceDataViewConfig.ts')
  const headerText = fs.readFileSync(headerPath, { encoding: 'utf8' })
  const derivedViewerText = fs.readFileSync(derivedViewerPath, { encoding: 'utf8' })
  const tableViewText = fs.readFileSync(tableViewPath, { encoding: 'utf8' })
  const configText = fs.readFileSync(configPath, { encoding: 'utf8' })

  if (!configText.includes("export type WorkspaceDataViewOrientation = 'rows' | 'columns'") || !configText.includes("orientation: 'rows'")) {
    throw new Error('expected data-view config to persist a rows/columns orientation without a renderer-local flag')
  }
  const coerced = coerceWorkspaceDataViewConfig({
    v: 2,
    id: 'v0',
    name: 'Table',
    layout: 'table',
    groupByColumnId: null,
    visibleColumnIds: null,
    columnTypesById: null,
    filterGroups: [{ id: 'g0', rules: [] }],
    sortRules: [],
    orientation: 'columns',
  })
  if (coerced?.orientation !== 'columns') {
    throw new Error('expected persisted data-view config to coerce columns pivot orientation')
  }
  const fallback = coerceWorkspaceDataViewConfig({
    v: 2,
    id: 'v0',
    name: 'Table',
    layout: 'table',
    groupByColumnId: null,
    visibleColumnIds: null,
    columnTypesById: null,
    filterGroups: [{ id: 'g0', rules: [] }],
    sortRules: [],
    orientation: 'legacy-pivot',
  })
  if (fallback?.orientation !== 'rows') {
    throw new Error('expected invalid pivot orientation to normalize to row-record mode')
  }
  if (!headerText.includes('ArrowLeftRight') || !headerText.includes("orientation === 'columns' ? 'rows' : 'columns'") || !headerText.includes('Pivot: columns as records')) {
    throw new Error('expected data-view header to expose a shared rows/columns pivot toggle')
  }
  if (!derivedViewerText.includes("orientation={viewConfig?.orientation === 'columns' ? 'columns' : 'rows'}")) {
    throw new Error('expected MarkdownWorkspaceDerivedViewer to pass persisted pivot orientation to the table renderer')
  }
  if (!tableViewText.includes("orientation?: 'rows' | 'columns'") || !tableViewText.includes("if (orientation === 'columns')") || !tableViewText.includes('Show ${Math.min(hiddenRowCount, MARKDOWN_DATA_VIEW_TABLE_RENDER_ROW_INCREMENT)} more columns')) {
    throw new Error('expected MarkdownDataViewTableView to render row-column pivot mode through the shared table renderer')
  }
}
