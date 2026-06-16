import fs from 'node:fs'
import path from 'node:path'
import {
  applyStructuredSourceDataViewReplacement,
  buildStructuredSourceDataViewProjection,
  buildMarkdownPipeTableFromStructuredSourceMetadata,
} from '@/features/markdown-workspace/main/viewer/sourceStructuredDataViewTable'

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
    '    - id: storyboard_card_1',
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
  if (!table.includes('| L0 | L1 | L2 | L3 | Key | Type | Value | Level | Content | Line | Indent |') || !table.includes('| date |  |  |  | date | scalar | 2026-06-13 | L0 | date: "2026-06-13" | 4 | 0 |')) {
    throw new Error(`expected structured source metadata table to expose frontmatter as key/value rows, got:\n${table}`)
  }
  if (!table.includes(`| ${nestedKey} |  |  |  | ${nestedKey} | map |  | L0 | ${nestedKey}: | 5 | 0 |`) || !table.includes(`| ${nestedKey} | ${nestedPrefix} |  |  | ${nestedPrefix} | list | Storyboard | L1 | - "${nestedPrefix}: Storyboard" | 6 | 2 |`) || !table.includes(`| ${nestedKey} | ${nestedPrefix} |  |  | ${nestedPrefix} | list | Flow Editor | L1 | - "${nestedPrefix}: Flow Editor" | 7 | 2 |`)) {
    throw new Error(`expected structured source metadata table to expose nested YAML list values as hierarchy rows, got:\n${table}`)
  }
  if (!table.includes('| surfaces |  |  |  | surfaces | map |  | L0 | surfaces: | 8 | 0 |') || !table.includes('| surfaces | 2D Renderer |  |  | 2D Renderer | list | Storyboard | L1 | - "2D Renderer: Storyboard" | 9 | 2 |')) {
    throw new Error(`expected structured source metadata table to preserve structural YAML source lines, got:\n${table}`)
  }
  if (!table.includes('## Storyboard Cards') || !table.includes('| storyboard_card_1 | Storyboard | StoryboardElement | Opening beat |  | Opening summary |  | Review source |  |  |')) {
    throw new Error(`expected structured source metadata table to expose Storyboard cards with semantic fields, got:\n${table}`)
  }
  if (!table.includes('## Markdown Body') || !table.includes('| # Runnable Demo | 21 | 0 |') || !table.includes('| Body content stays source-owned. | 23 | 0 |')) {
    throw new Error(`expected structured source metadata table to preserve Markdown body lines, got:\n${table}`)
  }
  if (!table.includes('| \\| Stage \\| Owner \\| | 27 | 0 |') || !table.includes('| \\| Render \\| Multi-dimensional Table \\| | 29 | 0 |')) {
    throw new Error(`expected structured source metadata table to preserve Markdown pipe table lines once in the body table, got:\n${table}`)
  }
  const projection = buildStructuredSourceDataViewProjection(sourceText)
  if (!projection) throw new Error('expected source projection')
  const storyboardReplacement = projection.replacements.find(replacement => replacement.kind === 'storyboard')
  if (!storyboardReplacement) throw new Error('expected Storyboard Cards replacement map')
  const metadataReplacement = projection.replacements.find(replacement => replacement.kind === 'metadata')
  if (!metadataReplacement) throw new Error('expected YAML Frontmatter replacement map')
  const bodyReplacement = projection.replacements.find(replacement => replacement.kind === 'body')
  if (!bodyReplacement) throw new Error('expected Markdown body replacement map')
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
      '| L0 | L1 | L2 | L3 | Key | Type | Value | Level | Content | Line | Indent |',
      '| -- | -- | -- | -- | --- | ---- | ----- | ----- | ------- | ---- | ------ |',
      '| title |  |  |  | title | scalar | Runnable Demo | L0 | title: "Runnable Demo" | 1 | 0 |',
      '| graphId |  |  |  | graphId | scalar | md:runnable-demo | L0 | graphId: "md:runnable-demo" | 2 | 0 |',
      '| status |  |  |  | status | scalar | active | L0 | status: active | 3 | 0 |',
      '| date |  |  |  | date | scalar | 2026-06-14 | L0 | date: "2026-06-13" | 4 | 0 |',
      `| ${nestedKey} | ${nestedPrefix} |  |  | ${nestedPrefix} | list | Kanban | L1 | - "${nestedPrefix}: Storyboard" | 6 | 2 |`,
    ],
  })
  if (!nextMetadata?.includes('date: "2026-06-14"') || !nextMetadata.includes(`- "${nestedPrefix}: Kanban"`) || !nextMetadata.includes('# Runnable Demo')) {
    throw new Error(`expected YAML Frontmatter key/value edit to write back while preserving body, got:\n${nextMetadata}`)
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
  const nextStoryboard = applyStructuredSourceDataViewReplacement({
    sourceText,
    projection,
    startLine: storyboardReplacement.generatedStartLine,
    endLine: storyboardReplacement.generatedEndLine,
    replacementLines: [
      '| Node Id | Lane | Type | Label | Order | Summary | Output | Action | Dialogue | Prompt |',
      '| ------- | ---- | ---- | ----- | ----- | ------- | ------ | ------ | -------- | ------ |',
      '| storyboard_card_1 | Publish | StoryboardElement | Opening beat edited |  | Opening summary edited |  | Review source |  |  |',
    ],
  })
  if (!nextStoryboard?.includes('lane: "Publish"') || !nextStoryboard.includes('label: "Opening beat edited"') || !nextStoryboard.includes('"kgc:readingSummary": "Opening summary edited"')) {
    throw new Error(`expected Storyboard Cards edit to write back to YAML node fields, got:\n${nextStoryboard}`)
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

export function testMultiDimTableStructuredSourceStrybldrPayloadMatchesStoryboardModel() {
  const sourceText = [
    'title: "Strybldr Runtime Demo"',
    'graphId: "md:strybldr-runtime-demo"',
    'surfaces:',
    '  - "2D Renderer: Storyboard"',
    '  - "2D Renderer: Multi-dimensional Table"',
    '',
    '# Strybldr Runtime Demo',
    '',
    '```json strybldr-storyboard',
    JSON.stringify({
      version: 1,
      runId: 'runtime-demo-run',
      createdAtMs: 0,
      sources: [
        {
          sourceUnitId: 'source-a',
          workspacePath: 'docs/source-a.md',
          relativePath: 'docs/source-a.md',
          originalName: 'source-a.md',
          mediaKind: 'text',
          mimeHint: 'text/markdown',
          byteSize: 42,
          textHash: 'source-a-hash',
        },
      ],
      elements: [
        {
          id: 'runtime-element-a',
          sourceUnitId: 'source-a',
          label: 'Runtime storyboard beat',
          confidence: 0.9,
          evidenceKind: 'user-edit',
          provider: 'fallback',
          order: 10,
          summary: 'Element summary from payload',
          action: 'Review payload element',
          prompt: 'Prompt from payload element',
        },
      ],
      cards: [
        {
          nodeId: 'runtime-element-a',
          lane: 'Publish',
          title: 'Runtime card title',
          summary: 'Runtime card summary',
          output: 'Runtime output',
          order: 12,
        },
      ],
    }),
    '```',
  ].join('\n')
  const projection = buildStructuredSourceDataViewProjection(sourceText)
  if (!projection) throw new Error('expected Strybldr source projection')
  const storyboardReplacement = projection.replacements.find(replacement => replacement.kind === 'storyboard')
  if (!storyboardReplacement || storyboardReplacement.storyboardEditMode !== 'strybldrPayload') {
    throw new Error(`expected Storyboard Cards table to derive from the Strybldr payload owner, got:\n${projection.markdownText}`)
  }
  if (!projection.markdownText.includes('| runtime-element-a | Publish | Storyboardelement | Runtime card title | 12 | Runtime card summary | Runtime output | Review payload element |  | Prompt from payload element |')) {
    throw new Error(`expected Strybldr Storyboard table to match board-model card fields, got:\n${projection.markdownText}`)
  }
  const nextStoryboard = applyStructuredSourceDataViewReplacement({
    sourceText,
    projection,
    startLine: storyboardReplacement.generatedStartLine,
    endLine: storyboardReplacement.generatedEndLine,
    replacementLines: [
      '| Node Id | Lane | Type | Label | Order | Summary | Output | Action | Dialogue | Prompt |',
      '| ------- | ---- | ---- | ----- | ----- | ------- | ------ | ------ | -------- | ------ |',
      '| runtime-element-a | Review | Storyboardelement | Runtime card title edited | 15 | Runtime card summary edited | Runtime output edited | Review payload element | Dialogue edited | Prompt from payload element |',
    ],
  })
  if (
    !nextStoryboard
    || !nextStoryboard.includes('"nodeId": "runtime-element-a"')
    || !nextStoryboard.includes('"lane": "Review"')
    || !nextStoryboard.includes('"title": "Runtime card title edited"')
    || !nextStoryboard.includes('"summary": "Runtime card summary edited"')
    || !nextStoryboard.includes('"output": "Runtime output edited"')
    || !nextStoryboard.includes('"dialogue": "Dialogue edited"')
    || !nextStoryboard.includes('"order": 15')
  ) {
    throw new Error(`expected Strybldr Storyboard edit to write through card overrides, got:\n${nextStoryboard}`)
  }
}

export function testMultiDimTableStructuredSourceStoryboardEditPreservesMarkdownBody() {
  const sourceText = [
    'title: "Strybldr Runtime Demo"',
    'graphId: "md:strybldr-runtime-demo"',
    'kgCanvas2dRenderer: "storyboard"',
    '',
    '# Strybldr Runtime Demo',
    '',
    '## What The Demo Must Prove',
    '',
    '| Stage | Required behavior | Shared owner |',
    '| Trigger | User opens Launch. | Launch owner |',
    '| Render | Storyboard and Multi-dimensional Table agree. | shared projection |',
    '',
    '```json strybldr-storyboard',
    JSON.stringify({
      version: 1,
      runId: 'runtime-demo-run',
      createdAtMs: 0,
      sources: [
        {
          sourceUnitId: 'source-a',
          workspacePath: 'docs/source-a.md',
          relativePath: 'docs/source-a.md',
          originalName: 'source-a.md',
          mediaKind: 'text',
          mimeHint: 'text/markdown',
          byteSize: 42,
          textHash: 'source-a-hash',
        },
      ],
      elements: [
        {
          id: 'runtime-element-a',
          sourceUnitId: 'source-a',
          label: 'Runtime storyboard beat',
          confidence: 0.9,
          evidenceKind: 'user-edit',
          provider: 'fallback',
          order: 10,
          summary: 'Element summary from payload',
          action: 'Review payload element',
          prompt: 'Prompt from payload element',
        },
      ],
    }),
    '```',
  ].join('\n')
  const projection = buildStructuredSourceDataViewProjection(sourceText)
  if (!projection) throw new Error('expected Strybldr source projection')
  const storyboardReplacement = projection.replacements.find(replacement => replacement.kind === 'storyboard')
  if (!storyboardReplacement) throw new Error('expected Storyboard Cards replacement')
  const nextStoryboard = applyStructuredSourceDataViewReplacement({
    sourceText,
    projection,
    startLine: storyboardReplacement.generatedStartLine,
    endLine: storyboardReplacement.generatedEndLine,
    replacementLines: [
      '| Node Id | Lane | Type | Label | Order | Summary | Output | Action | Dialogue | Prompt |',
      '| ------- | ---- | ---- | ----- | ----- | ------- | ------ | ------ | -------- | ------ |',
      '| runtime-element-a | Publish | Storyboardelement | Runtime card title edited | 15 | Runtime card summary edited | Runtime output edited | Review payload element | Dialogue edited | Prompt from payload element |',
    ],
  })
  if (!nextStoryboard) throw new Error('expected Storyboard semantic edit to produce source text')
  if (!nextStoryboard.includes('## What The Demo Must Prove') || !nextStoryboard.includes('| Render | Storyboard and Multi-dimensional Table agree. | shared projection |')) {
    throw new Error(`expected Storyboard Cards edit to preserve Markdown body content, got:\n${nextStoryboard}`)
  }
  if (nextStoryboard.includes('| Node Id | Lane | Type | Label | Order | Summary | Output | Action | Dialogue | Prompt |')) {
    throw new Error(`expected Storyboard Cards edit to write semantic overrides, not inject the generated table into Markdown body, got:\n${nextStoryboard}`)
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
