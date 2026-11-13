export interface User {
  id: string;
  username: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface DirectoryUser extends User {
  enabled: boolean;
  emailVerified: boolean;
  createdTimestamp: number | null;
}

export interface MemberProfile {
  qqNumber: string | null;
  githubUsername: string | null;
}

export type AdminUserProfile = DirectoryUser & MemberProfile;

export interface AccountProfile extends MemberProfile {
  user: User;
  emailVerified: boolean;
  readOnly: {
    name: boolean;
    email: boolean;
    avatar: boolean;
  };
  emailRequired: boolean;
}

export interface ProfileInput extends Partial<MemberProfile> {
  name: string;
  email: string | null;
}

export interface MemberProfileInput extends Partial<MemberProfile> {
  qqNumber: string | null;
}

export interface AdminProfileInput extends ProfileInput {
  qqNumber: string | null;
  enabled: boolean;
  emailVerified: boolean;
}

export const userLabel = (user: Pick<User, "name" | "username">): string =>
  user.name && user.name !== user.username
    ? `${user.name}（${user.username}）`
    : user.username;
