import type { DirectoryUser } from "#shared/user";

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

export interface MembershipPreview {
  matched: {
    identifier: string;
    user: DirectoryUser;
    member: boolean;
  }[];
  unmatched: string[];
  outside: DirectoryUser[];
  memberCount: number;
}
