import React from 'react'
import { type SlashMenuState, type VariableMenuState, toStableSlashMenuState, toStableVariableMenuState } from './markdownBlockContainerCore.menuState'
import {
  toMarkdownBlockBubbleScheduleKey,
  toMarkdownBlockInlineEditRangeToken,
  toMarkdownBlockMouseUpSyncScheduleKey,
} from './markdownBlockContainerCore.stateSync'

export const useMarkdownBlockContainerInlineUiState = (args: {
  startLine: number
  endLine?: number
}) => {
  const [bubble, setBubble] = React.useState<{ show: boolean; leftPx: number; topPx: number }>({ show: false, leftPx: 0, topPx: 0 })
  const [slashMenu, setSlashMenu] = React.useState<SlashMenuState>({ show: false, leftPx: 0, topPx: 0, kind: 'slash', query: '' })
  const [variableMenu, setVariableMenu] = React.useState<VariableMenuState>({
    show: false,
    leftPx: 0,
    topPx: 0,
    query: '',
    keyInput: '',
    valueInput: '',
    fallbackInput: '',
    mode: 'ref',
  })
  const [linkPopover, setLinkPopover] = React.useState<{ show: boolean; leftPx: number; topPx: number; href: string }>({ show: false, leftPx: 0, topPx: 0, href: '' })
  const [commentPreview, setCommentPreview] = React.useState<{ show: boolean; leftPx: number; topPx: number; text: string }>({ show: false, leftPx: 0, topPx: 0, text: '' })
  const bubbleAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const slashAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const variableAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const linkAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const commentAnchorRef = React.useRef<HTMLSpanElement | null>(null)
  const slashMenuRef = React.useRef<HTMLElement | null>(null)
  const bubbleRafRef = React.useRef(0)
  const rangeToken = React.useMemo(
    () => toMarkdownBlockInlineEditRangeToken(args.startLine, args.endLine),
    [args.endLine, args.startLine],
  )
  const bubbleScheduleKey = React.useMemo(() => toMarkdownBlockBubbleScheduleKey(rangeToken), [rangeToken])
  const editorMouseUpSyncScheduleKey = React.useMemo(() => toMarkdownBlockMouseUpSyncScheduleKey(rangeToken), [rangeToken])

  const setSlashMenuStable = React.useCallback((next: SlashMenuState) => {
    setSlashMenu(prev => toStableSlashMenuState(prev, next))
  }, [])

  const setVariableMenuStable = React.useCallback((next: {
    show: boolean
    leftPx: number
    topPx: number
    query?: string
    keyInput?: string
  }) => {
    setVariableMenu(prev => toStableVariableMenuState(prev, next))
  }, [])

  return {
    bubble,
    setBubble,
    slashMenu,
    setSlashMenu,
    variableMenu,
    setVariableMenu,
    linkPopover,
    setLinkPopover,
    commentPreview,
    setCommentPreview,
    bubbleAnchorRef,
    slashAnchorRef,
    variableAnchorRef,
    linkAnchorRef,
    commentAnchorRef,
    slashMenuRef,
    bubbleRafRef,
    bubbleScheduleKey,
    editorMouseUpSyncScheduleKey,
    setSlashMenuStable,
    setVariableMenuStable,
  }
}
