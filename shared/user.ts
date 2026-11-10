import { z } from "zod";

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
  serviceAccount: boolean;
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

const profileName = z.string().trim().min(1);
const profileEmail = z
  .union([z.email(), z.literal("")])
  .nullable()
  .transform((value) => (value === "" ? null : value));
const qqNumber = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

export const memberProfileInput = z.strictObject({
  qqNumber: qqNumber.nullable(),
});

export const profileInput = memberProfileInput.partial().extend({
  name: profileName,
  email: profileEmail,
});

export const adminProfileInput = z
  .strictObject({
    name: profileName,
    email: profileEmail,
    enabled: z.boolean(),
    emailVerified: z.boolean(),
  })
  .refine((value) => value.email !== null || !value.emailVerified, {
    message: "未设置邮箱时不能标记为已验证",
    path: ["emailVerified"],
  });

export type ProfileInput = z.infer<typeof profileInput>;
export type MemberProfileInput = z.infer<typeof memberProfileInput>;
export type AdminProfileInput = z.infer<typeof adminProfileInput>;

export function keycloakDisplayName({
  firstName,
  lastName,
  username,
}: {
  firstName?: string | null;
  lastName?: string | null;
  username: string;
}) {
  const name = [lastName, firstName]
    .map((part) => part?.trim())
    .filter((part) => part?.length)
    .join("");

  return name.length > 0 ? name : username;
}

export const userLabel = (user: Pick<User, "name" | "username">): string =>
  user.name === user.username
    ? user.username
    : `${user.name}（${user.username}）`;
