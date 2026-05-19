import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import type { FlowDetails } from '@/features/settings/types'

type SettingsEntryDetailsTableProps = {
  details: FlowDetails
  uiPanelKeyValueTextSizeClass: string
}

export function SettingsEntryDetailsTable({ details, uiPanelKeyValueTextSizeClass }: SettingsEntryDetailsTableProps) {
  const modules = (details.modules || []).join(', ') || '—'
  const classes = (details.classes || []).join(', ') || '—'
  const functions = (details.functions || []).join(', ') || '—'
  return (
    <div className={`mt-0 mb-0 min-w-0 max-w-full overflow-hidden text-xs ${UI_THEME_TOKENS.text.secondary} border-l pl-2`}>
      <table className={`w-full table-fixed text-left border-collapse ${uiPanelKeyValueTextSizeClass || ''}`}>
        <thead>
          <tr>
            <th className={`font-medium p-1 ${UI_TEXT_TRUNCATE}`}>Modules</th>
            <th className={`font-medium p-1 ${UI_TEXT_TRUNCATE}`}>Classes/Objects</th>
            <th className={`font-medium p-1 ${UI_TEXT_TRUNCATE}`}>Functions/Methods</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`p-1 align-top border-b ${UI_THEME_TOKENS.table.cellBorder}`} title={modules}><span className={`block ${UI_TEXT_TRUNCATE}`}>{modules}</span></td>
            <td className={`p-1 align-top border-b ${UI_THEME_TOKENS.table.cellBorder}`} title={classes}><span className={`block ${UI_TEXT_TRUNCATE}`}>{classes}</span></td>
            <td className={`p-1 align-top border-b ${UI_THEME_TOKENS.table.cellBorder}`} title={functions}><span className={`block ${UI_TEXT_TRUNCATE}`}>{functions}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
