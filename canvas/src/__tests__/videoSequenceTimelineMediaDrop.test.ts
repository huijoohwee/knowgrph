import { buildTimelinePreviewSyncPlan } from '@/components/timeline/timelinePlanSync'
import { filterVideoSequenceMediaEditorGanttCode, filterVideoSequenceWorkflowGanttCode, isVideoSequenceMediaEditorGanttCode, readVideoSequenceTimelineModelFromMarkdown, resolveVideoSequenceTimelineLane } from '@/components/timeline/videoSequenceTimeline'
import { appendMermaidGanttVideoSequenceMediaDrop } from '@/lib/mermaid/mermaidGanttVideoSequenceMediaDrop'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { readYamlFrontmatterMermaidDiagramCodes } from '@/lib/mermaid/mermaidDiagramCode'
import { resolveMermaidGanttCode } from '@/lib/mermaid/mermaidGitGraph'
const readVideoSequenceCode = (markdownText: string): string => {
  const codes = readYamlFrontmatterMermaidDiagramCodes(markdownText, 'gantt')
  return resolveMermaidGanttCode(codes.map(filterVideoSequenceMediaEditorGanttCode).filter(Boolean)) || resolveMermaidGanttCode(codes)
}
export function testVideoSequenceTimelineMediaFilterRemovesWorkflowRows() {
  const mixedCode = [
    'gantt',
    '  title Video-Agent E2E Pipeline',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Agentic OS',
    '  Ideation : video_agent_ideation, 00:00, 0.167m',
    '  Invocation : video_agent_invocation, 00:10, 0.167m',
    '  section Source video',
    '  Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 : clip_seedance, kgsrc_0_52, kgpos_0, 0.867m',
    '  section Audio',
    '  Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 audio : clip_seedance_audio, kgsrc_0_52, kgpos_0, 0.867m',
  ].join('\n')
  const filteredCode = filterVideoSequenceMediaEditorGanttCode(mixedCode)
  const workflowCode = filterVideoSequenceWorkflowGanttCode(mixedCode)
  const rows = buildMermaidGanttTimelineModel(filteredCode).taskSpans
  const workflowRows = buildMermaidGanttTimelineModel(workflowCode).taskSpans
  if (
    !isVideoSequenceMediaEditorGanttCode(filteredCode) ||
    filteredCode.includes('Ideation : video_agent_ideation') ||
    filteredCode.includes('Invocation : video_agent_invocation') ||
    !filteredCode.includes('section Source video') ||
    !filteredCode.includes('section Audio') ||
    rows.length !== 2 ||
    !rows.some(span => span.label === 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4') ||
    !rows.some(span => span.label === 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 audio')
  ) {
    throw new Error(`expected mixed Gantt code to filter to media editor rows only, got ${JSON.stringify({ filteredCode, rows })}`)
  }
  if (
    workflowCode.includes('Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4') ||
    !workflowCode.includes('section Agentic OS') ||
    !workflowRows.some(span => span.label === 'Ideation') ||
    !workflowRows.some(span => span.label === 'Invocation') ||
    workflowRows.length !== 2
  ) {
    throw new Error(`expected mixed Gantt code to filter to workflow rows only, got ${JSON.stringify({ workflowCode, workflowRows })}`)
  }
}
export function testVideoSequenceTimelineMediaDropAppendsSourceBackedClip() {
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "clip_opening"',
    '    originalName: "opening.mp4"',
    '    relativePath: "opening.mp4"',
    '    importMode: "url"',
    '    sourceUrl: "/media/opening.mp4"',
    '    mimeHint: "video/mp4"',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Video',
    '        Opening : clip_opening, kgsrc_0_1, kgpos_0, 1m',
    '        section Audio',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: [
      'gantt',
      '  title Project Schedule',
      '  dateFormat HH:mm',
      '  section Plan',
      '  Keep me : sched_1, 00:00, 1m',
    ].join('\n'),
    markdownText,
    media: {
      byteSize: 6632,
      displayHeight: 720,
      displayWidth: 1280,
      durationSeconds: 15,
      frameRate: 24,
      kind: 'video',
      label: '港岛仿生局.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object',
      url: '/media/harbor.mp4',
    },
    startMinutes: 0.5,
  })
  if (!result) throw new Error('expected video sequence media drop to append a source-backed row')
  const nextModel = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  const nextCode = readVideoSequenceCode(result.markdownText)
  const nextPlan = nextModel ? buildTimelinePreviewSyncPlan({ code: nextCode, sources: nextModel.sources }) : null
  const droppedSegment = nextPlan?.segments.find(segment => segment.source.sourceUrl === '/media/harbor.mp4')
  if (
    !nextModel ||
    nextModel.sources.length !== 2 ||
    !nextModel.sources.some(source => (
      source.sourceUrl === '/media/harbor.mp4' &&
      source.originalName === '港岛仿生局.mp4' &&
      source.durationSeconds === 15 &&
      source.displayWidth === 1280 &&
      source.displayHeight === 720 &&
      source.frameRate === 24
    )) ||
    !nextCode.includes('港岛仿生局.mp4 : clip_') ||
    !nextCode.includes('kgsrc_0_15') ||
    !nextCode.includes('kgpos_0_5') ||
    !result.rowKey.includes('港岛仿生局.mp4') ||
    !droppedSegment ||
    droppedSegment.timelineStartMinutes !== 0.5 ||
    droppedSegment.timelineEndMinutes !== 0.75
  ) {
    throw new Error(`expected dropped media to persist as a source-backed timeline clip, got ${JSON.stringify({ code: nextCode, model: nextModel, plan: nextPlan, rowKey: result.rowKey })}`)
  }
}
export function testVideoSequenceTimelineMediaDropBootstrapsEmptyTimeline() {
  const markdownText = [
    '---',
    'kgCanvas2dRenderer: "storyboard"',
    'flow_diagrams:',
    '  key: "flow_diagrams"',
    '  type: "object"',
    '  value:',
    '    starter_flowchart:',
    '      key: "starter_flowchart"',
    '      type: "mermaid_flowchart"',
    '      value: |-',
    '        flowchart LR',
    '          source --> storyboard',
    '---',
    '',
    '# Starter',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: '',
    markdownText,
    media: {
      durationSeconds: 15,
      kind: 'video',
      label: '港岛仿生局.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object',
      url: '/media/harbor.mp4',
    },
    startMinutes: 0.25,
  })
  if (!result) throw new Error('expected empty timeline media drop to bootstrap a source-backed video sequence')
  const nextModel = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  const nextCode = readVideoSequenceCode(result.markdownText)
  const nextPlan = nextModel ? buildTimelinePreviewSyncPlan({ code: nextCode, sources: nextModel.sources }) : null
  const droppedSegment = nextPlan?.segments.find(segment => segment.source.sourceUrl === '/media/harbor.mp4')
  if (
    !nextModel?.enabled ||
    nextModel.sources.length !== 1 ||
    !result.markdownText.includes('kgVideoSequenceTimeline: true') ||
    !result.markdownText.includes('video_media_timeline:') ||
    !result.markdownText.includes('type: mermaid_gantt') ||
    !nextCode.includes('gantt') ||
    !nextCode.includes('section Source video') ||
    !nextCode.includes('港岛仿生局.mp4 : clip_') ||
    !nextCode.includes('kgsrc_0_15') ||
    !nextCode.includes('kgpos_0') ||
    !droppedSegment ||
    droppedSegment.timelineStartMinutes !== 0 ||
    droppedSegment.timelineEndMinutes !== 0.25
  ) {
    throw new Error(`expected dropped media to initialize a timeline clip, got ${JSON.stringify({ code: nextCode, model: nextModel, plan: nextPlan, markdownText: result.markdownText })}`)
  }
  const inlineEmptySourcesMarkdownText = [
    '---',
    'kgVideoSequenceSources: []',
    'kgVideoSequenceTimeline: false',
    'flow_diagrams:',
    '  key: "flow_diagrams"',
    '  type: "object"',
    '  value:',
    '    video_sequence:',
    '      key: video_sequence',
    '      type: mermaid_gantt',
    '      value: |-',
    '        gantt',
    '          title Video-Agent E2E Pipeline',
    '          dateFormat HH:mm',
    '          axisFormat %H:%M',
    '          section Agentic OS',
    '          Ideation : video_agent_ideation, 00:00, 0.167m',
    '---',
    '',
  ].join('\n')
  const inlineEmptySourcesResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: '',
    markdownText: inlineEmptySourcesMarkdownText,
    media: {
      durationSeconds: 1.08,
      frameRate: 24,
      kind: 'video',
      label: 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object',
      url: '/api/storage/media/airvio/runs/upload/video/seedance.mp4',
    },
    startMinutes: 0,
  })
  if (!inlineEmptySourcesResult) throw new Error('expected inline empty media sources drop to land without duplicate YAML keys')
  const sourceKeyMatches = inlineEmptySourcesResult.markdownText.match(/^kgVideoSequenceSources\s*:/gm) || []
  const inlineResultModel = readVideoSequenceTimelineModelFromMarkdown(inlineEmptySourcesResult.markdownText)
  if (
    sourceKeyMatches.length !== 1 ||
    inlineEmptySourcesResult.markdownText.includes('kgVideoSequenceSources: []') ||
    !inlineEmptySourcesResult.markdownText.includes('kgVideoSequenceTimeline: true') ||
    !inlineResultModel?.enabled ||
    inlineResultModel.sources.length !== 1 ||
    !inlineEmptySourcesResult.markdownText.includes('video_media_timeline:') ||
    !inlineEmptySourcesResult.markdownText.includes('Ideation : video_agent_ideation, 00:00, 0.167m') ||
    readVideoSequenceCode(inlineEmptySourcesResult.markdownText).includes('Ideation : video_agent_ideation') ||
    !readVideoSequenceCode(inlineEmptySourcesResult.markdownText).includes('Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 : clip_')
  ) {
    throw new Error(`expected first FloatingPanel media drop to canonicalize inline empty sources, got ${JSON.stringify({ markdownText: inlineEmptySourcesResult.markdownText, model: inlineResultModel, sourceKeyMatches })}`)
  }
  const starterPlaceholderMarkdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "operator_source_video"',
    '    originalName: ""',
    '    relativePath: ""',
    '    importMode: "url"',
    '    sourceUrl: ""',
    '    mimeHint: "video/mp4"',
    '    byteSize: 0',
    '    durationSeconds: 0',
    '    frameRate: 0',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Source video',
    '        Source video : operator_source_video, kgpos_0, 1m',
    '---',
    '',
  ].join('\n')
  const starterPlaceholderResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(starterPlaceholderMarkdownText),
    markdownText: starterPlaceholderMarkdownText,
    media: {
      durationSeconds: 15,
      kind: 'video',
      label: 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object',
      url: '/media/seedance.mp4',
    },
    startMinutes: 0.32,
  })
  if (!starterPlaceholderResult) throw new Error('expected starter placeholder media drop to replace the blank source row')
  const starterPlaceholderCode = readVideoSequenceCode(starterPlaceholderResult.markdownText)
  const starterPlaceholderModel = readVideoSequenceTimelineModelFromMarkdown(starterPlaceholderResult.markdownText)
  const starterPlaceholderRows = buildMermaidGanttTimelineModel(starterPlaceholderCode).taskSpans
  if (
    starterPlaceholderModel?.sources.length !== 1 ||
    starterPlaceholderModel.sources[0]?.id !== 'operator_source_video' ||
    starterPlaceholderModel.sources[0]?.sourceUrl !== '/media/seedance.mp4' ||
    starterPlaceholderCode.includes('Source video : operator_source_video, kgpos_0, 1m') ||
    !starterPlaceholderCode.includes('Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 : operator_source_video, kgsrc_0_15, kgpos_0_32, 0.25m') ||
    starterPlaceholderRows.length !== 1 ||
    starterPlaceholderRows[0]?.label !== 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4'
  ) {
    throw new Error(`expected first real video drop to consume starter placeholder instead of duplicating bars, got ${JSON.stringify({ code: starterPlaceholderCode, model: starterPlaceholderModel, rows: starterPlaceholderRows })}`)
  }
  const sourceBackedScaffoldMarkdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "operator_source_video"',
    '    originalName: "Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4"',
    '    relativePath: "Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4"',
    '    importMode: "url"',
    '    sourceUrl: "/media/seedance.mp4"',
    '    mimeHint: "video/mp4"',
    '    byteSize: 3691000',
    '    durationSeconds: 52',
    '    frameRate: 24',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Source video',
    '        Source video : operator_source_video, kgsrc_0_0_86, kgpos_0, 0.86m',
    '---',
    '',
  ].join('\n')
  const sourceBackedScaffoldResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(sourceBackedScaffoldMarkdownText),
    markdownText: sourceBackedScaffoldMarkdownText,
    media: {
      byteSize: 3691000,
      durationSeconds: 52,
      frameRate: 24,
      kind: 'video',
      label: 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object',
      url: '/media/seedance.mp4',
    },
    startMinutes: 0.37,
  })
  if (!sourceBackedScaffoldResult) throw new Error('expected add from existing media card to append beside the source-backed scaffold row')
  const sourceBackedScaffoldCode = readVideoSequenceCode(sourceBackedScaffoldResult.markdownText)
  const sourceBackedScaffoldModel = readVideoSequenceTimelineModelFromMarkdown(sourceBackedScaffoldResult.markdownText)
  const sourceBackedScaffoldRows = buildMermaidGanttTimelineModel(sourceBackedScaffoldCode).taskSpans
  if (
    sourceBackedScaffoldModel?.sources.length !== 1 ||
    sourceBackedScaffoldModel.sources[0]?.id !== 'operator_source_video' ||
    sourceBackedScaffoldModel.sources[0]?.sourceUrl !== '/media/seedance.mp4' ||
    !sourceBackedScaffoldCode.includes('Source video : operator_source_video, kgsrc_0_0_86, kgpos_0, 0.86m') ||
    !sourceBackedScaffoldCode.includes('Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 : operator_source_video, kgsrc_0_52, kgpos_0_37, 0.867m') ||
    sourceBackedScaffoldRows.length !== 2 ||
    sourceBackedScaffoldRows[0]?.label !== 'Source video' ||
    sourceBackedScaffoldRows[1]?.label !== 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4'
  ) {
    throw new Error(`expected existing source-backed scaffold add to append without replacing the first media, got ${JSON.stringify({ code: sourceBackedScaffoldCode, model: sourceBackedScaffoldModel, rows: sourceBackedScaffoldRows })}`)
  }
}
export function testVideoSequenceTimelineMediaDropAppendsSecondVideoWithoutReplacingFirst() {
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "clip_seedance"',
    '    originalName: "Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4"',
    '    relativePath: "Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4"',
    '    importMode: "url"',
    '    sourceUrl: "/media/seedance.mp4"',
    '    mimeHint: "video/mp4"',
    '    durationSeconds: 52',
    '    frameRate: 24',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Source video',
    '        Source video : clip_seedance, kgsrc_0_0_86, kgpos_0, 0.86m',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: [
      'gantt',
      '  title Project Schedule',
      '  dateFormat HH:mm',
      '  section Plan',
      '  Keep me : sched_1, 00:00, 1m',
    ].join('\n'),
    markdownText,
    media: {
      byteSize: 6632,
      displayHeight: 720,
      displayWidth: 1280,
      durationSeconds: 15.09,
      frameRate: 24,
      kind: 'video',
      label: '港岛仿生局.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'floating-panel-video',
      url: '/media/harbor.mp4',
    },
    startMinutes: 0.4,
  })
  if (!result) throw new Error('expected second video media drop to append')
  const nextCode = readVideoSequenceCode(result.markdownText)
  const nextModel = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  const rows = buildMermaidGanttTimelineModel(nextCode).taskSpans
  if (
    nextModel?.sources.length !== 2 ||
    !nextModel.sources.some(source => source.id === 'clip_seedance' && source.sourceUrl === '/media/seedance.mp4') ||
    !nextModel.sources.some(source => source.sourceUrl === '/media/harbor.mp4' && source.originalName === '港岛仿生局.mp4') ||
    !rows.some(span => span.label === 'Source video' && span.raw.includes('clip_seedance')) ||
    !rows.some(span => span.label === '港岛仿生局.mp4') ||
    rows.length !== 2 ||
    !nextCode.includes('Source video : clip_seedance, kgsrc_0_0_86, kgpos_0, 0.86m') ||
    !nextCode.includes('港岛仿生局.mp4 : clip_')
  ) {
    throw new Error(`expected second video drop to append without replacing the first clip, got ${JSON.stringify({ code: nextCode, model: nextModel, rows })}`)
  }
}
export function testVideoSequenceTimelineMediaDropDoesNotReplaceSourceBackedStaleLabel() {
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "operator_source_video"',
    '    originalName: ""',
    '    relativePath: ""',
    '    importMode: "url"',
    '    sourceUrl: ""',
    '    mimeHint: "video/mp4"',
    '    byteSize: 0',
    '    durationSeconds: 0',
    '    frameRate: 0',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Source video',
    '        Source video : operator_source_video, kgsrc_0_0_86, kgpos_0, 0.86m',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(markdownText),
    markdownText,
    media: {
      byteSize: 3691000,
      durationSeconds: 52,
      frameRate: 24,
      kind: 'video',
      label: 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object',
      url: '/media/seedance.mp4',
    },
    startMinutes: 0.26,
  })
  if (!result) throw new Error('expected drop onto stale source-backed Source video row to append')
  const nextCode = readVideoSequenceCode(result.markdownText)
  const rows = buildMermaidGanttTimelineModel(nextCode).taskSpans
  const model = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  if (
    rows.length !== 2 ||
    !rows.some(span => span.label === 'Source video' && span.raw.includes('operator_source_video, kgsrc_0_0_86, kgpos_0, 0.86m')) ||
    !rows.some(span => span.label === 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4' && span.raw.includes('kgpos_0_26')) ||
    !model?.sources.some(source => source.sourceUrl === '/media/seedance.mp4') ||
    !nextCode.includes('Source video : operator_source_video, kgsrc_0_0_86, kgpos_0, 0.86m')
  ) {
    throw new Error(`expected stale source-backed Source video row to survive second drop, got ${JSON.stringify({ code: nextCode, model, rows })}`)
  }
}
export function testVideoSequenceTimelineMediaDropDoesNotReplaceRestartedSourceVideoBar() {
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "operator_source_video"',
    '    originalName: ""',
    '    relativePath: ""',
    '    importMode: "url"',
    '    sourceUrl: ""',
    '    mimeHint: "video/mp4"',
    '    byteSize: 0',
    '    durationSeconds: 0',
    '    frameRate: 0',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Source video',
    '        Source video : operator_source_video, kgpos_0, 0.86m',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(markdownText),
    markdownText,
    media: {
      byteSize: 1102000,
      durationSeconds: 0.28,
      frameRate: 24,
      kind: 'video',
      label: 'flower.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object',
      url: '/media/flower.mp4',
    },
    startMinutes: 0.31,
  })
  if (!result) throw new Error('expected flower drop onto restarted Source video bar to append')
  const nextCode = readVideoSequenceCode(result.markdownText)
  const rows = buildMermaidGanttTimelineModel(nextCode).taskSpans
  const model = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  if (
    rows.length !== 2 ||
    !rows.some(span => span.label === 'Source video' && span.raw.includes('operator_source_video, kgpos_0, 0.86m')) ||
    !rows.some(span => span.label === 'flower.mp4' && span.raw.includes('kgpos_0_31')) ||
    !model?.sources.some(source => source.sourceUrl === '/media/flower.mp4') ||
    !nextCode.includes('Source video : operator_source_video, kgpos_0, 0.86m')
  ) {
    throw new Error(`expected restarted Source video bar to survive flower drop, got ${JSON.stringify({ code: nextCode, model, rows })}`)
  }
}
export function testVideoSequenceTimelineMediaDropTargetsVideoSequenceWhenEarlierGanttExists() {
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "operator_source_video"',
    '    originalName: "Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4"',
    '    relativePath: "Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4"',
    '    importMode: "url"',
    '    sourceUrl: "/media/seedance.mp4"',
    '    mimeHint: "video/mp4"',
    '    durationSeconds: 52',
    '    frameRate: 24',
    'flow_diagrams:',
    '  project_schedule:',
    '    key: project_schedule',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Project Schedule',
    '        dateFormat HH:mm',
    '        section Plan',
    '        Keep me : sched_1, 00:00, 1m',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Source video',
    '        Source video : operator_source_video, kgpos_0, 0.86m',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(markdownText),
    markdownText,
    media: {
      byteSize: 1102000,
      durationSeconds: 0.28,
      frameRate: 24,
      kind: 'video',
      label: 'flower.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object',
      url: '/media/flower.mp4',
    },
    startMinutes: 0.35,
  })
  if (!result) throw new Error('expected media drop to update video_sequence with earlier gantt present')
  const nextCode = readVideoSequenceCode(result.markdownText)
  if (
    !result.markdownText.includes('Keep me : sched_1, 00:00, 1m') ||
    !nextCode.includes('Source video : operator_source_video, kgpos_0, 0.86m') ||
    !nextCode.includes('flower.mp4 : clip_') ||
    !nextCode.includes('kgpos_0_35')
  ) {
    throw new Error(`expected video_sequence replacement to leave earlier gantt untouched, got ${JSON.stringify({ markdownText: result.markdownText, nextCode })}`)
  }
}
export function testVideoSequenceTimelineImageDropUsesOneFrameDuration() {
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Image',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(markdownText),
    markdownText,
    media: {
      displayHeight: 720,
      displayWidth: 1280,
      durationSeconds: 1,
      frameRate: 12,
      kind: 'image',
      label: '空武.jpg',
      mimeHint: 'image/jpeg',
      sourceKey: 'synced-r2-object',
      url: '/media/kongwu.jpg',
    },
    startMinutes: 0.25,
  })
  if (!result) throw new Error('expected image drop to append a source-backed one-frame row')
  const nextCode = readVideoSequenceCode(result.markdownText)
  const nextModel = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  const imageSpan = buildMermaidGanttTimelineModel(nextCode).taskSpans.find(span => span.label === '空武.jpg image')
  if (
    !nextModel ||
    !nextModel.sources.some(source => source.sourceUrl === '/media/kongwu.jpg' && source.frameRate === 12) ||
    !nextCode.includes('空武.jpg image : clip_') ||
    !nextCode.includes('kgsrc_0_0_083') ||
    !nextCode.includes('kgpos_0_25') ||
    !nextCode.includes('0.001389m') ||
    nextCode.includes('0.016667m') ||
    nextCode.includes('1s') ||
    !imageSpan ||
    Math.abs(imageSpan.durationMinutes - (1 / 12 / 60)) > 0.000001
  ) {
    throw new Error(`expected dropped image to persist as one frame, got ${JSON.stringify({ code: nextCode, imageSpan, model: nextModel })}`)
  }
  const thumbnailResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: nextCode,
    markdownText: result.markdownText,
    media: {
      displayHeight: 720,
      displayWidth: 1280,
      frameRate: 24,
      kind: 'image',
      label: 'Source video frame 0:01',
      mimeHint: 'image/png',
      sourceKey: 'source-video-frame:1000000',
      thumbnailUrl: 'data:image/png;base64,kg-frame',
      url: 'data:image/png;base64,kg-frame',
    },
    startMinutes: 0.5,
  })
  if (!thumbnailResult) throw new Error('expected thumbnail frame drop to append an image row')
  const thumbnailCode = readVideoSequenceCode(thumbnailResult.markdownText)
  const thumbnailModel = readVideoSequenceTimelineModelFromMarkdown(thumbnailResult.markdownText)
  const thumbnailSpan = buildMermaidGanttTimelineModel(thumbnailCode).taskSpans.find(span => span.label === 'Source video frame 0 01 image')
  if (
    !thumbnailModel?.sources.some(source => source.sourceUrl === 'data:image/png;base64,kg-frame' && source.mimeHint === 'image/png') ||
    !thumbnailCode.includes('section Image') ||
    !thumbnailCode.includes('Source video frame 0 01 image : clip_') ||
    !thumbnailCode.includes('kgpos_0_5') ||
    !thumbnailSpan ||
    resolveVideoSequenceTimelineLane(thumbnailSpan) !== 'image' ||
    Math.abs(thumbnailSpan.durationMinutes - (1 / 24 / 60)) > 0.000001
  ) {
    throw new Error(`expected dropped timeline thumbnail to create a one-frame image clip, got ${JSON.stringify({ code: thumbnailCode, model: thumbnailModel, span: thumbnailSpan })}`)
  }
}
export function testVideoSequenceTimelineMediaDropRoutesFloatingPanelKinds() {
  const starterPlaceholderMarkdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "operator_source_video"',
    '    originalName: ""',
    '    relativePath: ""',
    '    importMode: "url"',
    '    sourceUrl: ""',
    '    mimeHint: "video/mp4"',
    '    byteSize: 0',
    '    durationSeconds: 0',
    '    frameRate: 0',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Source video',
    '        Source video : operator_source_video, kgpos_0, 1m',
    '---',
    '',
  ].join('\n')
  const imageOnPlaceholderResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(starterPlaceholderMarkdownText),
    markdownText: starterPlaceholderMarkdownText,
    media: {
      byteSize: 1102,
      displayHeight: 720,
      displayWidth: 1280,
      frameRate: 24,
      kind: 'image',
      label: 'flower.png',
      mimeHint: 'image/png',
      sourceKey: 'floating-panel-image',
      url: '/media/flower.png',
    },
    startMinutes: 0.1,
  })
  if (!imageOnPlaceholderResult) throw new Error('expected FloatingPanel image payload to consume the starter source placeholder')
  const imageOnPlaceholderCode = readVideoSequenceCode(imageOnPlaceholderResult.markdownText)
  const imageOnPlaceholderModel = readVideoSequenceTimelineModelFromMarkdown(imageOnPlaceholderResult.markdownText)
  const imageOnPlaceholderRows = buildMermaidGanttTimelineModel(imageOnPlaceholderCode).taskSpans
  if (
    imageOnPlaceholderModel?.sources.length !== 1 ||
    imageOnPlaceholderModel.sources[0]?.sourceUrl !== '/media/flower.png' ||
    imageOnPlaceholderModel.sources.some(source => source.id === 'operator_source_video') ||
    imageOnPlaceholderCode.includes('Source video : operator_source_video, kgpos_0, 1m') ||
    imageOnPlaceholderRows.some(span => span.label === 'Source video') ||
    !imageOnPlaceholderRows.some(span => span.label === 'flower.png image')
  ) {
    throw new Error(`expected first image add to remove the empty source-video placeholder, got ${JSON.stringify({ code: imageOnPlaceholderCode, model: imageOnPlaceholderModel, rows: imageOnPlaceholderRows })}`)
  }
  const audioOnPlaceholderResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(starterPlaceholderMarkdownText),
    markdownText: starterPlaceholderMarkdownText,
    media: {
      byteSize: 4096,
      durationSeconds: 6,
      kind: 'audio',
      label: 'voice.m4a',
      mimeHint: 'audio/mp4',
      sourceKey: 'floating-panel-audio',
      url: '/media/voice.m4a',
    },
    startMinutes: 0.2,
  })
  if (!audioOnPlaceholderResult) throw new Error('expected FloatingPanel audio payload to consume the starter source placeholder')
  const audioOnPlaceholderCode = readVideoSequenceCode(audioOnPlaceholderResult.markdownText)
  const audioOnPlaceholderModel = readVideoSequenceTimelineModelFromMarkdown(audioOnPlaceholderResult.markdownText)
  const audioOnPlaceholderRows = buildMermaidGanttTimelineModel(audioOnPlaceholderCode).taskSpans
  if (
    audioOnPlaceholderModel?.sources.length !== 1 ||
    audioOnPlaceholderModel.sources[0]?.sourceUrl !== '/media/voice.m4a' ||
    audioOnPlaceholderModel.sources.some(source => source.id === 'operator_source_video') ||
    audioOnPlaceholderCode.includes('Source video : operator_source_video, kgpos_0, 1m') ||
    audioOnPlaceholderRows.some(span => span.label === 'Source video') ||
    !audioOnPlaceholderRows.some(span => span.label === 'voice.m4a audio')
  ) {
    throw new Error(`expected first audio add to remove the empty source-video placeholder, got ${JSON.stringify({ code: audioOnPlaceholderCode, model: audioOnPlaceholderModel, rows: audioOnPlaceholderRows })}`)
  }
  const videoOnPlaceholderResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(starterPlaceholderMarkdownText),
    markdownText: starterPlaceholderMarkdownText,
    media: {
      byteSize: 6632,
      displayHeight: 720,
      displayWidth: 1280,
      durationSeconds: 15.09,
      frameRate: 24,
      kind: 'video',
      label: '港岛仿生局.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'floating-panel-video',
      url: '/media/harbor.mp4',
    },
    startMinutes: 0.3,
  })
  if (!videoOnPlaceholderResult) throw new Error('expected FloatingPanel video payload to replace the starter source placeholder')
  const videoOnPlaceholderCode = readVideoSequenceCode(videoOnPlaceholderResult.markdownText)
  const videoOnPlaceholderModel = readVideoSequenceTimelineModelFromMarkdown(videoOnPlaceholderResult.markdownText)
  const videoOnPlaceholderRows = buildMermaidGanttTimelineModel(videoOnPlaceholderCode).taskSpans
  if (
    videoOnPlaceholderModel?.sources.length !== 1 ||
    videoOnPlaceholderModel.sources[0]?.id !== 'operator_source_video' ||
    videoOnPlaceholderModel.sources[0]?.sourceUrl !== '/media/harbor.mp4' ||
    videoOnPlaceholderCode.includes('Source video : operator_source_video, kgpos_0, 1m') ||
    videoOnPlaceholderRows.some(span => span.label === 'Source video') ||
    !videoOnPlaceholderRows.some(span => span.label === '港岛仿生局.mp4')
  ) {
    throw new Error(`expected first video add to replace the empty source-video placeholder, got ${JSON.stringify({ code: videoOnPlaceholderCode, model: videoOnPlaceholderModel, rows: videoOnPlaceholderRows })}`)
  }
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Video',
    '        section Audio',
    '---',
    '',
  ].join('\n')
  const imageResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(markdownText),
    markdownText,
    media: {
      byteSize: 1102,
      displayHeight: 720,
      displayWidth: 1280,
      frameRate: 24,
      kind: 'image',
      label: 'flower.png',
      mimeHint: 'image/png',
      sourceKey: 'floating-panel-image',
      url: '/media/flower.png',
    },
    startMinutes: 0.1,
  })
  if (!imageResult) throw new Error('expected FloatingPanel image payload to append an Image lane clip')
  const audioResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(imageResult.markdownText),
    markdownText: imageResult.markdownText,
    media: {
      byteSize: 4096,
      durationSeconds: 6,
      kind: 'audio',
      label: 'voice.m4a',
      mimeHint: 'audio/mp4',
      sourceKey: 'floating-panel-audio',
      url: '/media/voice.m4a',
    },
    startMinutes: 0.2,
  })
  if (!audioResult) throw new Error('expected FloatingPanel audio payload to append an Audio lane clip')
  const videoResult = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(audioResult.markdownText),
    markdownText: audioResult.markdownText,
    media: {
      byteSize: 6632,
      displayHeight: 720,
      displayWidth: 1280,
      durationSeconds: 15.09,
      frameRate: 24,
      kind: 'video',
      label: '港岛仿生局.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'floating-panel-video',
      url: '/media/harbor.mp4',
    },
    startMinutes: 0.3,
  })
  if (!videoResult) throw new Error('expected FloatingPanel video payload to append a Video lane clip')
  const nextCode = readVideoSequenceCode(videoResult.markdownText)
  const nextModel = readVideoSequenceTimelineModelFromMarkdown(videoResult.markdownText)
  const spans = buildMermaidGanttTimelineModel(nextCode).taskSpans
  const imageSpan = spans.find(span => span.label === 'flower.png image')
  const audioSpan = spans.find(span => span.label === 'voice.m4a audio')
  const videoSpan = spans.find(span => span.label === '港岛仿生局.mp4')
  if (
    !nextModel ||
    !nextCode.includes('section Image') ||
    !nextCode.includes('section Audio') ||
    !nextCode.includes('section Video') ||
    !nextModel.sources.some(source => source.sourceUrl === '/media/flower.png' && source.mimeHint === 'image/png' && source.displayWidth === 1280 && source.displayHeight === 720) ||
    !nextModel.sources.some(source => source.sourceUrl === '/media/voice.m4a' && source.mimeHint === 'audio/mp4' && source.durationSeconds === 6) ||
    !nextModel.sources.some(source => source.sourceUrl === '/media/harbor.mp4' && source.mimeHint === 'video/mp4' && source.durationSeconds === 15.09 && source.frameRate === 24) ||
    !imageSpan ||
    !audioSpan ||
    !videoSpan ||
    Math.abs(imageSpan.durationMinutes - (1 / 24 / 60)) > 0.000001
  ) {
    throw new Error(`expected FloatingPanel media drops to create typed Image/Audio/Video clips, got ${JSON.stringify({ code: nextCode, model: nextModel, spans })}`)
  }
}
