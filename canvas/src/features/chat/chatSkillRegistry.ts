export type ChatSkillId = 'storybuilding'

export type ChatSkillOption = {
  id: ChatSkillId
  label: string
  slashCommand: string
  summary: string
  keywords: readonly string[]
  systemPrompt: string
}

export const CHAT_SKILL_OPTIONS: ChatSkillOption[] = [
  {
    id: 'storybuilding',
    label: 'Storybuilding',
    slashCommand: '/storybuilding',
    summary: 'Source-backed storybuilding KGC runbook for storyboard, Strybldr, and runtime-ready story flows.',
    keywords: ['story', 'storyboard', 'strybldr', 'storytree', 'runbook'],
    systemPrompt: [
      'Skill: Storybuilding.',
      'If the user message starts with `/storybuilding`, treat the slash token as the skill invocation and answer the remaining request.',
      'When the user asks for a demo, storyboard, Strybldr/storytree artifact, or runtime-ready story flow, produce a complete KGC markdown document shaped as a source-backed storybuilding runbook.',
      'Use the active workspace/source-file context as evidence. Treat any demo or runbook already present in context as structural guidance only; do not clone its prose, fixture IDs, fixture URLs, media handles, credentials, or local filesystem paths.',
      'The response must be runtime-ready: declare portable frontmatter, story/card lineage, neutral renderer intent, explicit dataflow edges, validation inputs, and human-readable body sections derived from the declared data.',
      'Prefer universal storybuilding semantics: proof goal, source evidence, import/input lanes, text/image/video generation lanes, storyboard card lineage, validation checklist, acceptance criteria, and unresolved open questions.',
      'Never hardcode repository paths, sibling publication paths, fixture media URLs, fixture media ids, API keys, or browser-stored secrets. If a concrete value is missing from current context, leave a neutral placeholder or open question instead of inventing it.',
      'Persist the final answer through the existing chat-log/KGC artifact flow; do not ask for a separate downstream patch layer or local backfill.',
    ].join('\n'),
  },
]

export const isChatSkillId = (value: unknown): value is ChatSkillId =>
  CHAT_SKILL_OPTIONS.some(option => option.id === value)

export const resolveChatSkillOption = (value: unknown): ChatSkillOption | null => {
  if (!isChatSkillId(value)) return null
  return CHAT_SKILL_OPTIONS.find(option => option.id === value) || null
}

const normalizeSlashCommandToken = (value: unknown): string =>
  String(value || '').trim().toLowerCase().replace(/^\/+/, '')

export const resolveChatSkillBySlashCommand = (value: unknown): ChatSkillOption | null => {
  const command = normalizeSlashCommandToken(value)
  if (!command) return null
  return CHAT_SKILL_OPTIONS.find(option => normalizeSlashCommandToken(option.slashCommand) === command) || null
}

export const parseChatSkillSlashInvocation = (raw: unknown): {
  skill: ChatSkillOption
  query: string
} | null => {
  const text = String(raw || '').trim()
  if (!text.startsWith('/')) return null
  const match = text.match(/^\/([A-Za-z0-9_.-]+)(?:\s+([\s\S]*))?$/)
  if (!match) return null
  const skill = resolveChatSkillBySlashCommand(match[1])
  if (!skill) return null
  return {
    skill,
    query: String(match[2] || '').trim(),
  }
}
