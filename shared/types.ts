export interface Actor {
  subject: string;
}

export interface SiteService {
  name: string;
  url: string;
  description?: string;
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
  matched: {
    identifier: string;
    user: PreviewUser;
    member: boolean;
  }[];
  unmatched: string[];
  outside: PreviewUser[];
  memberCount: number;
}
