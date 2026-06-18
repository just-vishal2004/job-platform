'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import SubmitJobModal from '@/components/SubmitJobModal';
import Link from 'next/link';

export default function Dashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [jobsData, workersData] = await Promise.all([
        api.getJobs(statusFilter || undefined),
        api.getWorkers(),
      ]);
      setJobs(jobsData.jobs);
      setWorkers(workersData.workers);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, [statusFilter]);

  // Poll every 2 seconds for live updates
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const stats = {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    running: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    activeWorkers: workers.filter(w => w.status !== 'dead').length,
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0]">
      {showModal && (
        <SubmitJobModal
          onClose={() => setShowModal(false)}
          onSubmitted={fetchData}
        />
      )}

      {/* Header */}
      <header className="border-b border-[#2a2d3a] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Job Execution Platform</h1>
            <p className="text-xs text-[#64748b] mt-0.5">Updated {lastUpdated}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            + Submit Job
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: 'Total Jobs', value: stats.total },
            { label: 'Pending', value: stats.pending },
            { label: 'Running', value: stats.running },
            { label: 'Completed', value: stats.completed },
            { label: 'Failed', value: stats.failed },
            { label: 'Active Workers', value: stats.activeWorkers },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-[#64748b] mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Jobs Table */}
          <div className="lg:col-span-2 bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2a2d3a] flex items-center justify-between">
              <h2 className="font-medium text-white">Jobs</h2>
              <select
                className="bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-1.5 text-sm text-[#e2e8f0] focus:outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {['pending','queued','running','completed','failed','cancelled'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-[#2a2d3a]">
              {jobs.length === 0 ? (
                <div className="px-5 py-12 text-center text-[#64748b] text-sm">
                  No jobs found. Submit one to get started.
                </div>
              ) : (
                jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-[#0f1117]/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{job.name}</p>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        Priority {job.priority} · Attempt {job.retryCount + 1} of {job.maxRetries + 1}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <StatusBadge status={job.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Workers Panel */}
          <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2a2d3a]">
              <h2 className="font-medium text-white">Workers</h2>
            </div>

            <div className="divide-y divide-[#2a2d3a]">
              {workers.length === 0 ? (
                <div className="px-5 py-12 text-center text-[#64748b] text-sm">
                  No workers registered.
                </div>
              ) : (
                workers.map((worker) => (
                  <div key={worker.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white truncate">{worker.hostname}</p>
                      <StatusBadge status={worker.status} />
                    </div>
                    <p className="text-xs text-[#64748b] mt-0.5">
                      Last seen {new Date(worker.lastHeartbeat).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
