export interface Actor {
  subject: string;
}

export interface SiteService {
  name: string;
  url: string;
  description?: string;
}

export interface UserListItem {
  id: string;
  username: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  enabled?: boolean;
  createdTimestamp?: number;
}

export interface GroupNode {
  id: string;
  name: string;
  path: string;
  children: GroupNode[];
}

export interface TermCreationPlan {
  parentId?: string;
  root: {
    name: string;
    path: string;
    note: string;
    allowInvites: boolean;
  };
  groups: {
    sourceGroupId: string;
    code: string;
    departmentName: string;
    parentCode: string | null;
    name: string;
    path: string;
    label: string;
    note: string;
    allowInvites: boolean;
  }[];
}

export interface TermActivationPlan {
  previousTermId: string | null;
  previousGroupIds: string[];
  selectedDelegations: string[];
}

export interface Profile {
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  emailVerified: boolean;
  attributes?: Record<string, string[]>;
  userProfileMetadata?: {
    attributes: {
      name: string;
      required?: boolean;
      readOnly?: boolean;
    }[];
  };
}

export interface ProfileInput {
  name: string;
  email?: string | null;
}

export interface TaskData {
  jobId: string;
  queueId: string;
  actorSubject: string;
}

interface PreviewUser {
  id: string;
  username: string;
  email?: string;
  enabled?: boolean;
}

export interface MembershipPreview {
  rows: {
    identifier: string;
    user: PreviewUser | null;
    member: boolean;
    error: string | null;
  }[];
  outside: PreviewUser[];
  memberCount: number;
}
