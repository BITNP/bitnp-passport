// TODO: remove adapters after upgrading to keycloak 26
import { managedGroups as groupSettings } from "#database/schema";
import type { Actor, ProfileInput } from "#shared/types";

import * as keycloak9 from "./account/keycloak9.ts";
import * as keycloak26 from "./account/keycloak26.ts";
import { request } from "./account/shared.ts";
import { config } from "./config.ts";
import { db } from "./database.ts";
import { ApplicationError } from "./errors.ts";
import * as keycloak from "./keycloak.ts";
import { groupAccess } from "./permissions.ts";

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

const adapter = config.keycloakVersion === "9" ? keycloak9 : keycloak26;

export const updatePassword = adapter.updatePassword;
export const security = adapter.security;

export async function overview(actor: Actor & { accessToken: string }) {
  const [userProfile, memberships, access, roles, settings] = await Promise.all(
    [
      adapter.readProfile(actor.accessToken),
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
  await adapter.updateProfile(accessToken, input);

  return adapter.readProfile(accessToken);
}

export async function removeCredential(accessToken: string, id: string) {
  const { credentials } = await security(accessToken);
  const type = credentials.find((type) =>
    type.credentials.some((credential) => credential.id === id),
  );
  if (type?.removeable !== true) {
    throw new ApplicationError(403, "此凭据不能移除");
  }

  return adapter.removeCredential(accessToken, id);
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
