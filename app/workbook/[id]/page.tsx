'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FileSpreadsheet, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  GitBranch, Clock, User, Zap, ArrowLeft
} from 'lucide-react';
import type { Workbook, WorkbookVersion, AnomalyFlag } from '@/types/workbook';

function SeverityBadge({ severity }: { severity: AnomalyFlag['severity'] }) {
  const map = {
    critical: 'bg-red-900/40 text-red-400 border-red-800',
    warning: 'bg-yellow-900/40 text-yellow-400 border-yellow-800',
    info: 'bg-blue-900/40 text-blue-400 border-blue-800',
  };
  return (
    <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${map[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function FlagCard({ flag, onResolve }: { flag: AnomalyFlag; onResolve: (id: string, note: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [resolvedBy, setResolvedBy] = useState('');

  return (
    <div className={`border rounded-xl p-4 transition-all ${
      flag.status === 'resolved'
        ? 'border-gray-800 opacity-60'
        : flag.severity === 'critical'
        ? 'border-red-800/60 bg-red-900/10'
        : flag.severity === 'warning'
        ? 'border-yellow-800/60 bg-yellow-900/10'
        : 'border-gray-800'
    }`}>
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${
            flag.severity === 'critical' ? 'text-red-400' :
            flag.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
          }`} />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-white">{flag.title}</span>
              <SeverityBadge severity={flag.severity} />
              {flag.status === 'resolved' && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle size={11} /> Resolved
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{flag.description}</p>
            {flag.affectedCell && (
              <span className="text-xs text-gray-500 font-mono mt-1 inline-block">
                {flag.affectedSheet} → {flag.affectedCell}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          {flag.aiInferredCause && (
            <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-1 text-xs text-brand-400 mb-1">
                <Zap size={11} /> AI Analysis
              </div>
              <p className="text-xs text-gray-300">{flag.aiInferredCause}</p>
            </div>
          )}
          {flag.status === 'open' && (
            <div className="space-y-2">
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                placeholder="Your name"
                value={resolvedBy}
                onChange={(e) => setResolvedBy(e.target.value)}
              />
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                placeholder="Resolution note (e.g. intentional override for Q2 adjustment)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                onClick={() => onResolve(flag.id, `${resolvedBy}: ${note}`)}
                disabled={!note.trim() || !resolvedBy.trim()}
                className="text-xs bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-lg px-4 py-2 transition-colors"
              >
                Mark as Resolved
              </button>
            </div>
          )}
          {flag.status === 'resolved' && flag.resolutionNote && (
            <p className="text-xs text-gray-500 italic">Note: {flag.resolutionNote}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkbookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [versions, setVersions] = useState<WorkbookVersion[]>([]);
  const [flags, setFlags] = useState<AnomalyFlag[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<WorkbookVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'flags' | 'diff' | 'log'>('flags');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedBy, setUploadedBy] = useState('');

  const load = async () => {
    const [wb, vs, fs] = await Promise.all([
      fetch(`/api/workbooks/${id}`).then((r) => r.json()),
      fetch(`/api/workbooks/${id}/versions`).then((r) => r.json()),
      fetch(`/api/workbooks/${id}/flags`).then((r) => r.json()),
    ]);
    setWorkbook(wb.workbook);
    setVersions(vs.versions ?? []);
    setFlags(fs.flags ?? []);
    setSelectedVersion(vs.versions?.[0] ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleResolve = async (flagId: string, note: string) => {
    await fetch(`/api/workbooks/${id}/flags/${flagId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    await load();
  };

  const handleNewVersion = async (file: File) => {
    if (!uploadedBy.trim()) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', uploadedBy);
    formData.append('workbookId', id);
    await fetch('/api/upload', { method: 'POST', body: formData });
    setIsUploading(false);
    await load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!workbook) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Workbook not found.</div>;
  }

  const openFlags = flags.filter((f) => f.status === 'open');
  const resolvedFlags = flags.filter((f) => f.status === 'resolved');

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <FileSpreadsheet className="text-brand-500" size={22} />
          <div>
            <span className="font-semibold text-white">{workbook.name}</span>
            <span className="text-xs text-gray-500 ml-2">v{versions.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Your name"
            value={uploadedBy}
            onChange={(e) => setUploadedBy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
          />
          <label className="text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-4 py-2 transition-colors cursor-pointer">
            {isUploading ? 'Analyzing...' : '+ New Version'}
            <input
              type="file" className="hidden" accept=".xlsx,.xlsm"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNewVersion(f); }}
            />
          </label>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Health + Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Health Score</div>
            <div className={`text-2xl font-bold ${
              workbook.healthScore >= 80 ? 'text-green-400' :
              workbook.healthScore >= 50 ? 'text-yellow-400' : 'text-red-400'
            }`}>{workbook.healthScore}/100</div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Open Flags</div>
            <div className="text-2xl font-bold text-red-400">{openFlags.length}</div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Versions</div>
            <div className="text-2xl font-bold text-white">{versions.length}</div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Resolved</div>
            <div className="text-2xl font-bold text-green-400">{resolvedFlags.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Flags + Diff */}
          <div className="col-span-2">
            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-gray-900 rounded-lg p-1 border border-gray-800 w-fit">
              {(['flags', 'diff', 'log'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    tab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t === 'flags' ? `Flags (${openFlags.length})` : t === 'diff' ? 'Latest Diff' : 'Audit Log'}
                </button>
              ))}
            </div>

            {tab === 'flags' && (
              <div className="space-y-3">
                {flags.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                    No anomalies detected.
                  </div>
                )}
                {flags.map((flag) => (
                  <FlagCard key={flag.id} flag={flag} onResolve={handleResolve} />
                ))}
              </div>
            )}

            {tab === 'diff' && selectedVersion?.diff && (
              <div className="space-y-4">
                {selectedVersion.diff.structuralChanges.map((c, i) => (
                  <div key={i} className={`rounded-lg p-3 text-sm font-mono ${
                    c.changeType.includes('removed') || c.changeType.includes('deleted')
                      ? 'diff-removed' : 'diff-added'
                  }`}>
                    <span className="text-xs text-gray-500 uppercase">{c.changeType}</span>
                    <p className="text-gray-200 mt-1">{c.detail}</p>
                  </div>
                ))}
                {selectedVersion.diff.cellChanges.slice(0, 50).map((c, i) => (
                  <div key={i} className={`rounded-lg p-3 text-sm font-mono ${
                    c.changeType === 'formula_changed' ? 'diff-modified' : 'diff-modified'
                  }`}>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="uppercase">{c.changeType.replace('_', ' ')}</span>
                      <span className="text-brand-400">{c.sheet}!{c.cell}</span>
                    </div>
                    {c.oldFormula && <p className="text-red-400">- {c.oldFormula}</p>}
                    {c.newFormula && <p className="text-green-400">+ {c.newFormula}</p>}
                    {!c.oldFormula && !c.newFormula && (
                      <p className="text-gray-300">{c.oldValue} → {c.newValue}</p>
                    )}
                  </div>
                ))}
                {selectedVersion.diff.cellChanges.length === 0 && selectedVersion.diff.structuralChanges.length === 0 && (
                  <p className="text-gray-500 text-sm">No changes in this version.</p>
                )}
              </div>
            )}

            {tab === 'log' && (
              <div className="space-y-3">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-gray-700"
                    onClick={() => { setSelectedVersion(v); setTab('diff'); }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">v{v.versionNumber}</span>
                        <span className="text-sm font-medium text-white">{v.fileName}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(v.uploadedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1"><User size={11} /> {v.uploadedBy}</span>
                      <span className="flex items-center gap-1"><GitBranch size={11} /> {v.diff?.totalChanges ?? 0} changes</span>
                    </div>
                    {v.aiSummary && (
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-xs text-brand-400 mb-1">
                          <Zap size={11} /> AI Summary
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">{v.aiSummary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Version sidebar */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Clock size={14} /> Version History
            </h3>
            <div className="space-y-2">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersion(v)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedVersion?.id === v.id
                      ? 'border-brand-600 bg-brand-900/20'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-400">v{v.versionNumber}</span>
                    <span className="text-xs text-gray-600">
                      {new Date(v.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1 truncate">{v.uploadedBy}</p>
                  <p className="text-xs text-gray-600">{v.diff?.totalChanges ?? 0} changes</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
