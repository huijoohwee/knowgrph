import { StickyNote } from 'lucide-react'

import { registerGraphEditorTool } from '@/features/graph-editor/plugins/toolRegistry'

registerGraphEditorTool({
  id: 'plugin.note',
  label: 'Note',
  hotkey: 'T',
  icon: StickyNote,
})

