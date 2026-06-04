import React from 'react'
import { GitBranch, GitCommitHorizontal, GitMerge, PencilLine, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  appendMermaidGitGraphCommand,
  deleteMermaidGitGraphCommandLine,
  updateMermaidGitGraphCommandLine,
  type MermaidGitGraphAddKind,
  type MermaidGitGraphCommand,
} from '@/lib/mermaid/mermaidGitGraphEdit'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { useMermaidGitGraphDocument } from './useMermaidGitGraphDocument'

const GITGRAPH_COMMAND_LABELS: Record<MermaidGitGraphAddKind, string> = {
  commit: 'Commit',
  branch: 'Branch',
  merge: 'Merge',
  'cherry-pick': 'Cherry-pick',
}

const buildCommandDescription = (command: MermaidGitGraphCommand | null): string => {
  if (!command) return 'No command selected'
  const subject = command.commitId || command.target || command.label
  return `${command.kind}${subject ? `: ${subject}` : ''}`
}

export function GitGraphFloatingPanelView() {
  const [editRequestKey, setEditRequestKey] = React.useState(0)
  const [editStatus, setEditStatus] = React.useState('')
  const commandListRef = React.useRef<HTMLElement | null>(null)
  const { gitGraphSelectedCommandLineIndex, setGitGraphSelectedCommandLineIndex } = useGraphStore(
    useShallow(state => ({
      gitGraphSelectedCommandLineIndex: state.gitGraphSelectedCommandLineIndex,
      setGitGraphSelectedCommandLineIndex: state.setGitGraphSelectedCommandLineIndex,
    })),
  )
  const { code, commitGitGraphCode, gitGraphModel } = useMermaidGitGraphDocument()
  const selectedCommand = React.useMemo(() => {
    if (gitGraphSelectedCommandLineIndex != null) {
      const manual = gitGraphModel.commands.find(command => command.lineIndex === gitGraphSelectedCommandLineIndex)
      if (manual) return manual
    }
    return gitGraphModel.commands[gitGraphModel.commands.length - 1] || null
  }, [gitGraphModel.commands, gitGraphSelectedCommandLineIndex])

  React.useEffect(() => {
    if (gitGraphSelectedCommandLineIndex == null) return
    if (gitGraphModel.commands.some(command => command.lineIndex === gitGraphSelectedCommandLineIndex)) return
    setGitGraphSelectedCommandLineIndex(null)
  }, [gitGraphModel.commands, gitGraphSelectedCommandLineIndex, setGitGraphSelectedCommandLineIndex])

  React.useLayoutEffect(() => {
    if (gitGraphSelectedCommandLineIndex == null) return
    const frame = window.requestAnimationFrame(() => {
      const row = commandListRef.current?.querySelector(
        `[data-kg-gitgraph-command-line="${gitGraphSelectedCommandLineIndex}"]`,
      )
      if (!(row instanceof HTMLElement)) return
      row.scrollIntoView({ block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [gitGraphModel.commands.length, gitGraphSelectedCommandLineIndex])

  const addCommand = React.useCallback((kind: MermaidGitGraphAddKind) => {
    if (!code) return
    const nextCode = appendMermaidGitGraphCommand(code, kind)
    const actionLabel = `Add ${GITGRAPH_COMMAND_LABELS[kind]}`
    if (commitGitGraphCode(nextCode, actionLabel)) {
      setEditStatus(actionLabel)
      return
    }
    setEditStatus(`${GITGRAPH_COMMAND_LABELS[kind]} unavailable`)
  }, [code, commitGitGraphCode])

  const updateSelectedCommand = React.useCallback((nextLine: string) => {
    if (!selectedCommand) return
    const actionLabel = `Update ${selectedCommand.kind}`
    if (commitGitGraphCode(updateMermaidGitGraphCommandLine(code, selectedCommand.lineIndex, nextLine), actionLabel)) {
      setEditStatus(actionLabel)
    } else {
      setEditStatus('No source change')
    }
  }, [code, commitGitGraphCode, selectedCommand])

  const deleteSelectedCommand = React.useCallback(() => {
    if (!selectedCommand) return
    const actionLabel = `Delete ${selectedCommand.kind}`
    if (commitGitGraphCode(deleteMermaidGitGraphCommandLine(code, selectedCommand.lineIndex), actionLabel)) {
      setGitGraphSelectedCommandLineIndex(null)
      setEditStatus(actionLabel)
    }
  }, [code, commitGitGraphCode, selectedCommand, setGitGraphSelectedCommandLineIndex])

  if (!code) {
    return (
      <section className="flex h-full flex-col" aria-label="GitGraph command editor" data-kg-gitgraph-floating-panel="1">
        <section className={cn('px-1 py-1 text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>GitGraph</section>
        <section className={cn('px-1 text-xs', UI_THEME_TOKENS.text.secondary)}>No GitGraph Mermaid frontmatter.</section>
      </section>
    )
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col gap-2"
      aria-label="GitGraph command editor"
      data-kg-gitgraph-floating-panel="1"
      data-kg-gitgraph-selected-command={selectedCommand?.kind || undefined}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <section className="min-w-0">
          <section className={cn('truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>GitGraph</section>
          <section className={cn('truncate text-[11px]', UI_THEME_TOKENS.text.secondary)} data-kg-gitgraph-selected-command-label="1">
            {buildCommandDescription(selectedCommand)}
          </section>
        </section>
        <button
          type="button"
          className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
          aria-label="Edit selected GitGraph command"
          title="Edit selected GitGraph command"
          disabled={!selectedCommand}
          onClick={() => setEditRequestKey(value => value + 1)}
        >
          <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>
      <section className="grid grid-cols-4 gap-1 px-1" data-kg-gitgraph-create-actions="1">
        <button
          type="button"
          className={cn('App-toolbar__btn justify-center', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
          aria-label="Add GitGraph commit"
          title="Add GitGraph commit"
          onClick={() => addCommand('commit')}
        >
          <GitCommitHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cn('App-toolbar__btn justify-center', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
          aria-label="Add GitGraph branch"
          title="Add GitGraph branch"
          onClick={() => addCommand('branch')}
        >
          <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cn('App-toolbar__btn justify-center', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
          aria-label="Add GitGraph merge"
          title="Add GitGraph merge"
          onClick={() => addCommand('merge')}
        >
          <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="App-toolbar__btn justify-center border-red-300/70 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700/70 dark:bg-red-950/30 dark:text-red-300"
          aria-label="Delete selected GitGraph command"
          title="Delete selected GitGraph command"
          disabled={!selectedCommand}
          onClick={deleteSelectedCommand}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </section>
      <section className="px-1">
        <CardInlineTextEditor
          id="kg-gitgraph-command-inline-editor"
          value={selectedCommand?.raw || ''}
          ariaLabel="Edit GitGraph command"
          placeholder="Select a GitGraph command"
          canEdit={!!selectedCommand}
          editActivation="click"
          editRequestKey={editRequestKey}
          displayClassName="min-h-8 rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg-hover)] px-2 py-1.5 font-mono text-[11px] leading-5 text-[var(--kg-text-primary)]"
          editorClassName="min-h-8 rounded-md border border-[var(--kg-canvas-accent)] bg-[var(--kg-panel-bg)] px-2 py-1.5 font-mono text-[11px] leading-5 text-[var(--kg-text-primary)]"
          emptyClassName="text-[var(--kg-text-secondary)]"
          onCommit={updateSelectedCommand}
        />
      </section>
      <section
        ref={commandListRef}
        className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--kg-border)]"
        data-kg-gitgraph-command-list="1"
      >
        {gitGraphModel.commands.map(command => {
          const selected = selectedCommand?.lineIndex === command.lineIndex
          return (
            <button
              key={command.key}
              type="button"
              className={[
                'flex w-full items-center gap-2 border-b border-[var(--kg-border)] px-2 py-1.5 text-left last:border-b-0',
                selected
                  ? 'text-[var(--kg-text-primary)] shadow-[inset_3px_0_0_var(--kg-canvas-accent)] ring-2 ring-inset ring-[var(--kg-canvas-accent)]'
                  : 'text-[var(--kg-text-secondary)] hover:bg-[var(--kg-panel-bg-hover)]',
              ].join(' ')}
              style={selected ? {
                backgroundColor: 'color-mix(in srgb, var(--kg-canvas-accent) 16%, var(--kg-panel-bg))',
              } : undefined}
              data-kg-gitgraph-command-row="1"
              data-kg-gitgraph-command-kind={command.kind}
              data-kg-gitgraph-command-line={command.lineIndex}
              data-kg-gitgraph-command-selected={selected ? '1' : undefined}
              onClick={() => setGitGraphSelectedCommandLineIndex(command.lineIndex)}
            >
              <span className="w-16 shrink-0 text-[10px] uppercase tracking-normal">{command.kind}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{command.label}</span>
              <span className="shrink-0 text-[10px] text-[var(--kg-text-tertiary)]">L{command.lineNumber}</span>
            </button>
          )
        })}
      </section>
      <section className="truncate px-1 text-[11px] text-[var(--kg-text-tertiary)]" data-kg-gitgraph-edit-status="1">
        {editStatus || `${gitGraphModel.commands.length} commands`}
      </section>
    </section>
  )
}
