const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? 'Request failed');
  }

  return res.json();
}

export const api = {
  // Jobs
  getJobs: (status?: string) =>
    request<{ jobs: any[]; count: number }>(
      status ? `/api/jobs?status=${status}` : '/api/jobs'
    ),

  getJob: (id: string) =>
    request<{ job: any; executions: any[]; logs: any[] }>(`/api/jobs/${id}`),

  submitJob: (data: {
    name: string;
    payload: Record<string, unknown>;
    priority: number;
    maxRetries: number;
  }) =>
    request<{ job: any }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelJob: (id: string) =>
    request<{ job: any }>(`/api/jobs/${id}`, { method: 'DELETE' }),

  // Workers
  getWorkers: () =>
    request<{ workers: any[]; count: number }>('/api/workers'),
};
