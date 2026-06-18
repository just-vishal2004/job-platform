# Job Execution Platform

A distributed job execution system built with Node.js, TypeScript, Express, PostgreSQL, React, and Next.js.

## Features

- Submit jobs with priority levels 1-10
- Automatic scheduling and worker assignment
- Live dashboard with real-time status updates
- Retry failed jobs with exponential backoff and jitter
- Automatic crash recovery when workers die
- Full execution history per job

## Tech Stack

- Backend: Node.js, TypeScript, Express
- Frontend: Next.js 15, React, Tailwind CSS
- Database: PostgreSQL
- Monorepo: npm workspaces

## Prerequisites

- Node.js 20+
- PostgreSQL 16+

## Installation

Clone the repository and install dependencies:

  git clone https://github.com/just-vishal2004/job-platform.git
  cd job-platform
  npm install

Create the database:

  psql postgres -c "CREATE DATABASE job_platform;"

Run migrations:

  npm run migrate --workspace=apps/api

## Environment Variables

Create apps/api/.env with the following:

  DATABASE_URL=postgresql://localhost:5432/job_platform
  PORT=3001
  NODE_ENV=development
  LOG_LEVEL=info
  HEARTBEAT_TIMEOUT_SECONDS=45
  SCHEDULER_INTERVAL_MS=2000
  HEARTBEAT_MONITOR_INTERVAL_MS=30000

## Running the Application

Open four terminal tabs and run in this exact order:

Terminal 1 - API Server:
  npm run dev:api

Terminal 2 - Worker 1:
  npm run worker --workspace=apps/api -- worker-alpha

Terminal 3 - Worker 2:
  npm run worker --workspace=apps/api -- worker-beta

Terminal 4 - Frontend:
  npm run dev:web

Open http://localhost:3000 in your browser.

## Testing Crash Recovery

Run this SQL to simulate a worker crash:

  psql -d job_platform -c "UPDATE workers SET last_heartbeat = NOW() - INTERVAL '2 minutes' WHERE hostname = 'worker-alpha';"

Watch the server logs. Within 30 seconds the heartbeat monitor detects the dead worker and recovers its jobs automatically.

## Assumptions

- Workers are simulated as Node.js processes, not separate containers
- Job execution is simulated with random delays and 20% failure rate on first attempt to demonstrate retry logic
- No authentication on API endpoints
- Single API server instance