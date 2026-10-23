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

export interface TaskData {
  jobId: string;
  queueId: string;
  actorSubject: string;
}

interface PreviewUser {
  id: string;
  username: string;
  email?: string | null;
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
