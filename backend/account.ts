import type { FetchOptions } from "ofetch";
import { FetchError, ofetch } from "ofetch";

import { avatarUrlFromAttributes } from "#shared/avatar";
import type { Actor, Profile, ProfileInput } from "#shared/types";

import { detectAvatarImage } from "./avatar.ts";
import { config } from "./config.ts";
import { ApplicationError } from "./errors.ts";
import { userIdentity } from "./identity.ts";
import { revokeAccountSessions, updateSessionProfile } from "./sessions.ts";
import {
  avatarStorageConfigured,
  putAvatar,
  removeAvatar as removeAvatarObject,
} from "./storage.ts";

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

interface ProfileChanges {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  picture?: string | null;
}

async function writeProfile(
  accessToken: string,
  profile: Profile,
  changes: ProfileChanges,
) {
  const attributes = { ...(profile.attributes ?? {}) };
  if (changes.picture === null) {
    delete attributes.picture;
  } else if (changes.picture) {
    attributes.picture = [changes.picture];
  }

  try {
    await request(accessToken, "", "POST", {
      username: profile.username,
      attributes,
      firstName:
        changes.firstName === undefined ? profile.firstName : changes.firstName,
      lastName:
        changes.lastName === undefined ? profile.lastName : changes.lastName,
      email: changes.email === undefined ? profile.email : changes.email,
    });
  } catch (error) {
    if (
      changes.picture !== undefined &&
      error instanceof FetchError &&
      error.response?.status === 400
    ) {
      throw new ApplicationError(
        422,
        "Keycloak 用户资料未接受头像字段，请联系管理员",
      );
    }

    throw error;
  }

  return readProfile(accessToken);
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
    avatarUrl: avatarUrlFromAttributes(profile.attributes),
    permissions: identity.permissions,
  };
}

export async function updateProfile(
  actor: AccountSession,
  input: ProfileInput,
) {
  const profile = await readProfile(actor.accessToken);
  const updated = await writeProfile(actor.accessToken, profile, {
    firstName: input.name,
    lastName: null,
    email: input.email,
  });

  await updateSessionProfile(actor.subject, updated);

  return updated;
}

export async function updateAvatar(actor: AccountSession, bytes: Buffer) {
  if (!avatarStorageConfigured()) {
    throw new ApplicationError(503, "头像存储未配置");
  }

  const profile = await readProfile(actor.accessToken);
  const contentType = detectAvatarImage(bytes);
  const previousAvatarUrl = avatarUrlFromAttributes(profile.attributes);
  const avatarUrl = await putAvatar(actor.subject, bytes, contentType);

  let updated: Profile;
  try {
    updated = await writeProfile(actor.accessToken, profile, {
      picture: avatarUrl,
    });
  } catch (error) {
    if (avatarUrl !== previousAvatarUrl) {
      await removeAvatarObject(actor.subject, avatarUrl);
    }

    throw error;
  }

  if (avatarUrlFromAttributes(updated.attributes) !== avatarUrl) {
    throw new ApplicationError(
      422,
      "Keycloak 用户资料未接受头像字段，请联系管理员",
    );
  }

  if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
    await removeAvatarObject(actor.subject, previousAvatarUrl);
  }

  return { profile: updated, avatarUrl };
}

export async function removeAvatar(actor: AccountSession) {
  const profile = await readProfile(actor.accessToken);
  const previousAvatarUrl = avatarUrlFromAttributes(profile.attributes);
  const updated = await writeProfile(actor.accessToken, profile, {
    picture: null,
  });

  if (avatarUrlFromAttributes(updated.attributes)) {
    throw new ApplicationError(422, "Keycloak 未能移除头像，请联系管理员");
  }

  if (previousAvatarUrl) {
    await removeAvatarObject(actor.subject, previousAvatarUrl);
  }

  return { profile: updated, avatarUrl: null };
}

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
