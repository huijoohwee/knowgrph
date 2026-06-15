export type ChatSkillId = 'storybuilding'

export type ChatSkillOption = {
  id: ChatSkillId
  label: string
  systemPrompt: string
}

export const CHAT_SKILL_OPTIONS: ChatSkillOption[] = [
  {
    id: 'storybuilding',
    label: 'Storybuilding',
    systemPrompt: [
      'Skill: Storybuilding.',
      'When the user asks for a demo, storyboard, Strybldr/storytree artifact, or runtime-ready story flow, produce a complete KGC markdown document shaped as a source-backed storybuilding runbook.',
      'Use the active workspace/source-file context as evidence. Treat any demo or runbook already present in context as structural guidance only; do not clone its prose, fixture IDs, fixture URLs, media handles, credentials, or local filesystem paths.',
      'The response must be runtime-ready: declare portable frontmatter, story/card lineage, neutral renderer intent, explicit dataflow edges, validation inputs, and human-readable body sections derived from the declared data.',
      'Prefer universal storybuilding semantics: proof goal, source evidence, import/input lanes, text/image/video generation lanes, storyboard card lineage, validation checklist, acceptance criteria, and unresolved open questions.',
      'Never hardcode repository paths, sibling publication paths, fixture media URLs, fixture media ids, API keys, or browser-stored secrets. If a concrete value is missing from current context, leave a neutral placeholder or open question instead of inventing it.',
      'Persist the final answer through the existing chat-log/KGC artifact flow; do not ask for a separate downstream patch layer or local backfill.',
    ].join('\n'),
  },
]

export const DEFAULT_CHAT_SKILL_ID: ChatSkillId = 'storybuilding'

export const isChatSkillId = (value: unknown): value is ChatSkillId =>
  CHAT_SKILL_OPTIONS.some(option => option.id === value)

export const resolveChatSkillOption = (value: unknown): ChatSkillOption => {
  const id = isChatSkillId(value) ? value : DEFAULT_CHAT_SKILL_ID
  return CHAT_SKILL_OPTIONS.find(option => option.id === id) || CHAT_SKILL_OPTIONS[0]
}
