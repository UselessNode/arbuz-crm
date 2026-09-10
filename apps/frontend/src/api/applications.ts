import type { ReviewStatus } from '@arbuz/shared';
import { api } from './client';

export interface ApplicationSummary {
  id: number;
  title: string;
  ownerId: number | null;
  ownerName: string;
  statusId: number;
  status: { id: number; name: string } | null;
  tender: string | null;
  direction: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: number;
  surname: string;
  name: string;
  patronymic: string | null;
  tasksInProject: string | null;
  contactInfo: string | null;
  socialMediaLinks: string | null;
  forumUrl: string | null;
  isResponsible: boolean | null;
  isCoordinator: boolean | null;
  education: string | null;
  workExperience: string | null;
  isAdult: boolean | null;
}

export interface ProjectPlan {
  id: number;
  task: string;
  eventName: string;
  eventDescription: string | null;
  startDate: string | null;
  endDate: string | null;
  results: string | null;
  fixationForm: string | null;
}

export interface BudgetItem {
  id: number;
  resourceType: string;
  unitCost: number | null;
  quantity: number | null;
  ownFunds: number | null;
  grantFunds: number | null;
  comment: string | null;
}

export interface Material {
  id: number;
  fileName: string;
  fileType: string | null;
  sizeBytes: number | null;
  comment: string | null;
  uploadedAt: string;
}

export interface ApplicationReview {
  id: number;
  expert: { id: number; email: string; name: string | null; surname: string | null; patronymic: string | null } | null;
  status: ReviewStatus | null;
  text: string | null;
  rating: unknown;
  totalScore: number | null;
  updatedAt: string;
}

export interface ApplicationDetail {
  id: number;
  title: string;
  ownerId: number | null;
  owner: { id: number; email: string; name: string | null; surname: string | null; patronymic: string | null } | null;
  tender: { id: number; name: string } | null;
  direction: { id: number; name: string } | null;
  status: { id: number; name: string; isEditable: boolean | null; isDeletable: boolean | null } | null;
  ideaDescription: string;
  importanceToTeam: string;
  projectGoal: string;
  projectTasks: string;
  implementationExperience: string | null;
  resultsDescription: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  teamMembers: TeamMember[];
  projectPlans: ProjectPlan[];
  projectBudget: BudgetItem[];
  materials: Material[];
  reviews: ApplicationReview[];
}

export interface ApplicationPayload {
  title: string;
  idea_description: string;
  importance_to_team: string;
  project_goal: string;
  project_tasks: string;
  implementation_experience?: string | null;
  results_description?: string | null;
  tender_id?: number | null;
  direction_id?: number | null;
}

export interface TeamMemberPayload {
  surname: string;
  name: string;
  patronymic?: string | null;
  tasks_in_project?: string | null;
  contact_info?: string | null;
  is_responsible?: boolean;
  is_coordinator?: boolean;
  is_adult?: boolean;
}

export interface PlanPayload {
  task: string;
  event_name: string;
  event_description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface BudgetPayload {
  resource_type: string;
  unit_cost?: number | null;
  quantity?: number | null;
  own_funds?: number | null;
  grant_funds?: number | null;
  comment?: string | null;
}

export const applicationsApi = {
  list: (params: { limit: number; offset: number }) =>
    api.get<{ applications: ApplicationSummary[]; total: number }>(
      `/applications?limit=${params.limit}&offset=${params.offset}`,
    ),
  get: (id: number) => api.get<{ application: ApplicationDetail }>(`/applications/${id}`),
  create: (payload: ApplicationPayload) => api.post<{ application: ApplicationDetail }>('/applications', payload),
  update: (id: number, patch: Partial<ApplicationPayload> & { status_id?: number }) =>
    api.patch<{ application: ApplicationDetail }>(`/applications/${id}`, patch),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/applications/${id}`),
  submit: (id: number) => api.post<{ application: ApplicationDetail }>(`/applications/${id}/submit`),

  teamMembers: {
    create: (applicationId: number, payload: TeamMemberPayload) =>
      api.post<{ member: TeamMember }>(`/applications/${applicationId}/team-members`, payload),
    update: (applicationId: number, memberId: number, payload: TeamMemberPayload) =>
      api.patch<{ member: TeamMember }>(`/applications/${applicationId}/team-members/${memberId}`, payload),
    remove: (applicationId: number, memberId: number) =>
      api.delete<{ ok: boolean }>(`/applications/${applicationId}/team-members/${memberId}`),
  },

  plans: {
    create: (applicationId: number, payload: PlanPayload) =>
      api.post<{ plan: ProjectPlan }>(`/applications/${applicationId}/project-plans`, payload),
    update: (applicationId: number, planId: number, payload: PlanPayload) =>
      api.patch<{ plan: ProjectPlan }>(`/applications/${applicationId}/project-plans/${planId}`, payload),
    remove: (applicationId: number, planId: number) =>
      api.delete<{ ok: boolean }>(`/applications/${applicationId}/project-plans/${planId}`),
  },

  budget: {
    create: (applicationId: number, payload: BudgetPayload) =>
      api.post<{ item: BudgetItem }>(`/applications/${applicationId}/project-budget`, payload),
    update: (applicationId: number, itemId: number, payload: BudgetPayload) =>
      api.patch<{ item: BudgetItem }>(`/applications/${applicationId}/project-budget/${itemId}`, payload),
    remove: (applicationId: number, itemId: number) =>
      api.delete<{ ok: boolean }>(`/applications/${applicationId}/project-budget/${itemId}`),
  },

  materials: {
    upload: (applicationId: number, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<{ material: Material }>(`/applications/${applicationId}/files`, formData);
    },
    remove: (applicationId: number, fileId: number) =>
      api.delete<{ ok: boolean }>(`/applications/${applicationId}/files/${fileId}`),
    downloadUrl: (applicationId: number, fileId: number) =>
      `/api/applications/${applicationId}/files/${fileId}/download`,
  },
};
