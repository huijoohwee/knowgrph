import React from 'react';
import { useGraphStore } from '@/hooks/useGraphStore';
import { uiPrimaryIconActiveClassName, uiPrimaryIconInactiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';
import {
  type SelectionPerfSubscriber,
  setSelectionPerfEnabled,
} from '@/lib/selectionPerf';
import { UI_LABELS } from '@/lib/config';

export default function StatusBar() {
  const { graphData, selectedNodeId } = useGraphStore();
  const [perfEnabled, setPerfEnabled] = React.useState(false);
  const [samples, setSamples] = React.useState<
    { subscriber: SelectionPerfSubscriber; durationMs: number; ts: number }[]
  >([]);

  React.useEffect(() => {
    setSelectionPerfEnabled(perfEnabled);
  }, [perfEnabled]);

  React.useEffect(() => {
    if (!perfEnabled) return;
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const e = event as CustomEvent<{
        subscriber: SelectionPerfSubscriber;
        durationMs: number;
        ts: number;
      }>;
      const detail = e.detail;
      if (!detail) return;
      setSamples(prev => {
        const next = [...prev, detail];
        const limit = 40;
        if (next.length > limit) return next.slice(next.length - limit);
        return next;
      });
    };
    window.addEventListener('kg-selection-perf', handler as EventListener);
    return () => {
      window.removeEventListener('kg-selection-perf', handler as EventListener);
    };
  }, [perfEnabled]);

  const stats = React.useMemo(() => {
    const groups: Record<
      SelectionPerfSubscriber,
      { count: number; sum: number; last: number | null }
    > = {
      canvas: { count: 0, sum: 0, last: null },
      three: { count: 0, sum: 0, last: null },
      nodeEditor: { count: 0, sum: 0, last: null },
      graphDataTable: { count: 0, sum: 0, last: null },
    };
    samples.forEach(s => {
      const g = groups[s.subscriber];
      g.count += 1;
      g.sum += s.durationMs;
      g.last = s.durationMs;
    });
    return groups;
  }, [samples]);

  const nodeCount = graphData?.nodes.length || 0;
  const edgeCount = graphData?.edges.length || 0;
  const selectedLabel = graphData?.nodes.find(n => n.id === selectedNodeId)?.label || UI_LABELS.noneLabel;
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  );

  return (
    <footer className="StatusBar" aria-label={UI_LABELS.statusBarAriaLabel}>
      <div className="flex items-center gap-4">
        <span>{UI_LABELS.nodesLabel} {nodeCount}</span>
        <span>{UI_LABELS.edgesLabel} {edgeCount}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>
          {UI_LABELS.selectedLabel} <span className="font-medium">{selectedLabel}</span>
        </span>
        {import.meta.env.DEV && (
          <div className={`flex items-center gap-2 ${uiPanelKeyValueTextSizeClass} text-gray-600`}>
            <button
              type="button"
              className={`px-2 py-0.5 rounded border ${
                perfEnabled ? `border-blue-500 ${uiPrimaryIconActiveClassName}` : `border-gray-300 ${uiPrimaryIconInactiveClassName}`
              }`}
              onClick={() => setPerfEnabled(v => !v)}
            >
              {UI_LABELS.perfButtonLabel}
            </button>
            {perfEnabled && (
              <div className="flex flex-wrap gap-2">
        {(['canvas', 'three', 'nodeEditor', 'graphDataTable'] as const).map(name => {
                  const s = stats[name];
                  if (!s.count || s.last == null) {
                    return (
                      <span key={name}>
                        {name}: -
                      </span>
                    );
                  }
                  const avg = s.sum / s.count;
                  return (
                    <span key={name}>
                      {name}: {s.last.toFixed(1)}ms avg {avg.toFixed(1)}ms n={s.count}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
