export function buildMarkdownSidebarTitleClassName({
  uiPanelTextFontClass,
  uiPanelMicroLabelTextSizeClass,
  uiPanelKeyValueTextSizeClass,
  fallbackSizeClass = 'text-[10px]',
  textColorClassName,
}: {
  uiPanelTextFontClass: string
  uiPanelMicroLabelTextSizeClass?: string
  uiPanelKeyValueTextSizeClass?: string
  fallbackSizeClass?: string
  textColorClassName: string
}) {
  return [
    uiPanelTextFontClass,
    uiPanelMicroLabelTextSizeClass || uiPanelKeyValueTextSizeClass || fallbackSizeClass,
    'font-semibold uppercase tracking-wide truncate',
    textColorClassName,
  ].join(' ')
}
