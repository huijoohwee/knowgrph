import React from 'react'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { collectMarkdownVariableBrowseRows, buildMarkdownVariableToken } from '@/features/markdown/ui/markdownVariableReferences'
import { CHAT_COMMAND_OPTIONS } from '@/features/chat/chatCommandRegistry'
import { CHAT_SKILL_OPTIONS } from '@/features/chat/chatSkillRegistry'
import { CHAT_INVOCATION_OPTIONS, isChatInvocationToken } from '@/features/chat/chatInvocationRegistry'
import { buildInlineMediaEmbed, collectInlineKeywordCommandCandidates, collectInlineMediaCommandCandidates } from '@/lib/command-menu/inlineCommandMenuCatalog'
import {
  buildInlineCommandMenuItem,
  buildInlineKeywordCommandMenuItem,
  buildInlineMediaCommandMenuItem,
  buildInlineVariableBrowseMenuItem,
} from '@/lib/command-menu/inlineCommandMenuItems'
import { useUploadedMediaInlineCommandCandidates } from '@/lib/command-menu/inlineUploadedMediaCandidates'
import { MarkdownBlockContainerCommandMenu, type MarkdownInlineCommandMenuItem } from '@/lib/markdown-core/ui/markdownBlockContainerCore.commandMenu'
import { AnchorOverlay } from '@/lib/ui/overlay'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { FLOATING_MENU_BUTTON_CLASSNAME, FLOATING_MENU_BUTTON_DISABLED_CLASSNAME, FLOATING_MENU_BUTTON_DANGER_CLASSNAME, FLOATING_POPOVER_INPUT_CLASSNAME } from '@/features/markdown-workspace/main/viewer/floatingMenuStyles'
import { UI_RESPONSIVE_MULTILINE_TEXT_INPUT_EDITOR_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { replaceChatComposerTrigger, resolveChatComposerTrigger, type ChatComposerTrigger } from './chatComposerTrigger'
import {
  buildFloatingPanelChatComposerDisplayText,
  buildFloatingPanelChatComposerOverlayParts,
  deleteFloatingPanelChatComposerProjectedTokenDisplayRange,
  FloatingPanelChatComposerMediaOverlay,
  mapFloatingPanelChatComposerDisplayIndexToRawIndex,
  mapFloatingPanelChatComposerRawIndexToDisplayIndex,
  resolveFloatingPanelChatComposerRawText,
} from './FloatingPanelChatComposerMediaOverlay'

const FLOATING_PANEL_CHAT_COMPOSER_OVERLAY_SELECTION_STYLE = `
textarea[data-kg-chat-input-overlay-active='1']::selection,
textarea[data-kg-chat-input-media-overlay-active='1']::selection {
  background: transparent;
  color: transparent;
}
textarea[data-kg-chat-input-overlay-active='1']::-moz-selection,
textarea[data-kg-chat-input-media-overlay-active='1']::-moz-selection {
  background: transparent;
  color: transparent;
}`

type FloatingPanelChatComposerProps = {
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  markdownText?: string | null
  isLoading: boolean
  isSubmitDisabled: boolean
  uiPanelTextFontClass: string
  placeholder: string
}

export function FloatingPanelChatComposer(props: FloatingPanelChatComposerProps) {
  const anchorRef = React.useRef<HTMLElement | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [trigger, setTrigger] = React.useState<ChatComposerTrigger | null>(null)
  const [query, setQuery] = React.useState('')
  const uploadedMediaItems = useUploadedMediaInlineCommandCandidates()

  const closeMenu = React.useCallback(() => {
    setTrigger(null)
    setQuery('')
  }, [])
  const applyReplacement = React.useCallback((replacement: string) => {
    if (!trigger) return
    const rawTrigger = {
      ...trigger,
      rangeStart: mapFloatingPanelChatComposerDisplayIndexToRawIndex(props.input, trigger.rangeStart),
      rangeEnd: mapFloatingPanelChatComposerDisplayIndexToRawIndex(props.input, trigger.rangeEnd),
    }
    const next = replaceChatComposerTrigger({ text: props.input, trigger: rawTrigger, replacement })
    props.setInput(next.text)
    closeMenu()
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      const cursor = mapFloatingPanelChatComposerRawIndexToDisplayIndex(next.text, next.cursor)
      input.focus({ preventScroll: true })
      input.setSelectionRange(cursor, cursor)
    })
  }, [closeMenu, props, trigger])
  const updateTrigger = React.useCallback((value: string) => {
    const cursor = inputRef.current?.selectionStart ?? value.length
    const next = resolveChatComposerTrigger(value, cursor)
    setTrigger(next)
    setQuery(next?.query || '')
  }, [])

  const slashItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => [
    ...CHAT_SKILL_OPTIONS.map(option => buildInlineCommandMenuItem({
      id: `skill-${option.id}`,
      label: option.slashCommand,
      group: 'Skills',
      description: option.summary,
      keywords: [option.label, ...option.keywords],
      onSelect: () => applyReplacement(`${option.slashCommand} `),
    })),
    ...CHAT_COMMAND_OPTIONS.map(option => buildInlineCommandMenuItem({
      id: `command-${option.id}`,
      label: option.slashCommand,
      group: 'Commands',
      description: option.summary,
      keywords: [option.label, ...option.keywords],
      onSelect: () => applyReplacement(`${option.slashCommand} `),
    })),
  ], [applyReplacement])
  const variableItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => {
    const sourceLines = String(props.markdownText || '').split(/\r?\n/)
    const workspaceVariables = collectMarkdownVariableBrowseRows({ sourceLines, draftText: props.input }).slice(0, 40).map(row => buildInlineVariableBrowseMenuItem({
      row,
      group: 'Workspace variables',
      onSelect: () => applyReplacement(buildMarkdownVariableToken({ mode: 'ref', key: row.key })),
    }))
    const mediaItems = [
      ...uploadedMediaItems,
      ...collectInlineMediaCommandCandidates({ sourceLines, draftText: props.input, limit: 20 }),
    ].filter((item, index, items) => items.findIndex(candidate => candidate.url === item.url) === index).slice(0, 20)
      .map(item => buildInlineMediaCommandMenuItem({
        candidate: item,
        idPrefix: 'media-',
        group: 'FloatingPanel Media',
        onSelect: () => applyReplacement(buildInlineMediaEmbed({
          kind: item.kind,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl,
          label: item.label,
          sourceKey: item.sourceKey,
          selectedText: '',
        })),
      }))
    return [...mediaItems, ...workspaceVariables]
  }, [applyReplacement, props.input, props.markdownText, uploadedMediaItems])
  const keywordItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => [
    ...CHAT_INVOCATION_OPTIONS.map(option => buildInlineCommandMenuItem({
      id: `invocation-${option.id}`,
      label: option.token,
      group: 'Runtime invocations',
      description: option.summary,
      keywords: [option.label, ...option.keywords, option.toolName || ''],
      onSelect: () => applyReplacement(`${option.token} `),
    })),
    ...collectInlineKeywordCommandCandidates({
      draftText: [props.markdownText, props.input].filter(Boolean).join('\n'),
      limit: 20,
    }).filter(candidate => !isChatInvocationToken(candidate.token)).map(candidate => buildInlineKeywordCommandMenuItem({
      candidate,
      label: candidate.token,
      replacement: `${candidate.token} `,
      onSelect: applyReplacement,
    })),
  ], [applyReplacement, props.input, props.markdownText])
  const items = trigger?.kind === 'slash' ? slashItems : trigger?.kind === 'keyword' ? keywordItems : variableItems
  const ariaLabel = trigger?.kind === 'slash' ? 'Chat slash commands' : trigger?.kind === 'keyword' ? 'Chat runtime invocations' : 'Chat variable commands'
  const menuListId = `${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-list`
  const composerOverlay = React.useMemo(() => buildFloatingPanelChatComposerOverlayParts(props.input), [props.input])
  const hasMediaOverlay = composerOverlay.hasMedia
  const hasComposerOverlay = composerOverlay.hasOverlay
  const displayInput = React.useMemo(() => buildFloatingPanelChatComposerDisplayText(props.input), [props.input])
  const deleteProjectedTokenRange = React.useCallback((target: HTMLInputElement | HTMLTextAreaElement, direction: 'backward' | 'forward'): boolean => {
    if (!hasComposerOverlay) return false
    const next = deleteFloatingPanelChatComposerProjectedTokenDisplayRange({
      text: props.input,
      selectionStart: target.selectionStart ?? target.value.length,
      selectionEnd: target.selectionEnd ?? target.value.length,
      direction,
    })
    if (!next) return false
    props.setInput(next.text)
    closeMenu()
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus({ preventScroll: true })
      input.setSelectionRange(next.cursor, next.cursor)
    })
    return true
  }, [closeMenu, hasComposerOverlay, props])

  return (
    <section ref={anchorRef} className={`relative border rounded overflow-hidden ${UI_RESPONSIVE_MULTILINE_TEXT_INPUT_EDITOR_CLASSNAME} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`}>
      {hasComposerOverlay ? (
        <style data-kg-chat-input-overlay-selection-style="1" data-kg-chat-input-media-selection-style={hasMediaOverlay ? '1' : undefined}>
          {FLOATING_PANEL_CHAT_COMPOSER_OVERLAY_SELECTION_STYLE}
        </style>
      ) : null}
      <FloatingPanelChatComposerMediaOverlay input={props.input} uiPanelTextFontClass={props.uiPanelTextFontClass} />
      <PlainTextInputEditor
        ref={inputRef}
        value={displayInput}
        onChange={value => {
          props.setInput(resolveFloatingPanelChatComposerRawText(value, props.input))
          updateTrigger(value)
        }}
        onSelect={event => updateTrigger(event.currentTarget.value)}
        onBeforeInput={event => {
          const inputType = (event.nativeEvent as InputEvent).inputType
          const direction = inputType === 'deleteContentBackward'
            ? 'backward'
            : inputType === 'deleteContentForward'
              ? 'forward'
              : null
          if (!direction) return
          if (!deleteProjectedTokenRange(event.currentTarget, direction)) return
          event.preventDefault()
        }}
        placeholder={props.placeholder}
        ariaLabel={props.placeholder}
        ariaExpanded={!!trigger}
        ariaControls={trigger ? menuListId : undefined}
        disabled={props.isLoading}
        multiline
        className="w-full h-full border-0 rounded-none bg-transparent"
        inputClassName={`${props.uiPanelTextFontClass} ${hasComposerOverlay ? 'text-transparent caret-[color:var(--kg-text-primary)] selection:bg-transparent' : ''}`}
        dataAttributes={{
          'data-kg-chat-input': true,
          'data-kg-chat-input-overlay-active': hasComposerOverlay ? '1' : undefined,
          'data-kg-chat-input-media-overlay-active': hasMediaOverlay ? '1' : undefined,
        }}
        onKeyDown={event => {
          if (hasComposerOverlay && (event.key === 'Backspace' || event.key === 'Delete')) {
            if (deleteProjectedTokenRange(event.currentTarget, event.key === 'Backspace' ? 'backward' : 'forward')) {
              event.preventDefault()
              return
            }
          }
          if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter' || props.isSubmitDisabled) return
          event.preventDefault()
          event.currentTarget.form?.requestSubmit()
        }}
      />
      <AnchorOverlay anchorRef={anchorRef} open={!!trigger} onClose={closeMenu} align="top-left" className={`w-[min(22rem,calc(100vw-1rem))] rounded border p-2 shadow-sm ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}>
        <MarkdownBlockContainerCommandMenu
          ariaLabel={ariaLabel}
          items={items}
          query={query}
          onQueryChange={setQuery}
          onCancel={closeMenu}
          placeholder={trigger?.kind === 'slash' ? 'Find command' : trigger?.kind === 'keyword' ? 'Find runtime or keyword' : 'Find workspace variable'}
          inputClassName={FLOATING_POPOVER_INPUT_CLASSNAME}
          itemClassName={FLOATING_MENU_BUTTON_CLASSNAME}
          itemDisabledClassName={FLOATING_MENU_BUTTON_DISABLED_CLASSNAME}
          itemDangerClassName={FLOATING_MENU_BUTTON_DANGER_CLASSNAME}
          emptyLabel={trigger?.kind === 'slash' ? 'No commands' : trigger?.kind === 'keyword' ? 'No runtime invocations' : 'No workspace variables'}
          selectOnPointerDown={false}
        />
      </AnchorOverlay>
    </section>
  )
}
