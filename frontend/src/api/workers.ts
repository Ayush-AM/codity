import { apiClient } from './client';

export interface Worker {
  id: string;
  queue_id: string | null;
  hostname: string;
  pid: number;
  last_heartbeat_at: string;
  status: 'active' | 'dead';
  concurrent_tasks: number;
  created_at: string;
  updated_at: string;
}

export const workersApi = {
  getWorkers: async (status?: 'active' | 'dead', queueId?: string): Promise<Worker[]> => {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    if (queueId) query.append('queue_id', queueId);
    const res = await apiClient.get<Worker[]>(`/workers/?${query.toString()}`);
    return res.data;
  },

  pruneDeadWorkers: async (): Promise<{ message: string; count: number }> => {
    const res = await apiClient.delete<{ message: string; count: number }>('/workers/dead');
    return res.data;
  },

  deleteWorker: async (workerId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/workers/${workerId}`);
    return res.data;
  },
};
