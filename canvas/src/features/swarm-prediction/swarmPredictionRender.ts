import type {
  SwarmPredictionEvent,
  SwarmPredictionMetrics,
  SwarmPredictionResult,
  SwarmPredictionWorldState,
} from '@/features/swarm-prediction/swarmPredictionEngine'

const round4 = (value: number): number => Math.round(value * 10000) / 10000

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

export const buildSwarmPredictionChartSvg = (states: SwarmPredictionWorldState[], title: string): string => {
  const points = states.length > 0 ? states : [{ tick: 0, predictionScore: 0.5, meanBelief: 0, consensus: 0, confidence: 0, volatility: 0, activeInterventions: [] }]
  const width = 720
  const height = 320
  const pad = 44
  const maxTick = Math.max(1, points[points.length - 1]?.tick || 1)
  const line = points.map(state => {
    const x = pad + ((width - (pad * 2)) * (state.tick / maxTick))
    const y = height - pad - ((height - (pad * 2)) * state.predictionScore)
    return `${round4(x)},${round4(y)}`
  }).join(' ')
  const consensus = points.map(state => {
    const x = pad + ((width - (pad * 2)) * (state.tick / maxTick))
    const y = height - pad - ((height - (pad * 2)) * state.consensus)
    return `${round4(x)},${round4(y)}`
  }).join(' ')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)} prediction chart">`,
    '<rect width="720" height="320" fill="#f8fafc"/>',
    '<path d="M44 44V276H676" fill="none" stroke="#334155" stroke-width="1.5"/>',
    '<text x="44" y="28" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#0f172a">',
    `${escapeHtml(title)}`,
    '</text>',
    `<polyline points="${line}" fill="none" stroke="#0f766e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<polyline points="${consensus}" fill="none" stroke="#7c3aed" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.78"/>`,
    '<text x="52" y="300" font-family="Inter, Arial, sans-serif" font-size="12" fill="#475569">Prediction score</text>',
    '<circle cx="48" cy="296" r="4" fill="#0f766e"/>',
    '<text x="186" y="300" font-family="Inter, Arial, sans-serif" font-size="12" fill="#475569">Consensus</text>',
    '<circle cx="178" cy="296" r="4" fill="#7c3aed"/>',
    '</svg>',
  ].join('')
}

export const buildSwarmPredictionOutputMarkdown = (args: {
  title: string
  metrics: SwarmPredictionMetrics
  prediction: SwarmPredictionResult['prediction']
  states: SwarmPredictionWorldState[]
  events: SwarmPredictionEvent[]
}): string => {
  const finalState = args.states[args.states.length - 1]
  return [
    `# ${args.title}`,
    '',
    `Prediction score: ${args.prediction.score.toFixed(3)}`,
    `Confidence: ${args.prediction.confidence.toFixed(3)}`,
    `Consensus: ${args.metrics.consensus.toFixed(3)}`,
    `Stop reason: ${args.metrics.stopReason}`,
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Agents | ${args.metrics.agentCount} |`,
    `| Ticks | ${args.metrics.tickCount} |`,
    `| Events | ${args.metrics.eventCount} |`,
    `| Final mean belief | ${finalState?.meanBelief.toFixed(3) || '0.000'} |`,
    `| Final volatility | ${args.metrics.volatility.toFixed(3)} |`,
    '',
    '## Latest Events',
    ...args.events.slice(-6).map(event => `- T${event.tick} ${event.kind}: ${event.label}`),
  ].join('\n')
}

export const buildSwarmPredictionOutputSrcDoc = (args: {
  title: string
  output: string
  chartSvg: string
  metrics: SwarmPredictionMetrics
  prediction: SwarmPredictionResult['prediction']
}): string => {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<style>',
    ':root{color-scheme:light;font-family:Inter,Arial,sans-serif;color:#0f172a;background:#f8fafc}',
    'body{margin:0;padding:18px;background:#f8fafc}',
    'main{display:grid;gap:14px;max-width:860px;margin:0 auto}',
    'section{background:white;border:1px solid #cbd5e1;border-radius:8px;padding:14px}',
    'h1{font-size:20px;line-height:1.25;margin:0 0 8px}',
    'pre{white-space:pre-wrap;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0}',
    '.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
    '.metric{border:1px solid #e2e8f0;border-radius:6px;padding:10px;background:#f8fafc}',
    '.label{font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:4px}',
    '.value{font-size:20px;font-weight:700;color:#0f172a}',
    'svg{max-width:100%;height:auto;display:block}',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    '<section>',
    `<h1>${escapeHtml(args.title)}</h1>`,
    '<div class="metrics">',
    `<div class="metric"><div class="label">Score</div><div class="value">${args.prediction.score.toFixed(3)}</div></div>`,
    `<div class="metric"><div class="label">Confidence</div><div class="value">${args.prediction.confidence.toFixed(3)}</div></div>`,
    `<div class="metric"><div class="label">Consensus</div><div class="value">${args.metrics.consensus.toFixed(3)}</div></div>`,
    `<div class="metric"><div class="label">Ticks</div><div class="value">${args.metrics.tickCount}</div></div>`,
    '</div>',
    '</section>',
    `<section>${args.chartSvg}</section>`,
    `<section><pre>${escapeHtml(args.output)}</pre></section>`,
    '</main>',
    '</body>',
    '</html>',
  ].join('')
}
