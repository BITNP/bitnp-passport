import type { FetchOptions } from "ofetch";
import { ofetch } from "ofetch";

import { managedGroups as groupSettings } from "#database/schema";
import type { Actor, Profile, ProfileInput } from "#shared/types";

import { config } from "./config.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { groupAccess } from "./permissions.ts";

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

export async function security(accessToken: string) {
  const types = await request<CredentialType[]>(accessToken, "credentials");

  return {
    credentials: types.map(({ userCredentialMetadatas, ...type }) => ({
      ...type,
      credentials: userCredentialMetadatas.map(({ credential }) => credential),
    })),
  };
}

export async function overview(actor: Actor & { accessToken: string }) {
  const [userProfile, memberships, access, roles, settings] = await Promise.all(
    [
      readProfile(actor.accessToken),
      keycloak.groupsForUser(actor.subject),
      groupAccess(actor),
      keycloak.userRoles(actor.subject),
      db
        .select()
        .from(groupSettings)
        .orderBy(groupSettings.label, groupSettings.groupId),
    ],
  );
  const labels = new Map(settings.map((group) => [group.groupId, group.label]));

  return {
    profile: userProfile,
    memberships: memberships.map((group) => ({
      id: group.id,
      label: labels.get(group.id) ?? group.name,
    })),
    groups: settings.filter(
      (group) =>
        access.administrator || access.groupIds.includes(group.groupId),
    ),
    activeMember: roles.some((role) => role.name === config.activeRole),
  };
}

export async function updateProfile(accessToken: string, input: ProfileInput) {
  const profile = await readProfile(accessToken);

  await request(accessToken, "", "POST", {
    username: profile.username,
    attributes: profile.attributes,
    firstName: input.name,
    lastName: null,
    email: input.email,
  });

  return readProfile(accessToken);
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

export async function signOut(accessToken: string, id?: string) {
  const active = await devices(accessToken);
  const removed = active.flatMap((device) =>
    device.sessions.filter((session) =>
      id ? session.id === id : !session.current,
    ),
  );
  await request(
    accessToken,
    id ? `sessions/${encodeURIComponent(id)}` : "sessions?current=false",
    "DELETE",
  );

  return removed;
}
