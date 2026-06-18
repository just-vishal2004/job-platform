# System Architecture

## Overview

A distributed job execution platform where users submit computational jobs that execute asynchronously across registered workers. The system handles scheduling, monitoring, retries, crash recovery, and queue prioritization.

## Major Components

- Next.js Frontend — job submission and live monitoring dashboard
- Express API Server — REST API with job, worker, and execution routes
- Scheduler — runs every 2 seconds, assigns pending jobs to idle workers
- Heartbeat Monitor — runs every 30 seconds, detects dead workers and recovers their jobs
- PostgreSQL — single source of truth for all state
- Workers — register, poll for jobs, execute, report results

## Job Submission Flow

1. User submits job via frontend
2. Job stored in PostgreSQL with status pending
3. Scheduler detects it within 2 seconds
4. Scheduler atomically assigns job to idle worker using SELECT FOR UPDATE SKIP LOCKED
5. Job transitions: pending → queued → running → completed

## Worker Lifecycle

1. Worker registers via POST /api/workers/register
2. Worker polls for jobs every 3 seconds
3. On receiving a job: signals start, sends progress updates, signals complete or fail
4. Worker sends heartbeat every 15 seconds independently of job execution

## Crash Recovery

1. Monitor runs every 30 seconds
2. Finds workers with last_heartbeat older than 45 seconds
3. Marks them dead
4. Resets their in-flight jobs to pending with exponential backoff delay
5. Scheduler picks up recovered jobs automatically
6. Monitor also runs once on server startup to recover jobs from previous crashes

## Database Design

Four tables:
- workers — registered worker processes (idle/busy/dead)
- jobs — job records with status, priority, retry tracking
- job_executions — one row per attempt, preserves full retry history
- execution_logs — append-only log stream per job

Why separate job_executions from jobs?
Each retry creates a new execution record. This preserves the complete history of every attempt — which worker ran it, how long it took, why it failed. Storing this on the jobs row would lose history on every retry.

Why PostgreSQL instead of Redis for the queue?
SELECT FOR UPDATE SKIP LOCKED provides atomic job claiming with ACID guarantees. No extra infrastructure. Redis would split state across two systems and add operational complexity.

Why UUIDs instead of sequential IDs?
Sequential IDs expose record counts, make APIs enumerable, and cause hotspot problems in distributed databases.

## Scheduler Design

Runs every 2 seconds. Uses a tight inner loop — keeps assigning jobs until no pending jobs or no idle workers remain. Each assignment is one transaction:

1. Lock one pending job (highest priority, then FIFO) with FOR UPDATE SKIP LOCKED
2. Lock one idle worker with FOR UPDATE SKIP LOCKED
3. Update job to queued, worker to busy
4. Commit atomically

SKIP LOCKED means if another scheduler instance already locked that row, skip it and take the next one. This prevents double-assignment with zero application-level locking.

## Retry Policy

Exponential backoff with jitter:
  delay = min(5 * 2^retry_count, 300) seconds + random 0-10 seconds

Attempt 1 failure → wait ~5s
Attempt 2 failure → wait ~10s
Attempt 3 failure → wait ~20s → permanently failed

Jitter prevents thundering herd: without it, 50 jobs failing simultaneously would all retry at the exact same moment.

## Queue Prioritization

Priority field 1-10. Scheduler orders by priority DESC, created_at ASC.
Higher priority jobs execute first. FIFO within same priority level.

Known limitation: pure priority queuing can starve low-priority jobs if high-priority jobs keep arriving. Production fix would be aging — gradually increase a job's effective priority the longer it waits.

## Scalability Considerations

Scheduler: currently single in-process. At scale, run multiple instances using PostgreSQL advisory locks for leader election.

Workers: currently simulated as Node.js processes. At scale, deploy as separate containers with horizontal scaling.

Job volume: currently direct table scan. At scale, partition jobs table by date and archive completed jobs.

Real-time UI: currently polling every 2 seconds. At scale, replace with Server-Sent Events for push-based updates.

Observability: currently Winston console logs. At scale, structured JSON logs shipped to Datadog or Grafana.

## API Endpoints

POST   /api/jobs                              Submit a job
GET    /api/jobs                              List jobs
GET    /api/jobs/:id                          Job details with history
DELETE /api/jobs/:id                          Cancel job

POST   /api/workers/register                  Register worker
GET    /api/workers                           List workers
POST   /api/workers/:id/heartbeat             Send heartbeat
POST   /api/workers/:id/deregister            Graceful shutdown

POST   /api/workers/:id/jobs/poll             Poll for next job
POST   /api/workers/:id/jobs/:id/start        Signal started
POST   /api/workers/:id/jobs/:id/progress     Report progress
POST   /api/workers/:id/jobs/:id/complete     Report success
POST   /api/workers/:id/jobs/:id/fail         Report failure