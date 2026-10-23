import { sql } from "drizzle-orm";
import type { FetchOptions } from "ofetch";
import { FetchError, ofetch } from "ofetch";

import { avatarUrlFromAttributes } from "#shared/avatar";
import { systemAdministratorRole } from "#shared/identity";
import type { Actor, Profile, ProfileInput } from "#shared/types";

import { detectAvatarImage } from "./avatar.ts";
import { config } from "./config.ts";
import type { DatabaseTransaction } from "./database.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import { userIdentity } from "./identity.ts";
import { effectiveUserRoles } from "./keycloak/roles.ts";
import * as keycloak from "./keycloak.ts";
import { revokeAccountSessions, updateSessionProfile } from "./sessions.ts";
import { deleteAvatar, putAvatar } from "./storage.ts";
import { pick } from "./utils.ts";

interface AccountSession extends Actor {
  accessToken: string;
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
  request<Profile>(accessToken, "?userProfileMetadata=true");

async function writeProfile(accessToken: string, profile: Profile) {
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
    user: {
      subject: user.id,
      username: user.username,
      displayName: [user.lastName, user.firstName].join("") || user.username,
      email: user.email ?? null,
      avatarUrl: avatarUrlFromAttributes(user.attributes),
    },
    administrator:
      user.enabled &&
      roles.some((role) => role.name === systemAdministratorRole),
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
    profile,
    avatarUploadEnabled: config.storage !== null,
    permissions: identity.permissions,
  };
}

export const updateProfile = (actor: AccountSession, input: ProfileInput) =>
  withProfileLock(actor.subject, async (tx) => {
    const profile = await readProfile(actor.accessToken);
    await writeProfile(actor.accessToken, {
      ...profile,
      firstName: input.name,
      lastName: null,
      ...(input.email === undefined ? {} : { email: input.email }),
    });

    const updated = await readProfile(actor.accessToken);
    await updateSessionProfile(tx, actor.subject, updated);

    return updated;
  });

export async function updateAvatar(actor: AccountSession, bytes: Buffer) {
  const contentType = detectAvatarImage(bytes);

  return withProfileLock(actor.subject, async () => {
    const profile = await readProfile(actor.accessToken);
    const previousAvatarUrl = avatarUrlFromAttributes(profile.attributes);
    const avatarUrl = await putAvatar(actor.subject, bytes, contentType);
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
        await deleteAvatar(actor.subject, avatarUrl);
      }

      throw error;
    }

    const updated = await readProfile(actor.accessToken);

    if (avatarUrlFromAttributes(updated.attributes) !== avatarUrl) {
      await deleteAvatar(actor.subject, avatarUrl);

      throw new ApplicationError(422, "Keycloak 未接受头像字段，请联系管理员");
    }

    if (previousAvatarUrl !== avatarUrl) {
      await deleteAvatar(actor.subject, previousAvatarUrl);
    }

    return updated;
  });
}

export const removeAvatar = (actor: AccountSession) =>
  withProfileLock(actor.subject, async () => {
    const profile = await readProfile(actor.accessToken);
    const previousAvatarUrl = avatarUrlFromAttributes(profile.attributes);
    const attributes = { ...profile.attributes };
    delete attributes.picture;

    await writeProfile(actor.accessToken, { ...profile, attributes });
    const updated = await readProfile(actor.accessToken);

    if (avatarUrlFromAttributes(updated.attributes)) {
      throw new ApplicationError(422, "Keycloak 未能移除头像，请联系管理员");
    }

    await deleteAvatar(actor.subject, previousAvatarUrl);

    return updated;
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
