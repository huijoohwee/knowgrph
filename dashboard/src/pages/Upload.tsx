import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { processCSVUpload } from '../utils/csvProcessor';

export default function Upload() {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(f => f.type === 'text/csv' || f.name.endsWith('.csv'));
    
    if (csvFile) {
      await handleFile(csvFile);
    } else {
      setStatus('error');
      setMessage('Please drop a valid CSV file.');
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setStatus('processing');
    setMessage('Processing CSV file...');

    try {
      await processCSVUpload(file);
      setStatus('success');
      setMessage('CSV processed successfully! Redirecting to visualization...');
      setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to process CSV file.');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setStatus('idle');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Upload CSV</h1>
              <span className="ml-2 text-sm text-gray-500">Regenerate pipeline</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            >
              Back to Visualization
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl shadow-lg border">
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload CSV File</h2>
                <p className="text-gray-600">
                  Drop your CSV file here or click to browse. This will trigger pipeline regeneration.
                </p>
              </div>

              {/* Upload Area */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : status === 'error'
                    ? 'border-red-300 bg-red-50'
                    : status === 'success'
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />

                <div className="space-y-4">
                  {status === 'processing' ? (
                    <>
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-blue-600 font-medium">{message}</p>
                    </>
                  ) : status === 'success' ? (
                    <>
                      <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                      <p className="text-green-600 font-medium">{message}</p>
                    </>
                  ) : status === 'error' ? (
                    <>
                      <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
                      <p className="text-red-600 font-medium">{message}</p>
                      <button
                        onClick={reset}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Try again
                      </button>
                    </>
                  ) : (
                    <>
                      <UploadIcon className="w-12 h-12 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-gray-600 font-medium">
                          Drop CSV file here or click to browse
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Supports .csv files up to 10MB
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Expected CSV Format</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Your CSV should follow the A0 schema with these required columns:
                </p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono block overflow-x-auto">
                  graph_id,domain,category,stage,entity_type,subject,predicate,object,attribute,value,role,action,outcome,challenge,solution,context,source_location,source_type,component_name,operation_name,operation_description,temporal_marker,impact_description,source_reference,metadata_json
                </code>
              </div>

              {/* Sample Data */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Sample Data Available</h3>
                <p className="text-sm text-blue-800">
                  Current visualization is based on README.md Example Flow. Upload your own CSV to customize.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}