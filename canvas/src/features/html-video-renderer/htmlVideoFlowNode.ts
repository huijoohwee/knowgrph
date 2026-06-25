import type { WorkspaceFs } from '@/features/workspace-fs/types'
import type { GraphNode } from '@/lib/graph/types'
import type { HtmlVideoEngineRegistry } from './htmlVideoEngineRegistry'
import { runHtmlVideoRenderJob, type HtmlVideoRunResult } from './htmlVideoRenderJob'
import { validateRenderSpec } from './htmlVideoRendererSpec'

const readNodeProperties = (node: GraphNode): Record<string, unknown> => {
  return node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
    ? node.properties as Record<string, unknown>
    : {}
}

const readInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return undefined
}

const readDataJson = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

export function buildHtmlVideoRenderSpecCandidateFromNode(node: GraphNode): Record<string, unknown> {
  const properties = readNodeProperties(node)
  const data = readDataJson(properties.data_json)
  const durationMs = readInteger(properties.duration_ms)
  const fps = readInteger(properties.fps)
  const width = readInteger(properties.width)
  const height = readInteger(properties.height)
  return {
    html: typeof properties.html === 'string' ? properties.html : '',
    ...(typeof properties.css === 'string' ? { css: properties.css } : {}),
    ...(data ? { data } : {}),
    ...(durationMs != null ? { durationMs } : {}),
    ...(fps != null ? { fps } : {}),
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
    ...(typeof properties.engine_hint === 'string' && properties.engine_hint.trim() ? { engineHint: properties.engine_hint.trim() } : {}),
  }
}

const escapeJsonForScript = (value: unknown): string => JSON.stringify(value ?? {}).replace(/</g, '\\u003c')

export function buildHtmlVideoPreviewSrcDocFromNode(node: GraphNode): string {
  const validation = validateRenderSpec(buildHtmlVideoRenderSpecCandidateFromNode(node))
  if (validation.ok === false) return ''
  const spec = validation.spec
  const previewFrameScript = [
    '<script>',
    '(function(){',
    'var frame=document.querySelector("[data-kg-html-video-preview-frame]");',
    'var stage=document.querySelector("[data-kg-html-video-preview-stage]");',
    `var sourceWidth=${JSON.stringify(spec.width)};`,
    `var sourceHeight=${JSON.stringify(spec.height)};`,
    'var raf=0;',
    'function fit(){',
    'raf=0;',
    'if(!frame||!stage)return;',
    'var host=document.body||document.documentElement;',
    'var bounds=host.getBoundingClientRect();',
    'var width=Math.max(1,bounds.width||host.clientWidth||sourceWidth);',
    'var height=Math.max(1,bounds.height||host.clientHeight||sourceHeight);',
    'var frameWidth=Math.min(width,height*sourceWidth/sourceHeight);',
    'var frameHeight=frameWidth*sourceHeight/sourceWidth;',
    'if(frameHeight>height){frameHeight=height;frameWidth=frameHeight*sourceWidth/sourceHeight;}',
    'var scale=frameWidth/sourceWidth;',
    'frame.style.width=frameWidth+"px";',
    'frame.style.height=frameHeight+"px";',
    'stage.style.setProperty("--kg-html-video-preview-scale",String(scale));',
    'stage.style.setProperty("--kg-html-video-preview-width",sourceWidth+"px");',
    'stage.style.setProperty("--kg-html-video-preview-height",sourceHeight+"px");',
    '}',
    'function schedule(){if(raf)return;raf=requestAnimationFrame(fit);}',
    'try{if(window.ResizeObserver&&frame){var ro=new ResizeObserver(schedule);ro.observe(frame);}}catch(e){}',
    'window.addEventListener("load",schedule,{passive:true});',
    'window.addEventListener("resize",schedule,{passive:true});',
    'schedule();setTimeout(schedule,80);setTimeout(schedule,280);',
    '})();',
    '</script>',
  ].join('')
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<style>',
    'html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent;}',
    `body{display:grid;place-items:center;--kg-render-duration-ms:${spec.durationMs};--kg-render-fps:${spec.fps};--kg-html-video-preview-scale:1;--kg-html-video-preview-width:${spec.width}px;--kg-html-video-preview-height:${spec.height}px;}`,
    spec.css || '',
    `figure[data-kg-html-video-preview-frame]{position:relative;display:block;width:100%;height:auto;max-width:100%;max-height:100%;margin:0;overflow:hidden;background:transparent;aspect-ratio:${spec.width}/${spec.height};}`,
    `section[data-kg-html-video-preview-stage]{position:absolute;left:0;top:0;width:${spec.width}px;height:${spec.height}px;overflow:hidden;transform-origin:0 0;transform:scale(var(--kg-html-video-preview-scale,1));}`,
    '</style>',
    '</head>',
    '<body>',
    '<figure data-kg-html-video-preview-frame aria-label="HTML video preview frame">',
    '<section data-kg-html-video-preview-stage>',
    spec.html,
    '</section>',
    '</figure>',
    `<script type="application/json" id="knowgrph-html-video-data">${escapeJsonForScript(spec.data ?? {})}</script>`,
    previewFrameScript,
    '</body>',
    '</html>',
  ].join('')
}

export async function runHtmlVideoFlowNode(args: {
  node: GraphNode
  registry: HtmlVideoEngineRegistry
  workspacePath?: string | null
  fs?: WorkspaceFs | null
}): Promise<HtmlVideoRunResult> {
  return runHtmlVideoRenderJob({
    spec: buildHtmlVideoRenderSpecCandidateFromNode(args.node),
    node: args.node,
    registry: args.registry,
    workspacePath: args.workspacePath,
    fs: args.fs,
  })
}
