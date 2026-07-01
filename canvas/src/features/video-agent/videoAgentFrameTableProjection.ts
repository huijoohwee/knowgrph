import { formatMediaTimestampSeconds } from 'grph-shared/rich-media/providers'
import type { VideoAgentFrameBoundingBox } from './videoAgentPipeline'

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const readArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const readFrameTranscriptTextByIndex = (value: unknown): Map<number, string> => {
  const out = new Map<number, string>()
  for (const item of readArray(value)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const frameIndex = Number(record.frameIndex)
    const text = String(record.text || '').replace(/\s+/g, ' ').trim()
    if (Number.isInteger(frameIndex) && text) out.set(frameIndex, text)
  }
  return out
}

const readObjectLabels = (frame: VideoAgentFrameBoundingBox): string => {
  const labels = Array.from(new Set([
    frame.label,
    ...(Array.isArray(frame.detections) ? frame.detections.map(detection => detection.label) : []),
  ].map(label => String(label || '').trim()).filter(Boolean)))
  return labels.join(', ') || 'No objects'
}

export type VideoAgentFrameTableRow = {
  frameIndex: number
  imageUrl: string
  objectLabels: string
  timeLabel: string
  timestampMs: number
  transcriptText: string
}

export function buildVideoAgentFrameTableRows(args: {
  frameBoundingBoxes: readonly VideoAgentFrameBoundingBox[]
  frameByFrameTranscript?: unknown
}): VideoAgentFrameTableRow[] {
  const transcriptByFrame = readFrameTranscriptTextByIndex(args.frameByFrameTranscript)
  return args.frameBoundingBoxes.map(frame => ({
    frameIndex: frame.frameIndex,
    imageUrl: String(frame.frameImageUrl || '').trim(),
    objectLabels: readObjectLabels(frame),
    timeLabel: formatMediaTimestampSeconds((frame.timestampMs || 0) / 1000),
    timestampMs: frame.timestampMs || 0,
    transcriptText: transcriptByFrame.get(frame.frameIndex) || '',
  }))
}

const escapeMarkdownTableCell = (value: unknown): string => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\|/g, '\\|')
  .replace(/\r?\n/g, '<br>')
  .trim()

const escapeMarkdownImageUrl = (value: unknown): string => String(value ?? '').replace(/\)/g, '%29').trim()

export function buildVideoAgentFrameTableMarkdown(args: {
  frameBoundingBoxes: readonly VideoAgentFrameBoundingBox[]
  frameByFrameTranscript?: unknown
}): string {
  const rows = buildVideoAgentFrameTableRows(args)
  if (!rows.length) return ''
  return [
    '## Multi-dimensional Frame Table',
    '',
    '| Time | Frame (Thumbnail) | (Transcript) Text | Objects (identified in bounding box) |',
    '| --- | --- | --- | --- |',
    ...rows.map(row => {
      const thumbnail = row.imageUrl
        ? `![Frame ${row.frameIndex} thumbnail](${escapeMarkdownImageUrl(row.imageUrl)})`
        : 'No thumbnail'
      return `| ${escapeMarkdownTableCell(row.timeLabel)} | ${thumbnail} | ${escapeMarkdownTableCell(row.transcriptText)} | ${escapeMarkdownTableCell(row.objectLabels)} |`
    }),
  ].join('\n')
}

export function buildVideoAgentFrameTablePanelSrcDoc(args: {
  frameBoundingBoxes: readonly VideoAgentFrameBoundingBox[]
  frameByFrameTranscript?: unknown
}): string {
  const tableRows = buildVideoAgentFrameTableRows(args)
  const rows = tableRows.map((row, index) => {
    const current = index === 0 ? ' data-kg-video-agent-frame-table-current="1"' : ''
    return [
      `<tr data-kg-video-agent-frame-table-row="1" data-frame-index="${row.frameIndex}" data-time-ms="${row.timestampMs}"${current}>`,
      `<td><time datetime="PT${Math.max(0, Math.round(row.timestampMs / 1000))}S">${escapeHtml(row.timeLabel)}</time></td>`,
      `<td>${row.imageUrl ? `<img src="${escapeHtml(row.imageUrl)}" alt="Frame ${row.frameIndex} thumbnail" loading="lazy">` : '<span>No thumbnail</span>'}</td>`,
      `<td>${escapeHtml(row.transcriptText)}</td>`,
      `<td>${escapeHtml(row.objectLabels)}</td>`,
      '</tr>',
    ].join('')
  }).join('')
  const timing = JSON.stringify(tableRows.map(row => ({
    frameIndex: row.frameIndex,
    timestampMs: row.timestampMs,
  }))).replace(/</g, '\\u003c')
  return [
    '<main data-kg-video-agent-frame-table-panel="1" data-kg-rich-media-panel-size="viewport" data-kg-rich-media-panel-scroll-owner="panel" aria-label="Video agent multi-dimensional frame table">',
    '<header><p>Multi-dimensional Table</p><h1>Frame metadata table</h1></header>',
    '<section data-kg-video-agent-frame-table-scroll="1" aria-label="Frame table">',
    '<table>',
    '<thead><tr><th scope="col">Time</th><th scope="col">Frame (Thumbnail)</th><th scope="col">(Transcript) Text</th><th scope="col">Objects (identified in bounding box)</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</section>',
    '</main>',
    '<style>',
    'main{box-sizing:border-box;display:block;width:100%;min-height:100%;padding:16px;background:#07111f;color:#f8fafc;font-family:Inter,system-ui,sans-serif;overflow:visible}',
    'header{margin:0 0 12px}header p,h1{margin:0}header p{color:#5eead4;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}h1{font-size:22px}section{min-height:0;overflow:visible;overscroll-behavior:contain;touch-action:pan-y;border:1px solid #334155;border-radius:8px;background:#0f172a}table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}th,td{border-bottom:1px solid #334155;padding:8px;text-align:left;vertical-align:top}th{position:sticky;top:0;z-index:1;background:#111827;color:#cbd5e1;font-size:11px}td{color:#e2e8f0;line-height:1.4}time{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#93c5fd}img{display:block;width:96px;aspect-ratio:16/9;object-fit:cover;border:1px solid #475569;border-radius:4px;background:#020617}tr[data-kg-video-agent-frame-table-current="1"] td{background:#083344;box-shadow:inset 0 1px 0 rgba(94,234,212,.22),inset 0 -1px 0 rgba(94,234,212,.22)}',
    '</style>',
    '<script>',
    `(function(){var frames=${timing};var root=document.querySelector('[data-kg-video-agent-frame-table-panel="1"]');var scroller=root&&root.querySelector('[data-kg-video-agent-frame-table-scroll="1"]');if(!root||!scroller||!frames.length)return;var userScrollUntilMs=0;function markUserScroll(){userScrollUntilMs=Date.now()+2500;}scroller.addEventListener('wheel',markUserScroll,{passive:true});scroller.addEventListener('touchstart',markUserScroll,{passive:true});scroller.addEventListener('pointerdown',markUserScroll,{passive:true});window.addEventListener('scroll',markUserScroll,{passive:true});function sync(rawTimeMs){var timeMs=Math.max(0,Number(rawTimeMs)||0);var active=frames[0];for(var index=0;index<frames.length;index+=1){if(frames[index].timestampMs<=timeMs)active=frames[index];else break;}root.setAttribute('data-kg-video-agent-active-frame',String(active.frameIndex));root.querySelectorAll('[data-kg-video-agent-frame-table-row]').forEach(function(row){var isActive=Number(row.getAttribute('data-frame-index'))===active.frameIndex;if(isActive){row.setAttribute('data-kg-video-agent-frame-table-current','1');if(Date.now()>userScrollUntilMs){try{row.scrollIntoView({block:'nearest'});}catch(e){}}}else{row.removeAttribute('data-kg-video-agent-frame-table-current');}});}window.addEventListener('knowgrph:render-frame',function(event){sync(event&&event.detail&&event.detail.timeMs);});sync(Number(window.__KNOWGRPH_RENDER_TIME_MS__)||0);}());`,
    '</script>',
  ].join('')
}
