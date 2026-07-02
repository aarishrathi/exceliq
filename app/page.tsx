'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, Zap, Shield, GitBranch, AlertTriangle } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedBy, setUploadedBy] = useState('');
  const [workbookName, setWorkbookName] = useState('');

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(xlsx|xlsm|xls)$/i)) {
        setError('Only .xlsx, .xlsm, and .xls files are supported.');
        return;
      }
      if (!uploadedBy.trim()) {
        setError('Please enter your name before uploading.');
        return;
      }

      setError(null);
      setIsUploading(true);
      setUploadStatus('Uploading file...');

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadedBy', uploadedBy.trim());
        formData.append('workbookName', workbookName.trim() || file.name);

        setUploadStatus('Parsing workbook structure...');
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Upload failed');
        }

        const data = await res.json();
        setUploadStatus('Analysis complete! Redirecting...');
        setTimeout(() => router.push(`/workbook/${data.workbookId}`), 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setIsUploading(false);
        setUploadStatus(null);
      }
    },
    [uploadedBy, workbookName, router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <main className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-brand-500" size={24} />
          <span className="text-xl font-bold text-white">ExcelIQ</span>
          <span className="text-xs text-gray-500 ml-1">Workbook Intelligence</span>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Team Dashboard →
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Your Excel workbooks,{' '}
            <span className="text-brand-500">intelligently audited</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Upload any Excel file. Get an AI-powered semantic diff, anomaly flags,
            and a full audit trail — instantly.
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {[
            { icon: GitBranch, label: 'Semantic Diff' },
            { icon: AlertTriangle, label: 'Anomaly Detection' },
            { icon: Shield, label: 'Audit Log' },
            { icon: Zap, label: 'AI-Powered Analysis' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-2 text-sm text-gray-300"
            >
              <Icon size={14} className="text-brand-500" />
              {label}
            </div>
          ))}
        </div>

        {/* Upload Form */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Your Name *</label>
              <input
                type="text"
                value={uploadedBy}
                onChange={(e) => setUploadedBy(e.target.value)}
                placeholder="e.g. Aarish Rathi"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Workbook Label (optional)</label>
              <input
                type="text"
                value={workbookName}
                onChange={(e) => setWorkbookName(e.target.value)}
                placeholder="e.g. Q2 Feasibility Model"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-brand-500 bg-brand-500/5'
                : 'border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => {
              if (!isUploading) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xlsx,.xlsm,.xls';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFile(file);
                };
                input.click();
              }
            }}
          >
            {isUploading ? (
              <div>
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-500 border-t-transparent mx-auto mb-4" />
                <p className="text-gray-300 text-sm">{uploadStatus}</p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto text-gray-500 mb-4" size={40} />
                <p className="text-gray-300 font-medium">Drop your Excel file here</p>
                <p className="text-gray-500 text-sm mt-1">or click to browse — .xlsx, .xlsm supported</p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
