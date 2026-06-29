import { buildRemoteVideoFrameRequestUrl } from 'grph-shared/rich-media/providers'

type VideoAgentFrameAnalysisBox = {
  bbox: readonly [number, number, number, number]
  confidence: number | null
  frameIndex: number
  label: string
  timestampMs: number
}

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const readFrameAnalysisBoxes = (value: unknown): readonly VideoAgentFrameAnalysisBox[] => {
  let candidate = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return []
    }
  }
  if (!Array.isArray(candidate)) return []
  return candidate.flatMap((item, index): VideoAgentFrameAnalysisBox[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const bbox = Array.isArray(record.bbox) ? record.bbox.map(Number) : []
    const timestampMs = Number(record.timestampMs)
    if (bbox.length !== 4 || bbox.some(entry => !Number.isFinite(entry)) || !Number.isFinite(timestampMs) || timestampMs < 0) return []
    const normalizedBox = bbox.map(entry => Math.min(1, Math.max(0, entry))) as [number, number, number, number]
    if (normalizedBox[2] <= 0 || normalizedBox[3] <= 0) return []
    const frameIndex = Number.isInteger(Number(record.frameIndex)) ? Number(record.frameIndex) : index
    const confidence = Number(record.confidence)
    return [{
      bbox: normalizedBox,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null,
      frameIndex,
      label: String(record.label || 'detected object').trim() || 'detected object',
      timestampMs,
    }]
  }).sort((left, right) => left.timestampMs - right.timestampMs || left.frameIndex - right.frameIndex)
}

const readSourceUrlFromFrameRequest = (srcDoc: string): string => {
  const match = /(?:src=["'])?([^"'\s>]*\/__video_frame\?[^"'\s>]*)/i.exec(srcDoc)
  if (!match?.[1]) return ''
  try {
    const requestUrl = new URL(match[1].replace(/&amp;/g, '&'), 'http://localhost')
    return String(requestUrl.searchParams.get('url') || '').trim()
  } catch {
    return ''
  }
}

const buildFrameAnalysisMarkup = (
  boxes: readonly VideoAgentFrameAnalysisBox[],
  sourceUrl: string,
): string => {
  const images = boxes.map(box => {
    const url = buildRemoteVideoFrameRequestUrl({
      sourceUrl,
      timeSeconds: box.timestampMs / 1000,
      format: 'png',
    })
    return `<li data-kg-video-agent-frame="${box.frameIndex}" hidden><img src="${escapeHtml(url)}" alt="" loading="eager" decoding="async"></li>`
  }).join('')
  const overlays = boxes.map(box => {
    const [x, y, width, height] = box.bbox
    const confidence = box.confidence == null ? '' : ` ${Math.round(box.confidence * 100)}%`
    return `<mark data-kg-video-agent-frame="${box.frameIndex}" hidden style="left:${x * 100}%;top:${y * 100}%;width:${width * 100}%;height:${height * 100}%"><span>${escapeHtml(`${(box.timestampMs / 1000).toFixed(1)}s ${box.label}${confidence}`)}</span></mark>`
  }).join('')
  const timing = JSON.stringify(boxes.map((box, index) => ({
    bbox: box.bbox,
    frameIndex: box.frameIndex,
    timestampMs: box.timestampMs,
    endMs: boxes[index + 1]?.timestampMs ?? Number.MAX_SAFE_INTEGER,
  }))).replace(/</g, '\\u003c')
  const frameUrlTemplate = buildRemoteVideoFrameRequestUrl({
    sourceUrl,
    timeSeconds: 0,
    format: 'png',
  })
  return [
    `<section data-kg-video-agent-frame-analysis="1" data-kg-video-agent-frame-url-template="${escapeHtml(frameUrlTemplate)}" aria-label="Timeline-synchronized frame analysis">`,
    `<ol aria-label="Source video frame sequence">${images}</ol>`,
    `<section data-kg-video-agent-frame-box-layer="1" aria-label="Active frame bounding boxes">${overlays}</section>`,
    '</section>',
    '<style>',
    '.thumbnail>[data-kg-video-agent-frame-analysis]{position:absolute;inset:0;z-index:2;overflow:hidden;background:#020617}',
    '.thumbnail>[data-kg-video-agent-frame-analysis]>ol,.thumbnail>[data-kg-video-agent-frame-analysis]>ol>li{position:absolute;inset:0;margin:0;padding:0;list-style:none}',
    '.thumbnail>[data-kg-video-agent-frame-analysis] img{width:100%;height:100%;object-fit:contain}',
    '.thumbnail>[data-kg-video-agent-frame-analysis]>section{position:absolute;inset:0;pointer-events:none}',
    '.thumbnail>[data-kg-video-agent-frame-analysis] mark{position:absolute;border:2px solid #fbbf24;border-radius:6px;background:rgba(251,191,36,.1);box-shadow:0 0 0 1px rgba(15,23,42,.7);transition:left 80ms linear,top 80ms linear,width 80ms linear,height 80ms linear}',
    '.thumbnail>[data-kg-video-agent-frame-analysis] mark span{position:absolute;left:0;top:0;max-width:100%;border-radius:0 0 4px 0;background:#fbbf24;color:#1f2937;padding:2px 5px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.thumbnail>[data-kg-video-agent-frame-analysis] [hidden]{display:none!important}',
    '.thumbnail>[data-kg-video-agent-frame-analysis]~.thumbnail-source,.thumbnail>[data-kg-video-agent-frame-analysis]~.frame-boxes{display:none!important}',
    '.thumbnail[data-kg-video-agent-projected="1"]::before,.thumbnail[data-kg-video-agent-projected="1"]::after{display:none!important}',
    '</style>',
    '<script>',
    `(function(){var frames=${timing};var root=document.querySelector('[data-kg-video-agent-frame-analysis="1"]');if(!root||!frames.length)return;if(root.parentElement)root.parentElement.setAttribute('data-kg-video-agent-projected','1');var raf=0;var template=root.getAttribute('data-kg-video-agent-frame-url-template')||'';function frameSampleMs(){var min=0;for(var index=1;index<frames.length;index+=1){var delta=Number(frames[index].timestampMs)-Number(frames[index-1].timestampMs);if(delta>0&&(!min||delta<min))min=delta;}return min>0?Math.max(120,Math.min(350,min/4)):0;}var sampleMs=frameSampleMs();function formatSeconds(ms){var text=(Math.max(0,ms)/1000).toFixed(3);return text.replace(/0+$/,'').replace(/\\.$/,'');}function frameState(timeMs){var t=Number.isFinite(timeMs)?Math.max(0,timeMs):0;for(var index=0;index<frames.length;index+=1){var current=frames[index];var next=frames[index+1]||current;if(t>=current.timestampMs&&t<current.endMs){var span=Math.max(1,Number(next.timestampMs)-Number(current.timestampMs));return{current:current,next:next,ratio:Math.max(0,Math.min(1,(t-current.timestampMs)/span))};}}var last=frames[frames.length-1];return{current:last,next:last,ratio:0};}function mixedBox(state){var a=state.current.bbox||[0,0,0,0];var b=state.next.bbox||a;var r=state.ratio||0;return[0,1,2,3].map(function(index){return Number(a[index]||0)+(Number(b[index]||0)-Number(a[index]||0))*r;});}function applyBox(mark,state){var box=mixedBox(state);mark.style.left=(box[0]*100)+'%';mark.style.top=(box[1]*100)+'%';mark.style.width=(box[2]*100)+'%';mark.style.height=(box[3]*100)+'%';}function updateFrameImage(img,timeMs){if(!img||!template||!(sampleMs>0))return;var bucket=Math.max(0,Math.round((Number(timeMs)||0)/sampleMs)*sampleMs);if(String(img.getAttribute('data-kg-video-agent-frame-time-ms')||'')===String(bucket))return;try{var url=new URL(template,'http://localhost');url.searchParams.set('time',formatSeconds(bucket));img.setAttribute('src',url.pathname+url.search);img.setAttribute('data-kg-video-agent-frame-time-ms',String(bucket));}catch(e){}}function fitLayer(img){var layer=root.querySelector('[data-kg-video-agent-frame-box-layer="1"]');if(!layer)return;var w=root.clientWidth||root.getBoundingClientRect().width||0;var h=root.clientHeight||root.getBoundingClientRect().height||0;var nw=img&&img.naturalWidth?img.naturalWidth:16;var nh=img&&img.naturalHeight?img.naturalHeight:9;if(!(w>0)||!(h>0)||!(nw>0)||!(nh>0)){layer.style.inset='0';return;}var scale=Math.min(w/nw,h/nh);var vw=nw*scale;var vh=nh*scale;layer.style.left=((w-vw)/2)+'px';layer.style.top=((h-vh)/2)+'px';layer.style.width=vw+'px';layer.style.height=vh+'px';layer.style.right='auto';layer.style.bottom='auto';}function sync(rawTimeMs){var timeMs=Number(rawTimeMs)||0;var state=frameState(timeMs);var active=state.current.frameIndex;root.setAttribute('data-kg-video-agent-frame-state',String(active));window.__KNOWGRPH_RENDER_TIME_MS__=timeMs;root.querySelectorAll('[data-kg-video-agent-frame]').forEach(function(element){var visible=Number(element.getAttribute('data-kg-video-agent-frame'))===active;element.hidden=!visible;if(visible&&element.tagName&&String(element.tagName).toLowerCase()==='mark')applyBox(element,state);});var img=root.querySelector('li:not([hidden]) img');updateFrameImage(img,timeMs);fitLayer(img);}function schedule(){if(raf)return;var next=typeof requestAnimationFrame==='function'?requestAnimationFrame:function(fn){return setTimeout(fn,0);};raf=next(function(){raf=0;sync(Number(window.__KNOWGRPH_RENDER_TIME_MS__)||0);});}root.querySelectorAll('img').forEach(function(img){img.addEventListener('load',schedule,{passive:true});});try{if(window.ResizeObserver){new ResizeObserver(schedule).observe(root);}}catch(e){}window.addEventListener('resize',schedule,{passive:true});window.addEventListener('knowgrph:render-frame',function(event){sync(Number(event&&event.detail&&event.detail.timeMs)||0);});sync(Number(window.__KNOWGRPH_RENDER_TIME_MS__)||0);}());`,
    '</script>',
  ].join('')
}

export const projectVideoAgentFrameAnalysisSrcDoc = (args: {
  frameBoundingBoxes: unknown
  srcDoc: string
}): string => {
  const srcDoc = String(args.srcDoc || '')
  if (!srcDoc || srcDoc.includes('data-kg-video-agent-frame-analysis=')) return srcDoc
  if (srcDoc.includes('data-composition-id="knowgrph-video-agent-runtime"')) return srcDoc
  if (srcDoc.includes('class="frame-images"') && srcDoc.includes('data-frame-index=')) return srcDoc
  const boxes = readFrameAnalysisBoxes(args.frameBoundingBoxes)
  const sourceUrl = readSourceUrlFromFrameRequest(srcDoc)
  if (!boxes.length || !sourceUrl) return srcDoc
  const thumbnailStart = /<section\b(?=[^>]*\bclass=["'][^"']*\bthumbnail\b[^"']*["'])[^>]*>/i
  if (!thumbnailStart.test(srcDoc)) return srcDoc
  return srcDoc.replace(thumbnailStart, match => `${match}${buildFrameAnalysisMarkup(boxes, sourceUrl)}`)
}
