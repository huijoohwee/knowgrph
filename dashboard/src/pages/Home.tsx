import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ZoomIn, ZoomOut, RotateCcw, Upload } from 'lucide-react';
import FlowDiagram from '../components/FlowDiagram';
import { loadFlowData } from '../utils/dataLoader';
import { FlowDiagramData } from '../types/flow';
import { flowToJsonLd, saveJsonLdToFile } from '../utils/jsonldSerializer';

export default function Home() {
  const [data, setData] = useState<FlowDiagramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'flow' | 'graph' | 'timeline'>('flow');
  const [editable, setEditable] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    loadFlowData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading visualization...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No data available</p>
          <Link
            to="/upload"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">KnowGrph Flow Visualizer</h1>
              <span className="ml-2 text-sm text-gray-500">README Example Flow</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['flow', 'graph', 'timeline'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      viewMode === mode
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setEditable((e) => !e)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${editable ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
              >
                {editable ? 'Editing Enabled' : 'Enable Editing'}
              </button>
              <Link
                to="/upload"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-lg border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Pipeline Flow Visualization</h2>
              <p className="mt-1 text-sm text-gray-600">
                Interactive diagram showing the README Example Flow. Drag to pan, scroll to zoom.
              </p>
            </div>
            <div className="relative">
              <FlowDiagram
                data={data}
                viewMode={viewMode}
                editable={editable}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onNodePositionChange={(id, x, y) => {
                  if (!data) return;
                  const nodes = data.nodes.map(n => n.id === id ? { ...n, position: { x, y } } : n);
                  setData({ ...data, nodes });
                }}
              />
            </div>
            {/* Editor & Sync Controls */}
            <div className="p-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Sync Back</h3>
                  <p className="text-sm text-gray-600">Save edits to JSON-LD and sync back to data/outputs.</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={async () => {
                      if (!data) return;
                      const jsonld = flowToJsonLd(data);
                      const ok = await saveJsonLdToFile(jsonld, 'a0.jsonld');
                      setStatus(ok ? 'Saved to data/outputs/a0.jsonld' : 'Downloaded a0.jsonld');
                    }}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Save JSON-LD
                  </button>
                  <button
                    onClick={() => {
                      setStatus('To update RDF: run "../.venv/bin/python ../scripts/jsonld_to_rdf.py" from repo root.');
                    }}
                    className="px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                  >
                    Show RDF Update Command
                  </button>
                </div>
              </div>
              {selectedNodeId && data && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900">Edit Selected Node</h4>
                  <div className="mt-2 flex items-center space-x-2">
                    <input
                      type="text"
                      value={data.nodes.find(n => n.id === selectedNodeId)?.label || ''}
                      onChange={(e) => {
                        const label = e.target.value;
                        const nodes = data.nodes.map(n => n.id === selectedNodeId ? { ...n, label } : n);
                        setData({ ...data, nodes });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg w-80"
                    />
                    <button
                      onClick={() => setSelectedNodeId(null)}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
              {status && (
                <p className="mt-4 text-sm text-gray-700">{status}</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
