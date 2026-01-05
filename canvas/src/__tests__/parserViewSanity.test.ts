import ParserView from '@/features/panels/views/ParserView'

export function testParserViewComponentExports() {
  if (typeof ParserView !== 'function') throw new Error('ParserView component not exported')
}
