'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import type { Workbook } from '@/types/workbook';

export default function DashboardPage() {
  const router = useRouter();
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workbooks')
      .then((r) => r.json())
      .then((data) => { setWorkbooks(data.workbooks ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalFlags = workbooks.reduce((sum, w) => sum + (w.openFlagCount ?? 0), 0);
  const avgHealth = workbooks.length
    ? Math.round(workbooks.reduce((sum, w) => sum + w.healthScore, 0) / workbooks.length)
    : 100;

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-brand-500" size={24} />
          <span className="text-xl font-bold text-white">ExcelIQ</span>
          <span className="text-xs text-gray-500 ml-1">Team Dashboard</span>
        </div>
        <button
          onClick={() => router.push('/')}
          className="text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-4 py-2 transition-colors"
        >
          + Upload Workbook
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Workbooks', value: workbooks.length, icon: FileSpreadsheet, color: 'text-blue-400' },
            { label: 'Open Flags', value: totalFlags, icon: AlertTriangle, color: 'text-red-400' },
            { label: 'Avg Health Score', value: `${avgHealth}/100`, icon: TrendingUp, color: 'text-brand-400' },
            { label: 'Resolved Flags', value: '—', icon: CheckCircle, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">{label}</span>
                <Icon size={18} className={color} />
              </div>
              <div className="text-2xl font-bold text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* Workbooks Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">Monitored Workbooks</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : workbooks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-4">No workbooks yet.</p>
              <button
                onClick={() => router.push('/')}
                className="text-sm text-brand-500 hover:underline"
              >
                Upload your first workbook →
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left px-6 py-3">Workbook</th>
                  <th className="text-left px-6 py-3">Last Modified</th>
                  <th className="text-left px-6 py-3">Health</th>
                  <th className="text-left px-6 py-3">Open Flags</th>
                  <th className="text-left px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {workbooks.map((wb) => (
                  <tr
                    key={wb.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/workbook/${wb.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet size={18} className="text-brand-500" />
                        <div>
                          <div className="font-medium text-white text-sm">{wb.name}</div>
                          <div className="text-xs text-gray-500">{wb.createdBy}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Clock size={13} />
                        {new Date(wb.lastModifiedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              wb.healthScore >= 80 ? 'bg-green-500' :
                              wb.healthScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${wb.healthScore}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-300">{wb.healthScore}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {wb.openFlagCount > 0 ? (
                        <span className="flex items-center gap-1 text-sm text-red-400">
                          <AlertTriangle size={13} />
                          {wb.openFlagCount} open
                        </span>
                      ) : (
                        <span className="text-sm text-green-400">Clean</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-brand-500">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
