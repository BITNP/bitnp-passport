import { eq, sql } from "drizzle-orm";
import type { FetchOptions } from "ofetch";
import { FetchError, ofetch } from "ofetch";

import { sessions } from "#database/schema";
import { avatarUrlFromAttributes } from "#shared/avatar";
import { hasManagementAccess, systemAdministratorRole } from "#shared/identity";
import type { Actor } from "#shared/types";
import type {
  AccountProfile,
  AdminProfileInput,
  MemberProfileInput,
  ProfileInput,
} from "#shared/user";

import { audited } from "./audit.ts";
import { detectAvatarImage } from "./avatar.ts";
import { config } from "./config.ts";
import type { DatabaseTransaction } from "./database.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { userIdentity } from "./identity.ts";
import { effectiveUserRoles } from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import { requireAdministrator, requireManagement } from "./permissions.ts";
import { revokeAccountSessions, updateSessionProfile } from "./sessions.ts";
import { avatarStorage } from "./storage.ts";
import { pick } from "./utils.ts";

interface AccountSession extends Actor {
  accessToken: string;
}

interface KeycloakProfile {
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

function accountProfile(id: string, profile: KeycloakProfile): AccountProfile {
  const fields = profile.userProfileMetadata?.attributes ?? [];

  return {
    user: {
      id,
      username: profile.username,
      name: [profile.lastName, profile.firstName].join(""),
      email: profile.email ?? null,
      avatarUrl: avatarUrlFromAttributes(profile.attributes),
    },
    ...keycloak.memberProfileFromAttributes(profile.attributes),
    emailVerified: profile.emailVerified,
    readOnly: {
      name: fields.some(
        (field) =>
          (field.name === "firstName" || field.name === "lastName") &&
          field.readOnly === true,
      ),
      email: fields.some(
        (field) => field.name === "email" && field.readOnly === true,
      ),
      avatar: fields.some(
        (field) => field.name === "picture" && field.readOnly === true,
      ),
    },
    emailRequired: fields.some(
      (field) => field.name === "email" && field.required === true,
    ),
  };
}

interface CredentialType {
  type: string;
  createAction?: string | null;
  updateAction?: string | null;
  removeable: boolean;
  userCredentialMetadatas: {
    credential: {
      id: string;
      type: string;
      userLabel?: string | null;
      createdDate?: number | null;
    };
  }[];
}

interface Device {
  os?: string | null;
  osVersion?: string | null;
  device?: string | null;
  sessions: {
    id: string;
    ipAddress: string;
    started: number;
    lastAccess: number;
    expires: number;
    browser?: string | null;
    current?: boolean | null;
    clients: {
      clientId: string;
      clientName?: string | null;
    }[];
  }[];
}

const client = ofetch.create({
  baseURL: config.issuer,
  headers: { Accept: "application/json" },
  redirect: "error",
  timeout: 10_000,
  retry: 0,
});

const request = <T = void>(
  accessToken: string,
  path: string,
  method = "GET",
  body?: FetchOptions["body"],
) =>
  client<T>(`/account/${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });

const readProfile = (accessToken: string) =>
  request<KeycloakProfile>(accessToken, "?userProfileMetadata=true");

async function writeProfile(accessToken: string, profile: KeycloakProfile) {
  await request(
    accessToken,
    "",
    "POST",
    pick(profile, ["username", "firstName", "lastName", "email", "attributes"]),
  );
}

const withProfileLock = <T>(
  subject: string,
  run: (tx: DatabaseTransaction) => Promise<T>,
) =>
  db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`bitnp-profile:${subject}`}, 0))`,
    );

    return run(tx);
  });

export async function session(actor: Actor) {
  const [user, roles] = await Promise.all([
    keycloak.user(actor.subject),
    effectiveUserRoles(actor.subject),
  ]);

  return {
    user,
    administrator:
      user.enabled &&
      roles.some((role) => role.name === systemAdministratorRole),
    management:
      user.enabled &&
      hasManagementAccess(new Set(roles.map((role) => role.name!))),
  };
}

export async function security(accessToken: string) {
  const types = await request<CredentialType[]>(accessToken, "credentials");

  return {
    credentials: types.map(({ userCredentialMetadatas, ...type }) => ({
      ...type,
      credentials: userCredentialMetadatas.map(({ credential }) => credential),
    })),
  };
}

export async function overview(actor: AccountSession) {
  const [profile, identity] = await Promise.all([
    readProfile(actor.accessToken),
    userIdentity(actor.subject),
  ]);

  return {
    profile: accountProfile(actor.subject, profile),
    avatarUploadEnabled: avatarStorage !== null,
    permissions: identity.permissions,
  };
}

export async function updateProfile(
  actor: AccountSession,
  input: ProfileInput,
) {
  const { name, email, ...memberProfile } = input;
  const updatesMemberProfile =
    memberProfile.qqNumber !== undefined ||
    memberProfile.githubUsername !== undefined;
  if (updatesMemberProfile) {
    await requireManagement(actor);
  }

  const save = () =>
    withProfileLock(actor.subject, async (tx) => {
      const profile = await readProfile(actor.accessToken);

      await writeProfile(actor.accessToken, {
        ...profile,
        firstName: name,
        lastName: null,
        email,
      });

      if (updatesMemberProfile) {
        await keycloak.updateMemberProfile(actor.subject, memberProfile);
      }

      const updated = accountProfile(
        actor.subject,
        await readProfile(actor.accessToken),
      );

      await updateSessionProfile(tx, updated.user);

      return updated;
    });

  return updatesMemberProfile
    ? audited(
        actor,
        {
          operation: "user.profile.update",
          target: { type: "user", id: actor.subject },
        },
        save,
      )
    : save();
}

export async function updateMemberProfile(
  actor: Actor,
  subject: string,
  input: MemberProfileInput,
) {
  await requireManagement(actor);

  return audited(
    actor,
    { operation: "user.profile.update", target: { type: "user", id: subject } },
    () =>
      withProfileLock(subject, () =>
        keycloak.updateMemberProfile(subject, input),
      ),
  );
}

export async function updateUserProfile(
  actor: Actor,
  subject: string,
  input: AdminProfileInput,
) {
  await requireAdministrator(actor);

  return audited(
    actor,
    { operation: "user.profile.update", target: { type: "user", id: subject } },
    () =>
      withProfileLock(subject, async (tx) => {
        await keycloak.updateUserProfile(subject, input);
        const saved = await keycloak.userDetails(subject);

        if (saved.user.enabled) {
          await updateSessionProfile(tx, saved.user);
        } else {
          await tx.delete(sessions).where(eq(sessions.subject, subject));
        }

        return saved;
      }),
  );
}

export async function updateAvatar(actor: AccountSession, bytes: Buffer) {
  const contentType = detectAvatarImage(bytes);

  return withProfileLock(actor.subject, async () => {
    if (!avatarStorage) {
      throw new ApplicationError(503, "头像存储未配置");
    }

    const profile = await readProfile(actor.accessToken);
    const previousAvatarUrl = avatarUrlFromAttributes(profile.attributes);
    const avatarUrl = await avatarStorage.put(
      actor.subject,
      bytes,
      contentType,
    );
    try {
      await writeProfile(actor.accessToken, {
        ...profile,
        attributes: { ...profile.attributes, picture: [avatarUrl] },
      });
    } catch (error) {
      if (
        avatarUrl !== previousAvatarUrl &&
        error instanceof FetchError &&
        error.response &&
        [400, 401, 403, 404, 422].includes(error.response.status)
      ) {
        await avatarStorage.delete(actor.subject, avatarUrl);
      }

      throw error;
    }

    const updated = await readProfile(actor.accessToken);

    if (avatarUrlFromAttributes(updated.attributes) !== avatarUrl) {
      await avatarStorage.delete(actor.subject, avatarUrl);

      throw new ApplicationError(422, "Keycloak 未接受头像字段，请联系管理员");
    }

    if (previousAvatarUrl !== avatarUrl) {
      await avatarStorage.delete(actor.subject, previousAvatarUrl);
    }

    return accountProfile(actor.subject, updated);
  });
}

export const removeAvatar = (actor: AccountSession) =>
  withProfileLock(actor.subject, async () => {
    const profile = await readProfile(actor.accessToken);
    const previousAvatarUrl = avatarUrlFromAttributes(profile.attributes);

    await writeProfile(actor.accessToken, {
      ...profile,
      attributes: { ...profile.attributes, picture: [] },
    });
    const updated = await readProfile(actor.accessToken);

    if (avatarUrlFromAttributes(updated.attributes)) {
      throw new ApplicationError(422, "Keycloak 未能移除头像，请联系管理员");
    }

    await avatarStorage?.delete(actor.subject, previousAvatarUrl);

    return accountProfile(actor.subject, updated);
  });

export async function removeCredential(accessToken: string, id: string) {
  const { credentials } = await security(accessToken);
  const type = credentials.find((type) =>
    type.credentials.some((credential) => credential.id === id),
  );
  if (type?.removeable !== true) {
    throw new ApplicationError(403, "此凭据不能移除");
  }

  return `delete_credential:${id}`;
}

export async function requireAction(accessToken: string, action: string) {
  const { credentials } = await security(accessToken);
  if (
    !credentials.some(
      (type) => type.createAction === action || type.updateAction === action,
    )
  ) {
    throw new ApplicationError(403, "不允许执行此安全设置");
  }
}

export const devices = (accessToken: string) =>
  request<Device[]>(accessToken, "sessions/devices");

export async function signOut(actor: AccountSession, id?: string) {
  const active = await devices(actor.accessToken);
  const removed = active.flatMap((device) =>
    device.sessions.filter((session) =>
      id ? session.id === id : !session.current,
    ),
  );
  await request(
    actor.accessToken,
    id ? `sessions/${encodeURIComponent(id)}` : "sessions?current=false",
    "DELETE",
  );

  await revokeAccountSessions(
    actor.subject,
    removed.map((session) => session.id),
  );

  return { signedOut: removed.some((session) => session.current) };
}
