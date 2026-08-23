import { apiClient } from './client';

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  api_key: string;
  created_at: string;
  updated_at: string;
}

export const projectsApi = {
  getProjects: async (skip = 0, limit = 50): Promise<Project[]> => {
    const res = await apiClient.get<Project[]>(`/projects/?skip=${skip}&limit=${limit}`);
    return res.data;
  },

  createProject: async (name: string, description?: string): Promise<Project> => {
    const res = await apiClient.post<Project>('/projects/', { name, description });
    return res.data;
  },
};
