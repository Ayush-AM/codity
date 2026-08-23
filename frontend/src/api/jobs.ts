import { apiClient } from './client';

export type JobStatus =
  | 'queued'
  | 'scheduled'
  | 'claimed'
  | 'running'
  | 'completed'
  | 'failed'
  | 'dead';

export interface Job {
  id: string;
  queue_id: string;
  status: JobStatus;
  payload: Record<string, any>;
  priority: number;
  scheduled_at: string | null;
  cron_expression: string | null;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  depends_on_job_id: string | null;
  parent_job_id: string | null;
  worker_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobListResponse {
  items: Job[];
  total: number;
  skip: number;
  limit: number;
}

export interface JobExecution {
  id: string;
  job_id: string;
  worker_id: string;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionListResponse {
  items: JobExecution[];
  total: number;
  skip: number;
  limit: number;
}

export interface JobLog {
  id: string;
  job_id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LogListResponse {
  items: JobLog[];
  total: number;
  skip: number;
  limit: number;
}

export interface JobFilterParams {
  status?: JobStatus[];
  queue_id?: string;
  created_at_gte?: string;
  created_at_lte?: string;
  search?: string;
  sort_by?: 'created_at' | 'priority' | 'scheduled_at';
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

export interface CreateJobPayload {
  payload: Record<string, any>;
  priority?: number;
  scheduled_at?: string;
  cron_expression?: string;
  max_retries?: number;
  depends_on_job_id?: string;
}

export const jobsApi = {
  getJobs: async (params: JobFilterParams = {}): Promise<JobListResponse> => {
    const query = new URLSearchParams();
    if (params.status && params.status.length > 0) {
      params.status.forEach((s) => query.append('status', s));
    }
    if (params.queue_id) query.append('queue_id', params.queue_id);
    if (params.created_at_gte) query.append('created_at_gte', params.created_at_gte);
    if (params.created_at_lte) query.append('created_at_lte', params.created_at_lte);
    if (params.search) query.append('search', params.search);
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_order) query.append('sort_order', params.sort_order);
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());

    const res = await apiClient.get<JobListResponse>(`/jobs/?${query.toString()}`);
    return res.data;
  },

  getJob: async (jobId: string): Promise<Job> => {
    const res = await apiClient.get<Job>(`/jobs/${jobId}`);
    return res.data;
  },

  getExecutions: async (jobId: string, skip = 0, limit = 50): Promise<ExecutionListResponse> => {
    const res = await apiClient.get<ExecutionListResponse>(
      `/jobs/${jobId}/executions?skip=${skip}&limit=${limit}`
    );
    return res.data;
  },

  getLogs: async (jobId: string, skip = 0, limit = 50): Promise<LogListResponse> => {
    const res = await apiClient.get<LogListResponse>(
      `/jobs/${jobId}/logs?skip=${skip}&limit=${limit}`
    );
    return res.data;
  },

  submitJob: async (queueId: string, data: CreateJobPayload, idempotencyKey?: string): Promise<Job> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post<Job>(`/queues/${queueId}/jobs/`, data, { headers });
    return res.data;
  },
};
