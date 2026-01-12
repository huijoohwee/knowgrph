import React from 'react';
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection';
import { HELP_STEP_COPY } from '@/features/panels/config';
import { UI_COPY } from '@/lib/config';
import { useGraphStore } from '@/hooks/useGraphStore';
import { uiPrimaryPillActiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';

interface HelpShortcutsSectionProps {
  collapsed: boolean;
  onToggle: (next: boolean) => void;
  shortcuts: string[];
  onCopyAllShortcuts: () => void;
  onLaunchSpotlight: () => void;
}

export function HelpShortcutsSection({
  collapsed,
  onToggle,
  shortcuts,
  onCopyAllShortcuts,
  onLaunchSpotlight,
}: HelpShortcutsSectionProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  );
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  );

  const shortcutsText = React.useMemo(() => shortcuts.join('\n'), [shortcuts]);

  return (
    <CollapsibleSection
      title={HELP_STEP_COPY.shortcuts.title}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {HELP_STEP_COPY.shortcuts.descriptionShort && (
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {HELP_STEP_COPY.shortcuts.descriptionShort}
        </div>
      )}
      <div>
        {shortcuts.map(shortcut => (
          <div
            key={shortcut}
            className={`py-1 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-700`}
          >
            {shortcut}
          </div>
        ))}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onCopyAllShortcuts}
          className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
        >
          Copy All
        </button>
        <button
          type="button"
          onClick={onLaunchSpotlight}
          className={`App-toolbar__btn text-xs ${uiPrimaryPillActiveClassName}`}
        >
          Launch
        </button>
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500`}>
          {shortcutsText.length > 0 ? UI_COPY.helpShortcutsCountStatus(shortcuts.length) : UI_COPY.helpNoShortcutsMatched}
        </div>
      </div>
    </CollapsibleSection>
  );
}
