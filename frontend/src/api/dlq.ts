import { apiClient } from './client';

export interface DeadLetterEntry {
  id: string;
  job_id: string;
  failed_at: string;
  reason: string;
  final_payload: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const dlqApi = {
  getDlqEntries: async (skip = 0, limit = 50): Promise<DeadLetterEntry[]> => {
    const res = await apiClient.get<DeadLetterEntry[]>(`/dlq/?skip=${skip}&limit=${limit}`);
    return res.data;
  },

  retryDeadJob: async (jobId: string): Promise<any> => {
    const res = await apiClient.post(`/dlq/${jobId}/retry`);
    return res.data;
  },
};
