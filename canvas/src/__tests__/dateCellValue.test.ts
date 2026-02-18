import { formatDateDraftFromCellValue, normalizeDateDraftToValue } from '@/features/graph-table/ui/fast-grid/dateCellValue'

export function testGraphTableDateNormalizeAcceptsYmd() {
  const r = normalizeDateDraftToValue('2026-2-7')
  if (!r.ok || r.value !== '2026-02-07') {
    throw new Error('expected YYYY-M-D to normalize to YYYY-MM-DD')
  }
}

export function testGraphTableDateNormalizeAcceptsMdySlash() {
  const r = normalizeDateDraftToValue('2/7/2026')
  if (!r.ok || r.value !== '2026-02-07') {
    throw new Error('expected M/D/YYYY to normalize to YYYY-MM-DD')
  }
}

export function testGraphTableDateNormalizeRejectsInvalid() {
  const r = normalizeDateDraftToValue('2026-02-31')
  if (r.ok) {
    throw new Error('expected invalid date to be rejected')
  }
}

export function testGraphTableDateFormatDraftFromIso() {
  const v = formatDateDraftFromCellValue('2026-02-07T12:34:56.000Z')
  if (v !== '2026-02-07') {
    throw new Error('expected ISO timestamp to format to YYYY-MM-DD')
  }
}

