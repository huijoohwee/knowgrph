import { HTML_VIDEO_ENGINE_IDS, type RenderSpec } from '@/features/html-video-renderer'
import { hashSignatureParts } from '@/lib/hash/signature'
import { buildRemoteVideoFrameRequestUrl, getBilibiliVideoId, getYouTubeId } from 'grph-shared/rich-media/providers'

export const VIDEO_AGENT_SCHEMA_VERSION = 'knowgrph-video-agent/v1' as const

export const VIDEO_AGENT_CAPABILITIES = Object.freeze({
  ingest: 'ingest',
  parse: 'parse',
  search: 'search',
  edit: 'edit',
  compile: 'compile',
  generate: 'generate',
  stream: 'stream',
} as const)

export const VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES = [
  'RichMediaPanel:stream',
  'RichMediaPanel:frame-analysis',
  'RichMediaPanel:floatingpanel-annotation',
] as const

export const VIDEO_AGENT_REFERENCE_BOUNDARY = Object.freeze({
  kind: 'inspiration-only',
  implementation: 'native-knowgrph',
  copyPolicy: 'no-external-code-copy',
  dependencyPolicy: 'no-external-video-agent-runtime',
  runtimeDependency: false,
} as const)

export type VideoAgentCapability = typeof VIDEO_AGENT_CAPABILITIES[keyof typeof VIDEO_AGENT_CAPABILITIES]

export type VideoAgentPipelineInput = {
  sourceUrl: string
  intent?: string
  requestedCapabilities?: readonly string[]
  width?: number
  height?: number
  fps?: number
  durationMs?: number
  engineHint?: string
}

export type VideoAgentPipelineStage = {
  id: string
  phase: 'ingestion' | 'parsing' | 'rendering'
  capability: VideoAgentCapability
  label: string
  output: string
  startMs: number
  durationMs: number
}

export type VideoAgentReasoningArtifact = {
  capability: VideoAgentCapability
  task: string
  decision: string
  evidence: string
  outputArtifact: string
  streamSignal: string
}

export type VideoAgentFrameBoundingBox = {
  frameIndex: number
  timestampMs: number
  label: string
  bbox: readonly [number, number, number, number]
  confidence: number
  evidence: string
  frameImageUrl: string
}

export type VideoAgentTimelineTrack = {
  id: string
  label: string
  trackIndex: number
  startMs: number
  durationMs: number
  phase: VideoAgentPipelineStage['phase']
  output: string
  timelineLane: 'video' | 'fbf'
  source: 'agent-stage' | 'frameBoundingBox'
  bbox?: VideoAgentFrameBoundingBox['bbox']
  confidence?: number
  frameIndex?: number
  thumbnailUrl?: string
}

export type VideoAgentPipeline = {
  schemaVersion: typeof VIDEO_AGENT_SCHEMA_VERSION
  source: {
    sourceUrl: string
    sourceKey: string
    externalDependency: false
  }
  referenceBoundary: typeof VIDEO_AGENT_REFERENCE_BOUNDARY
  intent: string
  capabilities: VideoAgentCapability[]
  stages: VideoAgentPipelineStage[]
  reasoningArtifacts: VideoAgentReasoningArtifact[]
  frameBoundingBoxes: VideoAgentFrameBoundingBox[]
  timelineTracks: VideoAgentTimelineTrack[]
  stream: {
    primary: 'video/mp4'
    fallback: 'outputSrcDoc'
    panel: 'RichMediaPanel'
    panels: typeof VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES
  }
  renderSpec: RenderSpec
}

export type VideoAgentPipelineError = {
  ok: false
  errorCode: 'invalid_source' | 'invalid_capability'
  field: string
  reason: string
}

export type VideoAgentPipelineResult =
  | { ok: true; pipeline: VideoAgentPipeline }
  | VideoAgentPipelineError

const DEFAULT_CAPABILITIES: readonly VideoAgentCapability[] = [
  VIDEO_AGENT_CAPABILITIES.ingest,
  VIDEO_AGENT_CAPABILITIES.parse,
  VIDEO_AGENT_CAPABILITIES.search,
  VIDEO_AGENT_CAPABILITIES.edit,
  VIDEO_AGENT_CAPABILITIES.compile,
  VIDEO_AGENT_CAPABILITIES.generate,
  VIDEO_AGENT_CAPABILITIES.stream,
]

const CAPABILITY_META: Record<VideoAgentCapability, { phase: VideoAgentPipelineStage['phase']; label: string; output: string }> = {
  ingest: {
    phase: 'ingestion',
    label: 'Ingest source',
    output: 'source manifest',
  },
  parse: {
    phase: 'parsing',
    label: 'Parse multimodal context',
    output: 'transcript windows, frame labels, and annotations',
  },
  search: {
    phase: 'parsing',
    label: 'Search moments',
    output: 'ranked evidence windows',
  },
  edit: {
    phase: 'parsing',
    label: 'Plan edits',
    output: 'clip ranges, overlays, subtitles, and pacing',
  },
  compile: {
    phase: 'rendering',
    label: 'Compile timeline',
    output: 'timeline manifest and render spec',
  },
  generate: {
    phase: 'rendering',
    label: 'Generate placeholders',
    output: 'generated overlays or narration placeholders',
  },
  stream: {
    phase: 'rendering',
    label: 'Stream result',
    output: 'videoUrl or outputSrcDoc rich-media payload',
  },
}

const REASONING_META: Record<VideoAgentCapability, Omit<VideoAgentReasoningArtifact, 'capability'>> = {
  ingest: {
    task: 'Normalize the operator supplied media source into a reusable source manifest.',
    decision: 'Keep the URL as validation input and derive a semantic source key before downstream parsing.',
    evidence: 'sourceUrl, schemaVersion, sourceKey',
    outputArtifact: 'video-agent/source.json',
    streamSignal: 'source-ready',
  },
  parse: {
    task: 'Parse multimodal context into transcript windows, frame labels, and annotation targets.',
    decision: 'Represent parse output as typed data so search and editing can reuse it without recomputation.',
    evidence: 'frame labels, annotation tasks, transcript windows',
    outputArtifact: 'video-agent/parse.json',
    streamSignal: 'parse-ready',
  },
  search: {
    task: 'Search for task-relevant moments across transcript, frame, and annotation evidence.',
    decision: 'Rank moments as reusable evidence windows instead of binding to a provider-specific search API.',
    evidence: 'ranked evidence windows',
    outputArtifact: 'video-agent/moments.json',
    streamSignal: 'moments-ready',
  },
  edit: {
    task: 'Plan clip ranges, overlays, subtitles, pacing, and transitions.',
    decision: 'Store editing decisions as timeline data so rendering remains deterministic and inspectable.',
    evidence: 'clip ranges, overlay labels, subtitle cues',
    outputArtifact: 'video-agent/edit-plan.json',
    streamSignal: 'edit-ready',
  },
  compile: {
    task: 'Compile selected moments into a source-owned timeline and Render_Spec.',
    decision: 'Emit HTML/CSS/data for the existing HTML Video Renderer instead of adding a parallel renderer.',
    evidence: 'timeline tracks, composition dimensions, engine hint',
    outputArtifact: 'video-agent/render.html',
    streamSignal: 'render-spec-ready',
  },
  generate: {
    task: 'Plan generated overlays, narration, or visual treatments without requiring a live generation call.',
    decision: 'Use generation placeholders that can be filled by optional local tools under operator control.',
    evidence: 'overlay prompts, narration placeholders',
    outputArtifact: 'video-agent/generated-assets.json',
    streamSignal: 'generation-plan-ready',
  },
  stream: {
    task: 'Publish the compiled result to the connected Rich Media Panel immediately.',
    decision: 'Prefer video/mp4 when browser encoding succeeds and preserve outputSrcDoc fallback when it does not.',
    evidence: 'videoUrl, outputSrcDoc, renderJobId',
    outputArtifact: 'video-agent/stream-manifest.json',
    streamSignal: 'stream-ready',
  },
}

const isVideoAgentCapability = (value: string): value is VideoAgentCapability => {
  return Object.values(VIDEO_AGENT_CAPABILITIES).includes(value as VideoAgentCapability)
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

const normalizeCapabilities = (values?: readonly string[]): VideoAgentCapability[] | VideoAgentPipelineError => {
  const source = Array.isArray(values) && values.length > 0 ? values : DEFAULT_CAPABILITIES
  const out: VideoAgentCapability[] = []
  for (const raw of source) {
    const value = String(raw || '').trim()
    if (!isVideoAgentCapability(value)) {
      return {
        ok: false,
        errorCode: 'invalid_capability',
        field: 'requestedCapabilities',
        reason: `unsupported capability ${value || '<empty>'}`,
      }
    }
    if (!out.includes(value)) out.push(value)
  }
  if (!out.includes(VIDEO_AGENT_CAPABILITIES.ingest)) out.unshift(VIDEO_AGENT_CAPABILITIES.ingest)
  if (!out.includes(VIDEO_AGENT_CAPABILITIES.parse)) {
    const ingestIndex = out.indexOf(VIDEO_AGENT_CAPABILITIES.ingest)
    out.splice(Math.max(0, ingestIndex + 1), 0, VIDEO_AGENT_CAPABILITIES.parse)
  }
  if (!out.includes(VIDEO_AGENT_CAPABILITIES.stream)) out.push(VIDEO_AGENT_CAPABILITIES.stream)
  return out
}

const buildSourceKey = (sourceUrl: string): string =>
  `video-agent:${hashSignatureParts([VIDEO_AGENT_SCHEMA_VERSION, sourceUrl])}`

const buildStages = (capabilities: readonly VideoAgentCapability[], durationMs: number): VideoAgentPipelineStage[] => {
  const stageDurationMs = Math.max(1, Math.floor(durationMs / Math.max(1, capabilities.length)))
  return capabilities.map((capability, index) => {
    const meta = CAPABILITY_META[capability]
    const startMs = index * stageDurationMs
    const isLast = index === capabilities.length - 1
    return {
      id: `video_agent_${capability}`,
      phase: meta.phase,
      capability,
      label: meta.label,
      output: meta.output,
      startMs,
      durationMs: isLast ? Math.max(1, durationMs - startMs) : stageDurationMs,
    }
  })
}

const buildReasoningArtifacts = (capabilities: readonly VideoAgentCapability[]): VideoAgentReasoningArtifact[] =>
  capabilities.map(capability => ({
    capability,
    ...REASONING_META[capability],
  }))

const buildFrameBoundingBoxes = (durationMs: number, sourceUrl: string): VideoAgentFrameBoundingBox[] => {
  const sampleCount = 5
  const frameStepMs = Math.max(1, Math.floor(durationMs / sampleCount))
  return Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / Math.max(1, sampleCount - 1)
    const x = Number((0.13 + progress * 0.18).toFixed(3))
    const y = Number((0.18 + (index % 2) * 0.05).toFixed(3))
    const width = Number((0.34 - progress * 0.05).toFixed(3))
    const height = Number((0.3 + progress * 0.04).toFixed(3))
    const timestampMs = Math.min(durationMs - 1, index * frameStepMs)
    return {
      frameIndex: index,
      timestampMs,
      label: index % 2 === 0 ? 'tracked subject' : 'context object',
      bbox: [x, y, width, height] as const,
      confidence: Number((0.82 + progress * 0.08).toFixed(2)),
      evidence: `frame-${index}-visual-detection`,
      frameImageUrl: buildVideoAgentFrameImageUrl(sourceUrl, timestampMs),
    }
  })
}

const buildStageTimelineTracks = (stages: readonly VideoAgentPipelineStage[]): VideoAgentTimelineTrack[] =>
  stages.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    trackIndex: index,
    startMs: stage.startMs,
    durationMs: stage.durationMs,
    phase: stage.phase,
    output: stage.output,
    timelineLane: 'video',
    source: 'agent-stage',
  }))

const buildFrameBoundingBoxTimelineTracks = (
  frameBoundingBoxes: readonly VideoAgentFrameBoundingBox[],
  durationMs: number,
): VideoAgentTimelineTrack[] => {
  const fallbackDurationMs = Math.max(1, Math.floor(durationMs / Math.max(1, frameBoundingBoxes.length)))
  return frameBoundingBoxes.map((box, index) => {
    const nextTimestampMs = frameBoundingBoxes[index + 1]?.timestampMs ?? durationMs
    const trackDurationMs = Math.max(1, nextTimestampMs - box.timestampMs || fallbackDurationMs)
    return {
      id: `frame_box_${index}_fbf`,
      label: `Frame-by-frame bbox ${secondsLabel(box.timestampMs)} ${box.label}`,
      trackIndex: index,
      startMs: box.timestampMs,
      durationMs: Math.min(trackDurationMs, Math.max(1, durationMs - box.timestampMs)),
      phase: 'parsing',
      output: `${box.label} ${box.confidence.toFixed(2)} [${box.bbox.join(', ')}]`,
      timelineLane: 'fbf',
      source: 'frameBoundingBox',
      bbox: box.bbox,
      confidence: box.confidence,
      frameIndex: box.frameIndex,
      thumbnailUrl: box.frameImageUrl,
    }
  })
}

const buildVideoAgentCss = (): string =>
  [
    'main{--kg-video-agent-progress:0;width:100%;height:100%;box-sizing:border-box;display:grid;grid-template-rows:auto 1fr auto;gap:14px;padding:18px;font-family:Inter,system-ui,sans-serif;background:#07111f;color:#f8fafc;overflow:hidden}',
    'p,h1,h2,h3{margin:0}',
    '.hero{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start}',
    '.eyebrow{color:#5eead4;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}',
    '.hero h1{font-size:30px;line-height:1.05;letter-spacing:0}',
    '.lede{max-width:760px;color:#cbd5e1;font-size:13px;line-height:1.45}',
    '.chip{border:1px solid #334155;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:8px 10px;font:12px ui-monospace,SFMono-Regular,Menlo,monospace}',
    '.stage{display:grid;grid-template-columns:1.05fr 1fr;gap:12px;min-height:0}',
    '.source,.reasoning,.stream{min-width:0;border:1px solid #334155;border-radius:8px;background:#0f172a;box-shadow:0 18px 40px rgba(0,0,0,.28);overflow:hidden}',
    '.bar{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #334155;background:#111827}',
    '.dot{width:8px;height:8px;border-radius:50%;background:#06b6d4;box-shadow:14px 0 #22c55e,28px 0 #f59e0b}',
    '.url{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.badge{font-size:11px;color:#5eead4}',
    '.video-card{display:grid;gap:12px;padding:14px}',
    '.thumbnail{position:relative;aspect-ratio:16/9;border:1px solid #334155;border-radius:8px;background:linear-gradient(135deg,#123456,#0b1220 55%,#0f766e);overflow:hidden}',
    '.frame-images,.frame-images>li{position:absolute;inset:0;margin:0;padding:0;list-style:none}',
    '.frame-images>li[hidden],.frame-box[hidden]{display:none}',
    '.thumbnail-source{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.82;background:#020617}',
    '.frame-boxes{position:absolute;inset:0;pointer-events:none}',
    '.frame-box{position:absolute;border:2px solid #fbbf24;border-radius:6px;background:rgba(251,191,36,.08);box-shadow:0 0 0 1px rgba(15,23,42,.7);transition:left 80ms linear,top 80ms linear,width 80ms linear,height 80ms linear}',
    '.frame-box span{position:absolute;left:0;top:-18px;border-radius:4px;background:#fbbf24;color:#1f2937;padding:2px 5px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}',
    '.tasks{display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:7px}',
    '.tasks li{list-style:none;border:1px solid #334155;border-radius:8px;padding:8px;background:#111827;color:#e2e8f0;font-size:11px;text-align:center}',
    '.reasoning{display:grid;grid-template-rows:auto 1fr}',
    '.reasoning header{padding:12px;border-bottom:1px solid #334155}',
    '.agents{display:grid;gap:8px;padding:12px}',
    '.agents li{list-style:none;display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;border:1px solid #334155;border-radius:8px;padding:9px;background:#0b1220;transform:translateX(18px);opacity:.18;animation:kgVideoAgentStep .7s ease-out both}',
    '.num{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#5eead4;color:#042f2e;font-weight:800;font-size:12px}',
    '.agents span{font-size:12px;color:#e2e8f0}',
    '.agents output{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#93c5fd}',
    '.timeline{display:grid;gap:8px;border-top:1px solid #334155;padding-top:10px}',
    '.rail{height:8px;border-radius:999px;background:#1f2937;overflow:hidden}',
    '.rail::before{content:"";display:block;height:100%;width:100%;background:#5eead4;transform-origin:left;transform:scaleX(var(--kg-video-agent-progress,0))}',
    '.ticks{display:grid;grid-template-columns:repeat(auto-fit,minmax(54px,1fr));gap:7px}',
    '.ticks li{list-style:none;color:#94a3b8;font-size:10px}',
    '.ticks strong{display:block;color:#f8fafc;font-size:11px}',
    '.stream{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;padding:10px}',
    '.stream p{color:#cbd5e1;font-size:12px;line-height:1.4}',
    '.trace{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;min-height:0}',
    '.trace article{border:1px solid #334155;border-radius:8px;background:#111827;padding:9px;min-width:0}',
    '.trace h3{font-size:12px;color:#5eead4}',
    '.trace p{font-size:11px;color:#cbd5e1;line-height:1.35}',
    '.trace output{display:block;margin-top:6px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;color:#93c5fd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '@keyframes kgVideoAgentStep{to{opacity:1;transform:translateX(0)}}',
  ].join('')

const secondsLabel = (ms: number): string => `${(ms / 1000).toFixed(1)}s`

const buildVideoAgentFrameImageUrl = (sourceUrl: string, timestampMs: number): string => {
  const normalizedSourceUrl = String(sourceUrl || '').trim()
  if (!normalizedSourceUrl || (!getYouTubeId(normalizedSourceUrl) && !getBilibiliVideoId(normalizedSourceUrl))) return ''
  return buildRemoteVideoFrameRequestUrl({
    sourceUrl: normalizedSourceUrl,
    timeSeconds: Math.max(0, timestampMs / 1000),
    format: 'png',
  })
}

const buildVideoAgentHtml = (args: {
  sourceUrl: string
  intent: string
  stages: readonly VideoAgentPipelineStage[]
  reasoningArtifacts: readonly VideoAgentReasoningArtifact[]
  frameBoundingBoxes: readonly VideoAgentFrameBoundingBox[]
  durationMs: number
}): string => {
  const capabilityItems = args.stages
    .map(stage => `<li>${escapeHtml(stage.capability)}</li>`)
    .join('')
  const stageItems = args.stages
    .map((stage, index) => (
      `<li style="animation-delay:${(index * 0.14).toFixed(2)}s"><strong class="num">${index + 1}</strong><span>${escapeHtml(stage.label)}</span><output>${escapeHtml(stage.output)}</output></li>`
    ))
    .join('')
  const tickItems = args.stages
    .map(stage => `<li><strong>${escapeHtml(secondsLabel(stage.startMs))}</strong>${escapeHtml(stage.capability)}</li>`)
    .join('')
  const traceItems = args.reasoningArtifacts
    .map(artifact => `<article><h3>${escapeHtml(artifact.capability)}</h3><p>${escapeHtml(artifact.decision)}</p><output>${escapeHtml(artifact.streamSignal)}</output></article>`)
    .join('')
  const frameBoxItems = args.frameBoundingBoxes
    .map(box => {
      const [x, y, width, height] = box.bbox
      return `<mark class="frame-box" data-frame-index="${escapeHtml(box.frameIndex)}" hidden style="left:${escapeHtml(x * 100)}%;top:${escapeHtml(y * 100)}%;width:${escapeHtml(width * 100)}%;height:${escapeHtml(height * 100)}%"><span>${escapeHtml(`${secondsLabel(box.timestampMs)} ${box.label}`)}</span></mark>`
    })
    .join('')
  const sourceFrameImageMarkup = args.frameBoundingBoxes
    .filter(box => box.frameImageUrl)
    .map(box => `<li data-frame-index="${escapeHtml(box.frameIndex)}" hidden><img class="thumbnail-source" src="${escapeHtml(box.frameImageUrl)}" alt="" loading="lazy" decoding="async"></li>`)
    .join('')
  const frameUrlTemplate = buildRemoteVideoFrameRequestUrl({
    sourceUrl: args.sourceUrl,
    timeSeconds: 0,
    format: 'png',
  })
  const frameTiming = JSON.stringify(args.frameBoundingBoxes.map((box, index) => ({
    bbox: box.bbox,
    frameIndex: box.frameIndex,
    timestampMs: box.timestampMs,
    endMs: args.frameBoundingBoxes[index + 1]?.timestampMs ?? args.durationMs,
  })))
  const frameSyncScript = sourceFrameImageMarkup
    ? `<script>(function(){var frames=JSON.parse('${frameTiming}');var duration=${Math.max(1, args.durationMs)};var root=document.querySelector('.thumbnail');var template=root?String(root.getAttribute('data-kg-video-agent-frame-url-template')||''):'';function frameSampleMs(){var min=0;for(var index=1;index<frames.length;index+=1){var delta=Number(frames[index].timestampMs)-Number(frames[index-1].timestampMs);if(delta>0&&(!min||delta<min))min=delta;}return min>0?Math.max(120,Math.min(350,min/4)):0;}var sampleMs=frameSampleMs();function formatSeconds(ms){var text=(Math.max(0,ms)/1000).toFixed(3);return text.replace(/0+$/,'').replace(/\\.$/,'');}function frameState(timeMs){var t=Math.max(0,Number(timeMs)||0);for(var index=0;index<frames.length;index+=1){var current=frames[index];var next=frames[index+1]||current;if(t>=current.timestampMs&&t<current.endMs){var span=Math.max(1,Number(next.timestampMs)-Number(current.timestampMs));return{current:current,next:next,ratio:Math.max(0,Math.min(1,(t-current.timestampMs)/span))};}}var last=frames[frames.length-1];return{current:last,next:last,ratio:0};}function mixedBox(state){var a=state.current.bbox||[0,0,0,0];var b=state.next.bbox||a;var r=state.ratio||0;return[0,1,2,3].map(function(index){return Number(a[index]||0)+(Number(b[index]||0)-Number(a[index]||0))*r;});}function applyBox(mark,state){var box=mixedBox(state);mark.style.left=(box[0]*100)+'%';mark.style.top=(box[1]*100)+'%';mark.style.width=(box[2]*100)+'%';mark.style.height=(box[3]*100)+'%';}function updateFrameImage(img,timeMs){if(!img||!template||!(sampleMs>0))return;var bucket=Math.max(0,Math.round((Number(timeMs)||0)/sampleMs)*sampleMs);if(String(img.getAttribute('data-kg-video-agent-frame-time-ms')||'')===String(bucket))return;try{var url=new URL(template,'http://localhost');url.searchParams.set('time',formatSeconds(bucket));img.setAttribute('src',url.pathname+url.search);img.setAttribute('data-kg-video-agent-frame-time-ms',String(bucket));}catch(e){}}function fitLayer(img){var layer=document.querySelector('.frame-boxes');if(!root||!layer)return;var w=root.clientWidth||root.getBoundingClientRect().width||0;var h=root.clientHeight||root.getBoundingClientRect().height||0;var nw=img&&img.naturalWidth?img.naturalWidth:16;var nh=img&&img.naturalHeight?img.naturalHeight:9;if(!(w>0)||!(h>0)||!(nw>0)||!(nh>0)){layer.style.inset='0';return;}var scale=Math.min(w/nw,h/nh);var vw=nw*scale;var vh=nh*scale;layer.style.left=((w-vw)/2)+'px';layer.style.top=((h-vh)/2)+'px';layer.style.width=vw+'px';layer.style.height=vh+'px';layer.style.right='auto';layer.style.bottom='auto';}function sync(timeMs){var state=frameState(timeMs);var active=state.current.frameIndex;document.documentElement.style.setProperty('--kg-video-agent-progress',String(Math.max(0,Math.min(1,(Number(timeMs)||0)/duration))));document.querySelectorAll('[data-frame-index]').forEach(function(element){var visible=Number(element.getAttribute('data-frame-index'))===active;element.hidden=!visible;if(visible&&element.classList&&element.classList.contains('frame-box'))applyBox(element,state);});var img=document.querySelector('.frame-images>li:not([hidden]) img');updateFrameImage(img,timeMs);fitLayer(img);}document.querySelectorAll('.frame-images img').forEach(function(img){img.addEventListener('load',function(){sync(Number(window.__KNOWGRPH_RENDER_TIME_MS__)||0);},{passive:true});});window.addEventListener('resize',function(){sync(Number(window.__KNOWGRPH_RENDER_TIME_MS__)||0);},{passive:true});window.addEventListener('knowgrph:render-frame',function(event){var timeMs=Number(event&&event.detail&&event.detail.timeMs)||0;window.__KNOWGRPH_RENDER_TIME_MS__=timeMs;sync(timeMs);});sync(Number(window.__KNOWGRPH_RENDER_TIME_MS__)||0);}());</script>`
    : ''

  return `<main data-composition-id="knowgrph-video-agent-runtime" data-start="0" data-duration="${escapeHtml((args.durationMs / 1000).toFixed(3))}" aria-label="Knowgrph video agent render"><header class="hero"><section><p class="eyebrow">Knowgrph video agent</p><h1>Reason through video, then stream the result</h1><p class="lede">${escapeHtml(args.intent)}</p></section><p class="chip">${escapeHtml(args.sourceUrl)}</p></header><section class="stage" aria-label="Video agent orchestration"><article class="source" data-start="0.000" data-duration="2.000" data-track-index="0"><header class="bar"><span class="dot" aria-hidden="true"></span><span class="url">${escapeHtml(args.sourceUrl)}</span><span class="badge">ingested</span></header><section class="video-card"><figure><section class="thumbnail" data-kg-video-agent-frame-url-template="${escapeHtml(frameUrlTemplate)}" aria-label="Frame-by-frame bounding box preview"><ol class="frame-images" aria-label="Source video frames">${sourceFrameImageMarkup}</ol><section class="frame-boxes" aria-label="Frame-by-frame bounding boxes">${frameBoxItems}</section></section><figcaption>Frame-by-frame bounding boxes are normalized validation data; rendering stays native to knowgrph.</figcaption></figure><h2>Search, edit, compile, generate</h2><p>The pipeline records source metadata, annotation targets, reasoning stages, timeline decisions, frame boxes, and stream-ready artifact routes as typed data.</p><ol class="tasks">${capabilityItems}</ol></section></article><article class="reasoning" data-start="1.200" data-duration="4.800" data-track-index="1"><header><p class="eyebrow">Agent plan</p><h2>Native orchestration without external runtime dependency</h2></header><ol class="agents">${stageItems}</ol></article></section><section class="trace" aria-label="Video agent reasoning trace">${traceItems}</section><footer class="timeline" aria-label="Video agent timeline"><section class="rail" aria-label="Instant stream progress"></section><ol class="ticks">${tickItems}</ol><section class="stream" aria-label="Stream output contract"><strong>Instant stream</strong><p>Rich Media Panel receives a playable video artifact when encoding is available, or an inline srcdoc preview from the same Render_Spec when browser encoding is unavailable.</p></section></footer>${frameSyncScript}</main>`
}

export function buildVideoAgentPipeline(input: VideoAgentPipelineInput): VideoAgentPipelineResult {
  const sourceUrl = String(input.sourceUrl || '').trim()
  if (!sourceUrl) {
    return {
      ok: false,
      errorCode: 'invalid_source',
      field: 'sourceUrl',
      reason: 'sourceUrl is required',
    }
  }

  const capabilities = normalizeCapabilities(input.requestedCapabilities)
  if (!Array.isArray(capabilities)) return capabilities

  const durationMs = clampInteger(input.durationMs, 7000, 1000, 600000)
  const fps = clampInteger(input.fps, 24, 1, 120)
  const width = clampInteger(input.width, 1280, 1, 7680)
  const height = clampInteger(input.height, 720, 1, 4320)
  const intent = String(input.intent || 'Reason through complex video tasks, then publish a stream-ready result.').trim()
  const stages = buildStages(capabilities, durationMs)
  const reasoningArtifacts = buildReasoningArtifacts(capabilities)
  const frameBoundingBoxes = buildFrameBoundingBoxes(durationMs, sourceUrl)
  const stageTimelineTracks = buildStageTimelineTracks(stages)
  const frameBoundingBoxTimelineTracks = buildFrameBoundingBoxTimelineTracks(frameBoundingBoxes, durationMs)
  const timelineTracks = [...stageTimelineTracks, ...frameBoundingBoxTimelineTracks]
  const stream = {
    primary: 'video/mp4',
    fallback: 'outputSrcDoc',
    panel: 'RichMediaPanel',
    panels: VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES,
  } as const
  const data = {
    schemaVersion: VIDEO_AGENT_SCHEMA_VERSION,
    sourceVideo: {
      url: sourceUrl,
      sourceKey: buildSourceKey(sourceUrl),
      externalDependency: false,
    },
    referenceBoundary: VIDEO_AGENT_REFERENCE_BOUNDARY,
    intent,
    capabilities,
    stages,
    reasoningArtifacts,
    frameBoundingBoxes,
    frameBoundingBoxTimelineTracks,
    timelineTracks,
    timelineLanes: [
      { id: 'video-agent-stages', label: 'Video agent stages', tracks: stageTimelineTracks.map(track => track.id) },
      { id: 'frame-by-frame-boxes', label: 'Frame-by-frame boxes', tracks: frameBoundingBoxTimelineTracks.map(track => track.id) },
    ],
    bottomPanelTimelineSync: {
      surface: 'BottomPanel Timeline',
      source: 'frameBoundingBoxes',
      lane: 'fbf',
      thumbnailMode: 'frame-by-frame-image',
      trackIds: frameBoundingBoxTimelineTracks.map(track => track.id),
    },
    workspaceFiles: [
      { path: 'video-agent/source.json', kind: 'json', role: 'source-manifest' },
      { path: 'video-agent/moments.json', kind: 'json', role: 'search-index' },
      { path: 'video-agent/parse.json', kind: 'json', role: 'parse-output' },
      { path: 'video-agent/frame-boxes.json', kind: 'json', role: 'frame-bounding-boxes' },
      { path: 'video-agent/timeline.json', kind: 'json', role: 'edit-plan' },
      { path: 'video-agent/generated-assets.json', kind: 'json', role: 'generation-plan' },
      { path: 'video-agent/render.html', kind: 'html', role: 'composition' },
      { path: 'video-agent/stream-manifest.json', kind: 'json', role: 'stream-output' },
    ],
    streaming: stream,
  }

  const renderSpec: RenderSpec = {
    html: buildVideoAgentHtml({ sourceUrl, intent, stages, reasoningArtifacts, frameBoundingBoxes, durationMs }),
    css: buildVideoAgentCss(),
    data,
    durationMs,
    fps,
    width,
    height,
    engineHint: String(input.engineHint || HTML_VIDEO_ENGINE_IDS.canvas2d).trim(),
  }

  return {
    ok: true,
    pipeline: {
      schemaVersion: VIDEO_AGENT_SCHEMA_VERSION,
      source: {
        sourceUrl,
        sourceKey: data.sourceVideo.sourceKey,
        externalDependency: false,
      },
      referenceBoundary: VIDEO_AGENT_REFERENCE_BOUNDARY,
      intent,
      capabilities,
      stages,
      reasoningArtifacts,
      frameBoundingBoxes,
      timelineTracks,
      stream,
      renderSpec,
    },
  }
}
