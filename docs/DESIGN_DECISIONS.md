# Design Decisions & Architectural Trade-Offs

This document outlines the major architectural trade-offs, design choices, and technical decisions made in the Codity Distributed Job Scheduler platform.

---

## 1. PostgreSQL `FOR UPDATE SKIP LOCKED` vs Dedicated Message Queue (RabbitMQ / Kafka)

* **Decision**: Codity uses PostgreSQL 16 row locking (`SELECT ... FOR UPDATE SKIP LOCKED`) as its queue engine instead of an external message broker like RabbitMQ or Celery.
* **Trade-Off Analysis**:
  * *Pros*:
    1. **ACID Guarantees**: Job creation, queue mutations, and status transitions occur inside atomic database transactions.
    2. **Zero Stranded State**: No drift between a relational database record and a message queue topic.
    3. **Operational Simplicity**: Eliminates managing RabbitMQ cluster nodes, exchange routing, or Erlang memory tuning.
  * *Cons*:
    * Slightly higher disk I/O on PostgreSQL compared to in-memory brokers, mitigated via composite indexing (`ix_jobs_polling`).
* **Verdict**: For enterprisey job execution where auditability, transaction consistency, and operational simplicity are primary goals, PostgreSQL native queueing is superior.

---

## 2. Pull-Based Worker Model vs Push-Based Webhooks

* **Decision**: Ephemeral worker nodes poll PostgreSQL queues (`Pull Model`) rather than the control plane pushing HTTP webhooks (`Push Model`).
* **Rationale**:
  1. **Built-in Backpressure**: Workers only pull tasks when they have available capacity in their `ThreadPoolExecutor`. Slow workers naturally reduce poll rates, preventing node exhaustion.
  2. **Elastic Scaling**: Scaling up compute is as simple as launching additional worker containers (`docker compose up -d --scale worker=N`).
  3. **Zero Consumer Contention**: `SKIP LOCKED` ensures N parallel workers never attempt to lock or process the same job instance.

---

## 3. Dedicated Leader Election for Cron & Delayed Sweeps

* **Decision**: A centralized Leader Scheduler process handles recurring cron schedules (`croniter`) and delayed job promotion (`scheduled_at`).
* **Rationale**:
  * If N worker processes simultaneously evaluated cron schedules, duplicate job instances would be spawned.
  * The Leader Scheduler acquires PostgreSQL advisory locks (`pg_try_advisory_lock`) to guarantee single-instance evaluation, eliminating schedule race conditions while keeping workers focused purely on job execution.

---

## 4. Self-Healing Heartbeat & Reaper Architecture

* **Decision**: The cluster features a dedicated Reaper service monitoring worker liveness.
* **Rationale**:
  * Workers send heartbeat pings every 5 seconds. If a node crashes (e.g. Out-Of-Memory, kernel panic, cloud server termination), it stops heartbeating.
  * The Reaper scans for workers with missed heartbeats (> 15s), transitions them to `DEAD`, and automatically re-queues all in-flight jobs.
  * **Result**: Zero lost jobs during cluster node failures.

---

## 5. Immutable Retry Policy Snapshots

* **Decision**: When a job is submitted, the queue's current retry policy (`max_retries`, `base_delay`, `strategy`) is copied directly into the job's row.
* **Rationale**:
  * If an administrator modifies a queue's retry strategy while a 1,000-job batch is executing, in-flight jobs retain their initial execution contract without unexpected behavioral mutations.

---

## 6. Multi-Tenant Scoping & Security

* **Decision**: All resources are strictly scoped under `Organizations` → `Projects` → `Queues` → `Jobs`.
* **Rationale**:
  * Enforces hard multi-tenant boundaries suitable for enterprise SaaS applications. JWT bearer tokens carry the user's `organization_id`, preventing cross-tenant data leakage.
