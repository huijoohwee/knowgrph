import { useParserUIState } from '@/features/parsers/uiState'

export function testParserUIStateHydration() {
  const s = useParserUIState.getState()
  s.reset()
  s.setLastInput('nodes.csv', 'id,label,type\n1,a,t')
  s.setSelectedId('csv')
  s.setWarnings(['sample warning'])
  s.setCounts({ n: 1, e: 0 })
  s.setAttemptedAutoDetect(true)
  const after = useParserUIState.getState()
  if (after.inputName !== 'nodes.csv') throw new Error('inputName not set')
  if (!after.inputText.includes('id,label,type')) throw new Error('inputText not set')
  if (after.selectedId !== 'csv') throw new Error('selectedId not set')
  if ((after.warnings || []).length !== 1) throw new Error('warnings not set')
  if (after.counts.n !== 1 || after.counts.e !== 0) throw new Error('counts not set')
  if (!after.attemptedAutoDetect) throw new Error('attemptedAutoDetect not set')
}

