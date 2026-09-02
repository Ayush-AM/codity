# Database Schema Documentation

This document provides a detailed breakdown of the PostgreSQL relational schema used in Codity. 

## Core Multi-Tenancy

### `organizations`
Top-level tenant boundary.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | **PK** | Primary identifier |
| `name` | `VARCHAR(255)` | NOT NULL | Display name |
| `slug` | `VARCHAR(255)` | UNIQUE, INDEX, NOT NULL | URL-friendly identifier |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last update timestamp |

### `users`
Users belonging to an organization.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | **PK** | Primary identifier |
| `organization_id` | `UUID` | **FK** (`organizations.id`) ON DELETE CASCADE, INDEX | Tenant association |
| `email` | `VARCHAR(320)` | UNIQUE, INDEX, NOT NULL | Login email |
| `hashed_password` | `VARCHAR(1024)` | | Bcrypt password hash |
| `full_name` | `VARCHAR(255)` | NOT NULL | User's full name |
| `role` | `ENUM('admin', 'member')` | NOT NULL | RBAC role |
| `is_active` | `BOOLEAN` | NOT NULL (Default: True) | Account status |
| `oauth_provider` | `VARCHAR(50)` | INDEX | E.g., 'google' |
| `oauth_id` | `VARCHAR(255)` | INDEX | External SSO ID |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last update timestamp |

### `projects`
Logical grouping of queues within an organization.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | **PK** | Primary identifier |
| `organization_id` | `UUID` | **FK** (`organizations.id`) ON DELETE RESTRICT, INDEX | Tenant association |
| `name` | `VARCHAR(255)` | NOT NULL | Project name |
| `description` | `TEXT` | | Optional context |
| `api_key` | `UUID` | UNIQUE, INDEX, NOT NULL | Programmatic access token |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last update timestamp |

## Job & Queue Management

### `queues`
Defines job concurrency and routing.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | **PK** | Primary identifier |
| `project_id` | `UUID` | **FK** (`projects.id`) ON DELETE CASCADE, INDEX | Project association |
| `name` | `VARCHAR(255)` | NOT NULL | Queue name |
| `description` | `TEXT` | | Optional context |
| `priority` | `INTEGER` | NOT NULL (Default: 0) | Base queue priority |
| `concurrency_limit` | `INTEGER` | NOT NULL (Default: 10) | Max concurrent jobs |
| `retry_policy` | `JSONB` | NOT NULL | e.g. `{"strategy": "exponential"}` |
| `is_paused` | `BOOLEAN` | NOT NULL (Default: False) | Stops processing if true |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last update timestamp |

*(Index: Unique constraint on `project_id` + `name`)*

### `workers`
Ephemeral compute nodes executing jobs.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | **PK** | Primary identifier |
| `queue_id` | `UUID` | **FK** (`queues.id`) ON DELETE SET NULL, INDEX | Bound queue |
| `hostname` | `VARCHAR(255)` | NOT NULL | Physical/container host |
| `pid` | `INTEGER` | NOT NULL | OS Process ID |
| `last_heartbeat_at`| `TIMESTAMPTZ` | NOT NULL | Used by Reaper for sweeps |
| `status` | `ENUM('active', 'dead')`| NOT NULL | Lifecycle status |
| `concurrent_tasks` | `INTEGER` | NOT NULL (Default: 0) | Current active tasks |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Registration time |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last update timestamp |

*(Index: `last_heartbeat_at` + `status` for rapid Reaper sweeps)*

### `jobs`
The atomic unit of work in the system.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | **PK** | Primary identifier |
| `queue_id` | `UUID` | **FK** (`queues.id`) ON DELETE CASCADE, INDEX | Queue assignment |
| `status` | `ENUM(...)` | INDEX, NOT NULL | queued/running/failed/etc. |
| `payload` | `JSONB` | NOT NULL | Task arguments |
| `priority` | `INTEGER` | NOT NULL (Default: 0) | Execution priority |
| `scheduled_at` | `TIMESTAMPTZ` | INDEX | For delayed execution |
| `cron_expression`| `VARCHAR(120)` | | e.g. `*/5 * * * *` |
| `claimed_at` | `TIMESTAMPTZ` | | When worker claimed |
| `started_at` | `TIMESTAMPTZ` | | When execution started |
| `finished_at` | `TIMESTAMPTZ` | | When execution ended |
| `retry_count` | `INTEGER` | NOT NULL (Default: 0) | Current retry attempt |
| `max_retries` | `INTEGER` | NOT NULL (Default: 3) | Maximum retry attempts |
| `last_error` | `TEXT` | | Error from last failure |
| `depends_on_job_id`| `UUID` | **FK** (`jobs.id`) ON DELETE SET NULL, INDEX | DAG dependency |
| `idempotency_key`| `VARCHAR(255)` | UNIQUE, INDEX | Prevents duplicate enqueues |
| `parent_job_id` | `UUID` | **FK** (`jobs.id`) ON DELETE SET NULL, INDEX | Cron template parent |
| `worker_id` | `UUID` | **FK** (`workers.id`) ON DELETE SET NULL, INDEX | Claiming worker |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last update timestamp |

*(Index: Composite polling index on `queue_id`, `status`, `priority`, `scheduled_at` for high-throughput locking)*

## Telemetry & History

### `job_executions`
Immutable history of every execution attempt.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | **PK** | Primary identifier |
| `job_id` | `UUID` | **FK** (`jobs.id`) ON DELETE CASCADE | Associated job |
| `worker_id` | `UUID` | **FK** (`workers.id`) ON DELETE SET NULL | Executing worker |
| `status` | `ENUM(...)` | NOT NULL | running/completed/failed |
| `started_at` | `TIMESTAMPTZ` | | Start time |
| `finished_at` | `TIMESTAMPTZ` | | End time |
| `error_message` | `TEXT` | | Stack trace / error |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last update timestamp |

### `job_logs`
Queryable application logs emitted during jobs.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | **PK** | Primary identifier |
| `job_id` | `UUID` | **FK** (`jobs.id`) ON DELETE CASCADE, INDEX | Associated job |
| `timestamp` | `TIMESTAMPTZ` | NOT NULL | Log occurrence time |
| `level` | `ENUM(...)` | NOT NULL | info/warning/error |
| `message` | `TEXT` | NOT NULL | Log text |
| `metadata` | `JSONB` | | Context variables |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last update timestamp |

### `dead_letter_entries`
Tombstones for permanently failed jobs.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | **PK** | Primary identifier |
| `job_id` | `UUID` | **FK** (`jobs.id`) ON DELETE CASCADE, UNIQUE, INDEX | Exhausted job |
| `failed_at` | `TIMESTAMPTZ` | NOT NULL | Time of final failure |
| `reason` | `TEXT` | NOT NULL | Final stack trace |
| `final_payload` | `JSONB` | NOT NULL | Snapshot of args |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last update timestamp |
