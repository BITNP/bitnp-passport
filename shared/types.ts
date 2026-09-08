export interface Actor {
  subject: string;
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

export interface Credential {
  id: string;
  type: string;
  userLabel?: string | null;
  createdDate?: number | null;
}

export interface CredentialType {
  type: string;
  createAction?: string | null;
  updateAction?: string | null;
  removeable: boolean;
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
