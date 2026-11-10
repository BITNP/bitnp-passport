import { eq, sql } from "drizzle-orm";
import type { FetchOptions } from "ofetch";
import { FetchError, ofetch } from "ofetch";

import { sessions } from "#database/schema";
import { avatarUrlFromAttributes } from "#shared/avatar";
import { systemAdministratorRole } from "#shared/identity";
import type { Actor } from "#shared/types";
import type {
  AccountProfile,
  AdminProfileInput,
  MemberProfileInput,
  ProfileInput,
} from "#shared/user";
import { keycloakDisplayName } from "#shared/user";

import { audited } from "./audit.ts";
import { detectAvatarImage } from "./avatar.ts";
import { config } from "./config.ts";
import type { DatabaseTransaction } from "./database.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { userIdentity } from "./identity.ts";
import * as keycloak from "./keycloak.ts";
import {
  requireAdministrator,
  requireManagement,
  userAccess,
} from "./permissions.ts";
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
      name: keycloakDisplayName(profile),
      email: profile.email ?? null,
      avatarUrl: avatarUrlFromAttributes(profile.attributes),
    },
    qqNumber: profile.attributes?.qq_number?.[0] ?? null,
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

async function request<T = void>(
  accessToken: string,
  path: string,
  method = "GET",
  body?: FetchOptions["body"],
) {
  try {
    return await client<T>(`/account/${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });
  } catch (error) {
    if (!(error instanceof FetchError)) {
      throw error;
    }

    const status = error.response?.status;
    const statusCode =
      status === 400
        ? 422
        : status && [401, 403, 404, 409, 422, 429].includes(status)
          ? status
          : 502;

    throw new ApplicationError(
      statusCode,
      status ? `账户服务请求失败（HTTP ${status}）` : "账户服务请求失败",
      { cause: error },
    );
  }
}

const readProfile = (accessToken: string) =>
  request<KeycloakProfile>(accessToken, "?userProfileMetadata=true");

interface AccountProfileWrite {
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  attributes?: Record<string, string[]>;
}

const accountAttributes = (attributes: Record<string, string[]> = {}) =>
  Object.fromEntries(
    Object.entries(attributes).filter(([name]) => name !== "qq_number"),
  );

async function writeProfile(accessToken: string, profile: AccountProfileWrite) {
  await request(accessToken, "", "POST", {
    ...pick(profile, ["username", "firstName", "lastName", "email"]),
    ...(profile.attributes && {
      attributes: accountAttributes(profile.attributes),
    }),
  });
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
  const { user, roles, management } = await userAccess(actor.subject);

  return {
    user,
    administrator: roles.has(systemAdministratorRole),
    management,
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
  const { qqNumber } = input;
  if (qqNumber !== undefined) {
    await requireManagement(actor);
  }

  const save = () =>
    withProfileLock(actor.subject, async (tx) => {
      const profile = await readProfile(actor.accessToken);
      const updatedProfile: KeycloakProfile = {
        ...profile,
        firstName: input.name,
        lastName: null,
        email: input.email,
        attributes:
          qqNumber === undefined
            ? profile.attributes
            : {
                ...profile.attributes,
                qq_number: qqNumber === null ? [] : [qqNumber],
              },
      };

      await writeProfile(actor.accessToken, {
        username: profile.username,
        firstName: input.name,
        lastName: null,
        email: input.email,
      });

      if (qqNumber !== undefined) {
        await keycloak.updateUserQqNumber(actor.subject, qqNumber);
      }

      const updated = accountProfile(actor.subject, updatedProfile);

      await updateSessionProfile(tx, updated.user);

      return updated;
    });

  return qqNumber === undefined
    ? save()
    : audited(
        actor,
        {
          operation: "user.profile.update",
          target: { type: "user", id: actor.subject },
        },
        save,
      );
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
        keycloak.updateUserQqNumber(subject, input.qqNumber),
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
    async () => {
      const saved = await withProfileLock(subject, async (tx) => {
        const saved = await keycloak.updateUserProfile(subject, input);

        if (saved.enabled) {
          await updateSessionProfile(tx, saved);
        } else {
          await tx.delete(sessions).where(eq(sessions.subject, subject));
        }

        return saved;
      });

      if (!saved.enabled) {
        try {
          await keycloak.logoutUser(subject);
        } catch (cause) {
          throw new ApplicationError(
            502,
            "账户已停用，但清除 Keycloak 登录会话失败",
            { cause },
          );
        }
      }

      return saved;
    },
  );
}

export async function updateAvatar(actor: AccountSession, bytes: Buffer) {
  const contentType = detectAvatarImage(bytes);
  if (!avatarStorage) {
    throw new ApplicationError(503, "头像存储未配置");
  }
  const storage = avatarStorage;

  return withProfileLock(actor.subject, async () => {
    const profile = await readProfile(actor.accessToken);
    const previousAvatarUrl = avatarUrlFromAttributes(profile.attributes);
    const avatarUrl = await storage.put(actor.subject, bytes, contentType);
    const updatedProfile = {
      ...profile,
      attributes: { ...profile.attributes, picture: [avatarUrl] },
    };

    try {
      await writeProfile(actor.accessToken, updatedProfile);
    } catch (error) {
      if (
        avatarUrl !== previousAvatarUrl &&
        error instanceof ApplicationError &&
        error.statusCode < 500
      ) {
        await storage.delete(actor.subject, avatarUrl);
      }

      throw error;
    }

    if (previousAvatarUrl !== avatarUrl) {
      await storage.delete(actor.subject, previousAvatarUrl);
    }

    return accountProfile(actor.subject, updatedProfile);
  });
}

export const removeAvatar = (actor: AccountSession) =>
  withProfileLock(actor.subject, async () => {
    const profile = await readProfile(actor.accessToken);
    const previousAvatarUrl = avatarUrlFromAttributes(profile.attributes);

    const updatedProfile = {
      ...profile,
      attributes: { ...profile.attributes, picture: [] },
    };

    await writeProfile(actor.accessToken, updatedProfile);
    await avatarStorage?.delete(actor.subject, previousAvatarUrl);

    return accountProfile(actor.subject, updatedProfile);
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
