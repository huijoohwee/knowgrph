export function shouldOpenMarkdownViewerInlineEditorFromReadClick(args: {
  eventDetail: number
}): boolean {
  return args.eventDetail < 2
}

