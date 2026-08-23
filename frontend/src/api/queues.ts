import { apiClient } from './client';

export interface RetryPolicy {
  strategy: 'fixed' | 'linear' | 'exponential';
  base_delay: number;
  max_retries: number;
}

export interface Queue {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  priority: number;
  concurrency_limit: number;
  retry_policy: RetryPolicy;
  is_paused: boolean;
  job_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQueuePayload {
  name: string;
  description?: string;
  priority?: number;
  concurrency_limit?: number;
  retry_policy?: RetryPolicy;
}

export interface UpdateQueuePayload {
  name?: string;
  description?: string;
  priority?: number;
  concurrency_limit?: number;
  retry_policy?: RetryPolicy;
  is_paused?: boolean;
}

export const queuesApi = {
  getQueuesByProject: async (projectId: string, skip = 0, limit = 50): Promise<Queue[]> => {
    const res = await apiClient.get<Queue[]>(
      `/projects/${projectId}/queues/?skip=${skip}&limit=${limit}`
    );
    return res.data;
  },

  getQueue: async (queueId: string): Promise<Queue> => {
    const res = await apiClient.get<Queue>(`/queues/${queueId}`);
    return res.data;
  },

  createQueue: async (projectId: string, data: CreateQueuePayload): Promise<Queue> => {
    const res = await apiClient.post<Queue>(`/projects/${projectId}/queues/`, data);
    return res.data;
  },

  updateQueue: async (queueId: string, data: UpdateQueuePayload): Promise<Queue> => {
    const res = await apiClient.put<Queue>(`/queues/${queueId}`, data);
    return res.data;
  },

  pauseQueue: async (queueId: string): Promise<Queue> => {
    const res = await apiClient.post<Queue>(`/queues/${queueId}/pause`);
    return res.data;
  },

  resumeQueue: async (queueId: string): Promise<Queue> => {
    const res = await apiClient.post<Queue>(`/queues/${queueId}/resume`);
    return res.data;
  },

  deleteQueue: async (queueId: string, force = false): Promise<void> => {
    await apiClient.delete(`/queues/${queueId}${force ? '?force=true' : ''}`);
  },
};
