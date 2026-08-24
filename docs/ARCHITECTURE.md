# System Architecture & Database Schema

This document outlines the complete system architecture and relational database schema for Codity. 

## 1. Database Entity-Relationship (ER) Schema

The platform relies on a heavily relational PostgreSQL structure optimized for hierarchical multi-tenancy, high-throughput job queueing, and atomic worker claiming.

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : "has many"
    ORGANIZATION ||--o{ PROJECT : "has many"
    PROJECT ||--o{ QUEUE : "contains"
    QUEUE ||--o{ JOB : "enqueues"
    QUEUE ||--o{ WORKER : "assigns"
    WORKER ||--o{ JOB : "claims & processes"
    WORKER ||--o{ JOB_EXECUTION : "executes"
    JOB ||--o| DEAD_LETTER_ENTRY : "moves to (on exhaust)"
    JOB ||--o{ JOB_EXECUTION : "has history of"
    JOB ||--o{ JOB_LOG : "emits"
    JOB ||--o{ JOB : "depends on (DAG)"
    JOB ||--o{ JOB : "parent/child (Cron)"

    ORGANIZATION {
        UUID id PK
        String name
        String slug UK
        DateTime created_at
    }

    USER {
        UUID id PK
        UUID organization_id FK
        String email UK
        String full_name
        Enum role "admin | member"
        String oauth_provider
    }

    PROJECT {
        UUID id PK
        UUID organization_id FK
        String name
        UUID api_key UK
    }

    QUEUE {
        UUID id PK
        UUID project_id FK
        String name
        Integer priority
        Integer concurrency_limit
        JSONB retry_policy
        Boolean is_paused
    }

    WORKER {
        UUID id PK
        UUID queue_id FK
        String hostname
        Integer pid
        DateTime last_heartbeat_at
        Enum status "active | dead"
    }

    JOB {
        UUID id PK
        UUID queue_id FK
        UUID worker_id FK
        UUID depends_on_job_id FK
        UUID parent_job_id FK
        Enum status "queued | running | failed | dead | etc"
        JSONB payload
        Integer priority
        DateTime scheduled_at
        String cron_expression
        Integer retry_count
        Integer max_retries
    }

    JOB_EXECUTION {
        UUID id PK
        UUID job_id FK
        UUID worker_id FK
        Enum status "running | completed | failed"
        DateTime started_at
        DateTime finished_at
        Text error_message
    }

    JOB_LOG {
        UUID id PK
        UUID job_id FK
        DateTime timestamp
        Enum level "info | warning | error"
        Text message
        JSONB metadata
    }

    DEAD_LETTER_ENTRY {
        UUID id PK
        UUID job_id FK
        DateTime failed_at
        Text reason
        JSONB final_payload
    }
```

## 2. Core Architectural Components & Data Flow

Codity operates as a highly concurrent distributed system. Here is the visual architecture representing the flow of jobs and worker coordination:

```mermaid
flowchart TD
    subgraph Frontend
        UI[React 18 Dashboard]
    end

    subgraph API Layer
        REST[FastAPI Server]
        AUTH[Google OAuth / JWT]
    end

    subgraph Job Orchestration
        SCHEDULER[Leader Scheduler]
        REAPER[Dead Worker Reaper]
    end

    subgraph Worker Cluster
        W1[Worker Node 1]
        W2[Worker Node 2]
        WN[Worker Node N]
    end

    subgraph Data Persistence
        PG[(PostgreSQL 16)]
        REDIS[(Redis 7)]
    end

    UI <--> |HTTPS / REST| REST
    REST <--> |OAuth| AUTH
    REST --> |Enqueues Jobs| PG
    REST --> |Reads Metrics| REDIS

    SCHEDULER --> |Promotes Delayed/Cron Jobs| PG
    REAPER --> |Sweeps Dead Workers & Re-queues| PG

    W1 <--> |SELECT FOR UPDATE SKIP LOCKED| PG
    W2 <--> |SELECT FOR UPDATE SKIP LOCKED| PG
    WN <--> |Heartbeats| PG

    W1 -.-> |Caches/Limits| REDIS
    W2 -.-> |Caches/Limits| REDIS
```

### Schema & Architecture Highlights:
- **Atomic Claiming**: Your workers rely on the `jobs` and `workers` table indexes to execute `SELECT ... FOR UPDATE SKIP LOCKED`. This guarantees that in a multi-worker environment, no two workers will ever process the same job at the same time.
- **Self-Healing Design**: The Reaper process specifically scans the `Worker` table for `last_heartbeat_at` anomalies. If a worker crashes or drops off the network, the Reaper automatically strips its jobs and transitions them back to the queue, while marking the worker as `dead`.
- **Data Integrity**: By utilizing strict PostgreSQL Foreign Key constraints (`ON DELETE CASCADE` and `ON DELETE SET NULL`) combined with native Enums (`JobStatus`, `WorkerStatus`), the database mathematically guarantees that you cannot have corrupted state transitions or orphaned data records.
