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

export interface AdminUserProfile extends DirectoryUser {
  qqNumber: string | null;
}

export interface AccountProfile {
  user: User;
  qqNumber: string | null;
  emailVerified: boolean;
  readOnly: {
    name: boolean;
    email: boolean;
    avatar: boolean;
  };
  emailRequired: boolean;
}

export interface ProfileInput {
  name: string;
  email: string | null;
  qqNumber?: string | null;
}

export interface MemberProfileInput {
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
