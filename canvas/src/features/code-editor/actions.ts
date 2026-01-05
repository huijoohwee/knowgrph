import type { GraphData } from '@/lib/graph/types'

export type CodeAction = { label: string; onClick: () => void; variant?: 'primary' }

export function buildCodeActions(
  formatEditor: () => void,
  applyJson: () => void,
  graphData: GraphData | null,
  setCodeText: (v: string) => void,
  setCodeError: (v: string) => void,
  fallback: GraphData,
): CodeAction[] {
  return [
    { label: 'Format', onClick: formatEditor },
    { label: 'Apply', onClick: applyJson, variant: 'primary' },
    {
      label: 'Revert',
      onClick: () => {
        const next = graphData ?? fallback
        setCodeText(JSON.stringify(next, null, 2))
        setCodeError('')
      },
    },
  ]
}
