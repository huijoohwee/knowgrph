export function applyMarkdownTocSelectionById(args: {
  itemId: string
  lineById: ReadonlyMap<string, number>
  setActiveItemId: (itemId: string) => void
  onRevealLine: (line: number) => void
}): boolean {
  args.setActiveItemId(args.itemId)
  const line = args.lineById.get(args.itemId)
  if (!line) return false
  args.onRevealLine(line)
  return true
}
