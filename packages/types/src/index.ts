export type JobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WorkerStatus = 'idle' | 'busy' | 'dead';

export type ExecutionStatus =
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timed_out';

export type LogLevel = 'info' | 'warn' | 'error';

export interface Job {
  id: string;
  name: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  maxRetries: number;
  retryCount: number;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  hostname: string;
  status: WorkerStatus;
  lastHeartbeat: string;
  registeredAt: string;
  metadata: Record<string, unknown>;
}

export interface JobExecution {
  id: string;
  jobId: string;
  workerId: string;
  attempt: number;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface ExecutionLog {
  id: string;
  jobId: string;
  workerId: string | null;
  level: LogLevel;
  message: string;
  createdAt: string;
}

export interface SubmitJobRequest {
  name: string;
  payload: Record<string, unknown>;
  priority?: number;
  maxRetries?: number;
  scheduledAt?: string;
}

export interface RegisterWorkerRequest {
  hostname: string;
  metadata?: Record<string, unknown>;
}
