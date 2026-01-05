export const graphDataTableToolbarButtonClassName = (active: boolean) =>
  `inline-flex items-center justify-center whitespace-nowrap font-normal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 gap-2 border border-gray-200 bg-white shadow-sm hover:bg-gray-50 rounded-md text-xs h-7 px-2 shrink-0 truncate ${
    active ? 'bg-gray-100' : ''
  }`;

export const GRAPH_DATA_TABLE_TOOLBAR_ACTIVE_CLASS = '!bg-white !text-blue-600 !border-blue-600';

