import { hashStringToIndex } from 'grph-shared/hash/stringHash'

const PALETTE = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#D97706', '#0EA5E9']

export function colorForDataset(datasetId: string): string {
  const idx = hashStringToIndex(String(datasetId || ''), PALETTE.length)
  return PALETTE[idx] || '#2563EB'
}
