# CodeClash — Load Test Master Plan (500 Concurrent Contestants)

This folder contains scripts and instructions to run an industry-level load test and clean up afterward.

---

## 1. Prerequisites

- **Contest:** One contest in **scheduled** or **draft** state, with at least one problem. Note its MongoDB `_id` (CONTEST_ID).
- **Server:** CodeClash API + Worker + Redis + MongoDB + Piston running (locally or on EC2).
- **Node:** Seed and cleanup scripts **import server code** (DB, Redis, models). Run them from the **project root** so `load-test/` and `server/` are siblings. The load script (sockets only) also runs from project root.

---

## 2. Step-by-Step Execution

### Step A: Seed 500 bot users and register for contest

From the **project root** (code-clash):

```bash
cd code-clash
export LOADTEST_CONTEST_ID=<your-contest-mongodb-id>
export LOADTEST_BOT_COUNT=500
node load-test/seed-contest-bots.js
```

(Uses `server/.env` and `server/node_modules` via path `load-test/../server`.)

This creates 500 users (`loadtest-bot-1@loadtest.local` … `loadtest-bot-500@loadtest.local`), registers them for the contest, and writes **load-test/loadtest-bots.json** (tokens + contestId/problemId).

### Step B: Start the contest (so it’s active)

Use your admin API or UI to **start** the contest (status → `active`). The load test expects the contest to be active so `contest-submit` is accepted.

### Step C: Run the load test (500 sockets + simultaneous submit)

From the **project root** (code-clash):

```bash
cd code-clash
npm install --prefix load-test   # if not already (socket.io-client)
export LOADTEST_SERVER_URL=https://cclash.duckdns.org
node load-test/contest-load-test.js
```

Or against local API:

```bash
export LOADTEST_SERVER_URL=http://localhost:5000
node load-test/contest-load-test.js
```

The script:

1. Reads **load-test/loadtest-bots.json** (or path in `LOADTEST_BOTS_FILE`).
2. Connects 500 Socket.io clients with staggered connection (80 ms between each by default).
3. Emits **join-contest** with the same stagger (80 ms).
4. Waits **SUBMIT_AFTER_MS** (default 5 s).
5. Emits **contest-submit** from all connected sockets at once (same problem, minimal code).
6. Logs connected/joined/queued/result/error counts and a final report.

Tunables (env): `LOADTEST_BOT_COUNT`, `LOADTEST_JOIN_STAGGER_MS`, `LOADTEST_SUBMIT_AFTER_MS`, `LOADTEST_SERVER_URL`, `LOADTEST_BOTS_FILE`. See **load-test/config.js**.

### Step D: Clean up bots (MongoDB + Redis)

From the **project root** (code-clash):

```bash
cd code-clash
export LOADTEST_CONTEST_ID=<same-contest-id>   # optional; if set, only that contest is cleaned
node load-test/cleanup-bots.js
```

This:

- Deletes users with email `loadtest-bot-*@loadtest.local`.
- Removes them from contest participants (for the given contest or all).
- Deletes their **ContestSubmission** documents.
- Removes their Redis keys: `leaderboard:*`, `lb-data:*`, `contest:*:user:*`, `ratelimit:contest-submit:*`.

---

## 3. Observability & Monitoring (During the Test)

Run these on the **EC2 (or host)** where the API and worker run.

### 3.1 PM2 (API + Worker)

```bash
# Live dashboard (CPU, memory, restarts)
pm2 monit

# Logs (API and worker)
pm2 logs code-clash-api --lines 200
pm2 logs code-clash-worker --lines 200

# One-off stats
pm2 show code-clash-api
pm2 show code-clash-worker
```

**What to watch:** API memory and CPU when 500 sockets connect and when 500 submissions hit. Worker CPU/memory when the queue drains. Restart counts (should stay 0).

### 3.2 Redis (queue + leaderboard)

```bash
redis-cli -h <host> -p <port> -a <password>

# Queue length (BullMQ uses a list per queue)
LLEN bull:contest-submissions:wait
LLEN bull:contest-submissions:active

# Or use BullMQ’s key pattern
KEYS bull:contest-submissions*

# Leaderboard / lb-data size
DBSIZE
# Optional: slow log (if enabled)
SLOWLOG GET 10

# Clients connected
INFO clients
```

**What to watch:** `wait` list growing when 500 submissions are added; `active` bounded by worker concurrency. No exhaustion of Redis memory or connections.

### 3.3 MongoDB (connection pool + writes)

```bash
# From mongo shell or Compass
db.serverStatus().connections
```

**What to watch:** `current` near your pool size (e.g. 20 if `MONGO_MAX_POOL_SIZE=20`). If it stays at the limit and requests queue, consider increasing pool size for the load.

Atlas: use the **Metrics** tab (Connections, Operations) during the test.

### 3.4 System (CPU, RAM, Docker)

```bash
htop
# or
top
```

**What to watch:** Node (API + worker) and Piston/Docker. On **t3.small**, if CPU is pegged at 100% or RAM is full, that’s the bottleneck.

```bash
docker stats
```

**What to watch:** Piston container CPU/memory when 500 jobs are processed. If Docker or Piston crashes, reduce worker concurrency or add more resources.

### 3.5 Queue stats (from your API)

If you have an authenticated endpoint that returns BullMQ stats (e.g. **GET /api/contests/queue-stats**):

```bash
curl -s -H "Authorization: Bearer <admin-token>" https://cclash.duckdns.org/api/contests/queue-stats
```

**What to watch:** `waiting` climbing to 500 then decreasing as `active`/`completed` increase. No explosion of `failed` without retries.

---

## 4. Bottlenecks and Mitigations

| Bottleneck | How to spot | Mitigation |
|------------|-------------|------------|
| **Socket connection limits / event loop** | API CPU high, logs slow, or connections refused | Scale API (e.g. second instance behind LB), or increase EC2 size. Keep JOIN_STAGGER_MS so you don’t spike connections in one instant. |
| **BullMQ / worker** | `waiting` stays high, worker CPU at 100% | Increase **WORKER_CONCURRENCY** (e.g. 15–25 on a larger instance). Keep **limiter** in worker (e.g. max 50/sec) to avoid overloading Piston. |
| **MongoDB connection pool** | `db.serverStatus().connections.current` at pool max, slow responses | Raise **MONGO_MAX_POOL_SIZE** (e.g. 50) in API and worker. Ensure Atlas tier allows that many connections. |
| **Redis** | Slow commands, high memory, or connection errors | Check **INFO clients** and **memory**. Use pipeline in leaderboard (you already do). For 500 users, normal ZADD/ZREVRANGE should be fine. |
| **Piston / Docker** | Container crash or timeout under load | Limit **WORKER_CONCURRENCY** and BullMQ **limiter** so you don’t spawn 500 containers at once. Tune Docker CPU/memory limits. |

---

## 5. Suggested Tuning for 500 Users

- **API (Node):** Keep one process for now; if you see high CPU or dropped sockets, add more PM2 instances or a bigger instance.
- **Worker:**  
  - `WORKER_CONCURRENCY=15` to `25` (t3.small can try 15; t3.medium 25).  
  - BullMQ `limiter: { max: 50, duration: 1000 }` (or similar) so Piston isn’t hit with 500 at once.
- **MongoDB:** `MONGO_MAX_POOL_SIZE=50` (or higher if your Atlas plan allows).
- **Redis:** Default config is usually enough; ensure **maxmemory** and **maxclients** are not too low for your plan.

---

## 6. Success Criteria

- All 500 bots **connect** and **join-contest** (joined count = 500).
- All 500 get **contest-submission-queued** (or clearly rate-limited with no crash).
- **contest-submission-result** (or failure) for each submission; no stuck sockets.
- No API or worker **crashes** (PM2 restart count 0).
- **Redis** and **MongoDB** stay within limits (no connection or memory exhaustion).
- **Piston/Docker** stays up; jobs complete or fail with a clear error, not a host crash.

After the test, run **cleanup-bots.js** so production data stays clean.
