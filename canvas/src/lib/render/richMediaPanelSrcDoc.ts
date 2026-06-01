import { LRUCache } from '@/lib/cache/LRUCache'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import { resolveCssVarWithKgFallback } from '@/lib/ui/tokens-ssot'

export const RICH_MEDIA_PANEL_SRCDOC_ATTR = 'data-kg-rich-media-panel-srcdoc'
export const RICH_MEDIA_PANEL_SRCDOC_STYLE_ID = 'kg-rich-media-panel-srcdoc-reset'
export const RICH_MEDIA_PANEL_SRCDOC_RESIZE_SCRIPT_ID = 'kg-rich-media-panel-srcdoc-resize'
export const RICH_MEDIA_PANEL_SRCDOC_SIZE_MESSAGE = 'kg-rich-media-panel-srcdoc-size'

const richMediaPanelSrcDocCache = new LRUCache<string, string>(64, 2 * 60_000)

function escapeHtmlText(raw: unknown): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildRichMediaPanelSrcDocResetStyle(): string {
  const text = resolveCssVarWithKgFallback('--kg-text-primary')
  const topLevelFrameSelector = 'body>:is(main,section,article,div):first-child'
  const nestedRootFrameSelector = 'body>:is(main,section,article,div):first-child>:is(main,section,article,div):first-child'
  const flattenFrameStyle = 'display:block!important;width:100%!important;max-width:none!important;min-width:0!important;min-height:100%!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important'
  return [
    `<style id="${RICH_MEDIA_PANEL_SRCDOC_STYLE_ID}">`,
    ':root{color-scheme:light dark}',
    'html{box-sizing:border-box;width:100%;min-height:100%;background:transparent!important}',
    '*,*::before,*::after{box-sizing:inherit}',
    `body{margin:0!important;min-width:0;width:100%;min-height:100%;background:transparent!important;color:${text}}`,
    `${topLevelFrameSelector},${nestedRootFrameSelector}{${flattenFrameStyle}}`,
    'img,svg,video,canvas{max-width:100%}',
    '</style>',
  ].join('')
}

function buildRichMediaPanelSrcDocResizeScript(): string {
  return [
    `<script id="${RICH_MEDIA_PANEL_SRCDOC_RESIZE_SCRIPT_ID}">`,
    '(function(){',
    `var type=${JSON.stringify(RICH_MEDIA_PANEL_SRCDOC_SIZE_MESSAGE)};`,
    'var raf=0,last="";',
    'function readSize(){',
    'var d=document.documentElement,b=document.body;',
    'var w=Math.ceil(Math.max(d?d.scrollWidth:0,b?b.scrollWidth:0,d?d.offsetWidth:0,b?b.offsetWidth:0,d?d.clientWidth:0,b?b.clientWidth:0));',
    'var h=Math.ceil(Math.max(d?d.scrollHeight:0,b?b.scrollHeight:0,d?d.offsetHeight:0,b?b.offsetHeight:0,d?d.clientHeight:0,b?b.clientHeight:0));',
    'return {width:w,height:h};',
    '}',
    'function send(){',
    'raf=0;',
    'try{',
    'if(document.documentElement)document.documentElement.style.overflow="hidden";',
    'if(document.body)document.body.style.overflow="hidden";',
    'var s=readSize();',
    'if(!(s.width>0)||!(s.height>0))return;',
    'var sig=s.width+"x"+s.height;',
    'if(sig===last)return;',
    'last=sig;',
    'parent.postMessage({type:type,width:s.width,height:s.height},"*");',
    '}catch(e){}',
    '}',
    'function schedule(){if(raf)return;raf=requestAnimationFrame(send);}',
    'try{if(window.ResizeObserver){var ro=new ResizeObserver(schedule);if(document.documentElement)ro.observe(document.documentElement);if(document.body)ro.observe(document.body);}}catch(e){}',
    'window.addEventListener("load",schedule,{passive:true});',
    'window.addEventListener("resize",schedule,{passive:true});',
    'if(document.fonts&&document.fonts.ready){try{document.fonts.ready.then(schedule).catch(function(){});}catch(e){}}',
    'schedule();setTimeout(schedule,60);setTimeout(schedule,240);setTimeout(schedule,900);',
    '})();',
    '</script>',
  ].join('')
}

function markHtmlElement(srcDoc: string): string {
  if (srcDoc.includes(`${RICH_MEDIA_PANEL_SRCDOC_ATTR}=`)) return srcDoc
  if (/<html\b/i.test(srcDoc)) {
    return srcDoc.replace(/<html\b/i, `<html ${RICH_MEDIA_PANEL_SRCDOC_ATTR}="1"`)
  }
  return srcDoc
}

function injectStyleIntoDocument(args: {
  srcDoc: string
  title: string
  style: string
}): string {
  const markedSrcDoc = markHtmlElement(args.srcDoc)
  const existingResetStylePattern = new RegExp(`<style\\b(?=[^>]*\\bid=["']${RICH_MEDIA_PANEL_SRCDOC_STYLE_ID}["'])[^>]*>[\\s\\S]*?<\\/style>`, 'i')
  const existingResizeScriptPattern = new RegExp(`<script\\b(?=[^>]*\\bid=["']${RICH_MEDIA_PANEL_SRCDOC_RESIZE_SCRIPT_ID}["'])[^>]*>[\\s\\S]*?<\\/script>`, 'i')
  const script = buildRichMediaPanelSrcDocResizeScript()
  const srcDoc = markedSrcDoc
    .replace(existingResetStylePattern, '')
    .replace(existingResizeScriptPattern, '')
  if (/<\/head\s*>/i.test(srcDoc)) return srcDoc.replace(/<\/head\s*>/i, `${args.style}${script}</head>`)
  if (/<head\b[^>]*>/i.test(srcDoc)) return srcDoc.replace(/<head\b[^>]*>/i, match => `${match}${args.style}${script}`)
  if (/<html\b[^>]*>/i.test(srcDoc)) {
    return srcDoc.replace(/<html\b[^>]*>/i, match => `${match}<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtmlText(args.title)}</title>${args.style}${script}</head>`)
  }
  return [
    '<!doctype html>',
    `<html ${RICH_MEDIA_PANEL_SRCDOC_ATTR}="1">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtmlText(args.title)}</title>`,
    args.style,
    script,
    '</head>',
    '<body>',
    srcDoc,
    '</body>',
    '</html>',
  ].join('')
}

export function normalizeRichMediaPanelInlineSrcDoc(args: {
  srcDoc: unknown
  title?: unknown
}): string {
  const srcDoc = typeof args.srcDoc === 'string' ? args.srcDoc.trim() : ''
  if (!srcDoc) return ''
  const title = String(args.title || '').trim() || 'Rich Media Panel'
  const srcDocHash = hashStringToHexCached('rich-media-panel-srcdoc', srcDoc)
  const cacheKey = hashSignatureParts(['rich-media-panel-srcdoc', title, srcDoc.length, srcDocHash])
  const cached = richMediaPanelSrcDocCache.get(cacheKey)
  if (cached) return cached
  const normalized = injectStyleIntoDocument({
    srcDoc,
    title,
    style: buildRichMediaPanelSrcDocResetStyle(),
  })
  richMediaPanelSrcDocCache.set(cacheKey, normalized)
  return normalized
}
