function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildTextWidgetOutputSrcDoc(args: {
  title?: unknown
  text?: unknown
}): string {
  const title = String(args.title || '').trim() || 'Text Widget Output'
  const text = typeof args.text === 'string' ? args.text : String(args.text ?? '')
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root{color-scheme:light dark}
    html,body{height:100%;margin:0;padding:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
    body{background:transparent;color:CanvasText}
    .wrap{box-sizing:border-box;padding:12px;height:100%;display:flex;flex-direction:column;gap:10px}
    .title{font-size:12px;font-weight:600;opacity:.8}
    pre{margin:0;flex:1;overflow:auto;white-space:pre-wrap;word-break:break-word;border-radius:12px;padding:12px;background:rgba(127,127,127,.10);border:1px solid rgba(127,127,127,.25);font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace}
  </style>
</head>
<body>
  <section class="wrap">
    <div class="title">${escapeHtml(title)}</div>
    <pre>${escapeHtml(text)}</pre>
  </section>
</body>
</html>`
}
