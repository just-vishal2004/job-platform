'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  onClose: () => void;
  onSubmitted: () => void;
}

export default function SubmitJobModal({ onClose, onSubmitted }: Props) {
  const [name, setName] = useState('');
  const [payload, setPayload] = useState('{}');
  const [priority, setPriority] = useState(5);
  const [maxRetries, setMaxRetries] = useState(3);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');

    if (!name.trim()) {
      setError('Job name is required');
      return;
    }

    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError('Payload must be valid JSON');
      return;
    }

    setLoading(true);
    try {
      await api.submitJob({ name, payload: parsedPayload, priority, maxRetries });
      onSubmitted();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Submit New Job</h2>
          <button onClick={onClose} className="text-[#64748b] hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#64748b] mb-1">Job Name</label>
            <input
              className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="e.g. send-email, process-payment"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-[#64748b] mb-1">Payload (JSON)</label>
            <textarea
              className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 h-24 resize-none"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#64748b] mb-1">
                Priority: <span className="text-white">{priority}</span>
              </label>
              <input
                type="range" min={1} max={10} value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-[#64748b] mt-1">
                <span>Low (1)</span><span>High (10)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#64748b] mb-1">Max Retries</label>
              <select
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
              >
                {[0,1,2,3,5,10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-[#2a2d3a] text-[#64748b] hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
