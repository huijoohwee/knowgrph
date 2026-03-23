import type { MarkdownDesignBlock } from '@/features/markdown-edgeless/markdownDesignLayout'
import { sanitizeIframeSrcdoc } from '@/lib/render/sanitizeIframeSrcdoc'

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildMarkdownPanelSrcDoc(block: MarkdownDesignBlock): string {
  const p = block.preview
  const body = (() => {
    if (p.kind === 'table' && p.table) {
      const cols = Array.isArray(p.table.columns) ? p.table.columns : []
      const rows = Array.isArray(p.table.rows) ? p.table.rows : []
      const thead = cols.length
        ? `<thead><tr>${cols.map(c => `<th>${escapeHtml(String(c || ''))}</th>`).join('')}</tr></thead>`
        : ''
      const tbody = rows.length
        ? `<tbody>${rows
            .map(r => {
              const rr = Array.isArray(r) ? r : []
              const cells = (cols.length ? rr.slice(0, cols.length) : rr.slice(0, 6)).map(c => `<td>${escapeHtml(String(c || ''))}</td>`)
              return `<tr>${cells.join('')}</tr>`
            })
            .join('')}</tbody>`
        : ''
      return `<div class="wrap"><table>${thead}${tbody}</table></div>`
    }
    if (p.kind === 'code' && p.code) {
      const lang = escapeHtml(String(p.code.lang || '').trim())
      const lines = Array.isArray(p.code.lines) ? p.code.lines : []
      const code = escapeHtml(lines.join('\n'))
      return `<div class="wrap"><div class="meta">${lang || 'code'}</div><pre><code>${code}</code></pre></div>`
    }
    if (p.kind === 'blockquote' && p.blockquote) {
      const lines = Array.isArray(p.blockquote.lines) ? p.blockquote.lines : []
      const html = lines.map(l => `<p>${escapeHtml(String(l || ''))}</p>`).join('')
      return `<div class="wrap"><blockquote>${html}</blockquote></div>`
    }
    if (p.kind === 'callout' && p.callout) {
      const title = escapeHtml(String(p.callout.title || '').trim())
      const kind = escapeHtml(String(p.callout.calloutType || '').trim())
      const summary = escapeHtml(String(block.summary || '').trim())
      const header = `<div class="callout-title">${kind ? `<span class=\"badge\">${kind}</span>` : ''}${title || 'Callout'}</div>`
      const body = summary ? `<div class="callout-body">${summary}</div>` : ''
      return `<div class="wrap"><div class="callout">${header}${body}</div></div>`
    }
    if (p.kind === 'html' && p.html) {
      const raw = String(p.html.raw || '').trim()
      if (raw) return sanitizeIframeSrcdoc(raw)
    }
    const text = escapeHtml(String(block.summary || '').trim())
    return `<div class="wrap"><div class="p">${text || escapeHtml(String(block.title || ''))}</div></div>`
  })()

  const doc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root{color-scheme:light dark}
    html,body{height:100%;margin:0;padding:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
    body{background:transparent;}
    .wrap{padding:12px;box-sizing:border-box;}
    table{border-collapse:collapse;width:100%;font-size:12px;}
    th,td{border:1px solid rgba(127,127,127,.35);padding:6px 8px;vertical-align:top;}
    th{background:rgba(127,127,127,.12);text-align:left;}
    pre{margin:8px 0 0;padding:10px;border-radius:10px;overflow:auto;background:rgba(127,127,127,.12);font-size:12px;}
    .meta{font-size:11px;opacity:.75}
    blockquote{margin:0;padding:10px 12px;border-left:4px solid rgba(127,127,127,.5);background:rgba(127,127,127,.08);border-radius:10px;}
    blockquote p{margin:0 0 8px 0} blockquote p:last-child{margin:0}
    .callout{border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);border-radius:12px;padding:10px 12px;}
    .callout-title{display:flex;gap:8px;align-items:center;font-weight:600;margin-bottom:6px;}
    .badge{font-size:10px;padding:2px 6px;border-radius:999px;border:1px solid rgba(127,127,127,.35);opacity:.8}
    .callout-body{font-size:12px;opacity:.9;line-height:1.35}
    .p{font-size:12px;line-height:1.35}
  </style>
</head>
<body>
${body}
</body>
</html>`
  return doc
}

