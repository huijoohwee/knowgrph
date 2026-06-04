import type { ChatResponseStructuredSurface } from './chatResponseStructuredContent'

export const buildChatResponseStructuredSurfaceBlock = (responseSurface?: ChatResponseStructuredSurface | null): string => {
  const edgesByTarget = new Map<string, string[]>()
  for (const edge of responseSurface?.edges || []) {
    const target = String(edge.target || '').trim()
    if (target) edgesByTarget.set(target, [...(edgesByTarget.get(target) || []), `@edge:${edge.source}:${edge.sourceHandle}->${edge.target}:${edge.targetHandle}`])
  }
  const rows = Array.isArray(responseSurface?.nodes) ? responseSurface.nodes.map(node => `| \`@node:${node.id}\` | ${node.kind} | ${Object.keys(node.properties).filter(key => !key.startsWith('chat:') && key !== 'richMediaActiveTab' && key !== 'media_interactive').map(field => `\`${field}\``).join(', ') || '—'} | ${(edgesByTarget.get(node.id) || []).map(edge => `\`${edge}\``).join('; ') || '—'} |`) : []
  return rows.length > 0 ? ['### MCP Structured Response Projection', '', 'Assistant structured-content entries are projected into ordinary Flow Editor widget nodes and Rich Media Panel nodes, so text, image, audio, video, HTML, cards, and edges reuse the same Flow Editor, Card, panel, and inline-edit owners.', '', '| Node | Kind | Render fields | Incoming edge |', '|---|---|---|---|', ...rows, ''].join('\n') : ''
}
