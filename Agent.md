# Agent.md

## AI Tools Used

Claude by Anthropic was used throughout this project as a Staff Engineer mentor.

## How AI Was Used

Architecture design: Claude helped design the full system before writing any code — component breakdown, database schema, API design, scheduler logic, heartbeat mechanism, retry strategy, and failure recovery.

Code generation: Each component was built phase by phase. Claude explained the reasoning behind every decision before generating code. I reviewed and understood each piece before moving to the next phase.

Debugging: Claude helped diagnose issues including TypeScript import hoisting causing dotenv to load after module initialization, and PostgreSQL ENUM type handling in migrations.

## Development Phases

1. System architecture design
2. Database schema and migrations
3. Job service and routes
4. Worker service and routes
5. Scheduler with SELECT FOR UPDATE SKIP LOCKED
6. Heartbeat monitor and crash recovery
7. Simulated worker processes
8. Next.js dashboard

## Key Decisions I Can Defend

PostgreSQL as job queue: SELECT FOR UPDATE SKIP LOCKED provides atomic job claiming with ACID guarantees. No Redis needed at this scale.

Separate job_executions table: preserves full retry history. Storing execution data on the jobs row would lose history on every retry.

Pull model for workers: workers control their own throughput. Simpler failure handling than push.

Exponential backoff with jitter: prevents thundering herd when many jobs fail at the same time.

Heartbeat threshold at 3x interval: tolerates transient network issues before declaring a worker dead.

Single source of truth: all state lives in PostgreSQL. No split-brain between queue and database.