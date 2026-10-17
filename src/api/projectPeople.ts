import { request } from './client';
import type { Collaborator, CollaboratorState, Project } from '@/domain/types';

/** Membership is authoritative at project level, including recently accepted invites. */
export interface ProjectPeopleResponse {
  project?: Partial<Project>;
  collaborators?: Collaborator[];
  collaborator_states?: CollaboratorState[];
  collaborators_states?: CollaboratorState[];
}

export async function fetchProjectPeople(projectId: string): Promise<ProjectPeopleResponse> {
  return request<ProjectPeopleResponse>(`/projects/${encodeURIComponent(projectId)}/full`);
}
