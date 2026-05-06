import { resolvePresentationFrameModel } from '@/features/markdown/ui/markdownPresentationFrame'

export function testMarkdownPresentationFrameModelRespectsFrameVariantAndPadding() {
  const darkFrame = resolvePresentationFrameModel({
    slideMeta: { frame: 'dark', framePadding: '24' },
    headMeta: {},
    isAcademicTheme: false,
  })
  if (!darkFrame.baseFrameClass.includes('bg-gray-900')) {
    throw new Error('Expected dark frame variant to use dark palette classes')
  }
  if (darkFrame.slideFramePaddingPx !== 24) {
    throw new Error('Expected numeric frame padding parsed from string')
  }
}
