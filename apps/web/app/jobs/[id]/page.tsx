'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';

function formatTime(val: string | null | undefined) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleTimeString();
}

function formatDateTime(val: string | null | undefined) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString();
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.getJob(id);
        setData(result);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [id]);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <p className="text-[#64748b]">Loading...</p>
      </div>
    );
  }

  const { job, executions, logs } = data;

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0]">
      <header className="border-b border-[#2a2d3a] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-[#64748b] hover:text-white text-sm transition-colors">
            ← Dashboard
          </Link>
          <span className="text-[#2a2d3a]">/</span>
          <h1 className="text-lg font-semibold text-white truncate">{job.name}</h1>
          <StatusBadge status={job.status} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5">
          <h2 className="text-sm font-medium text-[#64748b] mb-4">Job Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[#64748b] text-xs mb-1">Priority</p>
              <p className="text-white font-medium">{job.priority} / 10</p>
            </div>
            <div>
              <p className="text-[#64748b] text-xs mb-1">Attempts</p>
              <p className="text-white font-medium">{job.retryCount} / {job.maxRetries}</p>
            </div>
            <div>
              <p className="text-[#64748b] text-xs mb-1">Created</p>
              <p className="text-white font-medium">{formatDateTime(job.createdAt)}</p>
            </div>
            <div>
              <p className="text-[#64748b] text-xs mb-1">Updated</p>
              <p className="text-white font-medium">{formatDateTime(job.updatedAt)}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[#64748b] text-xs mb-2">Payload</p>
            <pre className="bg-[#0f1117] rounded-lg p-3 text-sm text-green-300 font-mono overflow-auto">
              {JSON.stringify(job.payload, null, 2)}
            </pre>
          </div>
        </div>

        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2d3a]">
            <h2 className="font-medium text-white">Execution History</h2>
          </div>
          <div className="divide-y divide-[#2a2d3a]">
            {executions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#64748b]">No executions yet.</p>
            ) : (
              executions.map((ex: any) => (
                <div key={ex.id} className="px-5 py-3.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Attempt {ex.attempt}</span>
                    <StatusBadge status={ex.status} />
                  </div>
                  <p className="text-[#64748b] text-xs mt-1">
                    Worker: {ex.worker_hostname ?? ex.workerId}
                  </p>
                  {ex.errorMessage && (
                    <p className="text-red-400 text-xs mt-1">{ex.errorMessage}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2d3a]">
            <h2 className="font-medium text-white">Logs</h2>
          </div>
          <div className="p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-[#64748b]">No logs yet.</p>
            ) : (
              logs.map((log: any) => (
                <div key={log.id} className="flex gap-3">
                  <span className="text-[#64748b] shrink-0">
                    {formatTime(log.createdAt)}
                  </span>
                  <span className={
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn'  ? 'text-yellow-400' :
                    'text-green-300'
                  }>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
