import { apiClient } from './client';

export interface QueueStats {
  queue_id: string;
  name: string;
  pending: number;
  running: number;
  completed_24h: number;
  failed_24h: number;
  dead: number;
  throughput_per_hour: number;
}

export interface SystemMetrics {
  total_jobs: number;
  active_workers: number;
  total_queues: number;
  jobs_completed_24h: number;
  jobs_failed_24h: number;
  overall_failure_rate_24h: number;
}

export const metricsApi = {
  getQueueStats: async (queueId: string): Promise<QueueStats> => {
    const res = await apiClient.get<QueueStats>(`/metrics/queues/${queueId}`);
    return res.data;
  },

  getSystemMetrics: async (): Promise<SystemMetrics> => {
    const res = await apiClient.get<SystemMetrics>('/metrics/system');
    return res.data;
  },
};
