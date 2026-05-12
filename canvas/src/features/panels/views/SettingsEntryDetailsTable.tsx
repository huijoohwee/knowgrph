import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { FlowDetails } from '@/features/settings/types'

type SettingsEntryDetailsTableProps = {
  details: FlowDetails
  uiPanelKeyValueTextSizeClass: string
}

export function SettingsEntryDetailsTable({ details, uiPanelKeyValueTextSizeClass }: SettingsEntryDetailsTableProps) {
  return (
    <div className={`mt-0 mb-0 text-xs ${UI_THEME_TOKENS.text.secondary} border-l pl-2`}>
      <table className={`w-full text-left border-collapse ${uiPanelKeyValueTextSizeClass || ''}`}>
        <thead>
          <tr>
            <th className="font-medium p-1">Modules</th>
            <th className="font-medium p-1">Classes/Objects</th>
            <th className="font-medium p-1">Functions/Methods</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`p-1 align-top border-b ${UI_THEME_TOKENS.table.cellBorder}`}>{(details.modules || []).join(', ') || '—'}</td>
            <td className={`p-1 align-top border-b ${UI_THEME_TOKENS.table.cellBorder}`}>{(details.classes || []).join(', ') || '—'}</td>
            <td className={`p-1 align-top border-b ${UI_THEME_TOKENS.table.cellBorder}`}>{(details.functions || []).join(', ') || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
