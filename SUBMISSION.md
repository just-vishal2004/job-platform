# Job Execution Platform — Assessment Submission

**Candidate:** Vishal Kumar
**GitHub:** https://github.com/just-vishal2004/job-platform

---

## Demo Videos

**Video 1 — Architecture & Feature Walkthrough**
https://www.loom.com/share/1d1697a4c57a43ce9a3220b37889c759

**Video 2 — Live Demo & Priority Queue**
https://www.loom.com/share/cdce0d80d0fc459b96730ca566740ef9

**Video 3 — Crash Recovery & Retry Logic**
https://www.loom.com/share/f902252650634a5ca12895ec6d9380f1

---

## Repository Structure

- `apps/api` — Node.js, TypeScript, Express backend
- `apps/web` — Next.js, React frontend
- `packages/types` — Shared TypeScript types
- `Architecture.md` — System design and decisions
- `README.md` — Installation and running instructions
- `Agent.md` — AI usage and development approach

---

## Key Features Implemented

- Job submission with priority levels 1-10
- Automatic scheduling using SELECT FOR UPDATE SKIP LOCKED
- Worker registration and heartbeat monitoring
- Exponential backoff retry with jitter
- Automatic crash recovery
- Real-time dashboard with live status updates
- Full execution history per job
