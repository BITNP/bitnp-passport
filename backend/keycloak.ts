import KcAdminClient, { NetworkError } from "@keycloak/keycloak-admin-client";

import { configuration } from "./config.ts";
import { ApplicationError } from "./errors.ts";
import { createSharedAsync, pick } from "./utils.ts";

type UserRepresentation = Awaited<
  ReturnType<KcAdminClient["users"]["find"]>
>[number];
type GroupRepresentation = Awaited<
  ReturnType<KcAdminClient["groups"]["find"]>
>[number];

const userSummary = (user: UserRepresentation) =>
  pick(user as Required<UserRepresentation>, [
    "id",
    "username",
    "firstName",
    "lastName",
    "email",
    "emailVerified",
    "enabled",
    "createdTimestamp",
  ]);

const groupSummary = (group: GroupRepresentation) =>
  pick(group as Required<GroupRepresentation>, ["id", "name", "path"]);

const config = configuration();
const client = new KcAdminClient({
  baseUrl: new URL("../..", `${config.issuer}/`).href,
  realmName: decodeURIComponent(
    new URL(config.issuer).pathname.split("/").pop()!,
  ),
  requestOptions: { redirect: "error" },
  requestArgOptions: { catchNotFound: false },
  timeout: 10_000,
});

client.registerTokenProvider({
  getAccessToken: createSharedAsync(
    async () => {
      if (!client.accessToken || client.isTokenExpired()) {
        try {
          await client.auth({
            grantType: "client_credentials",
            clientId: config.serviceClientId,
            clientSecret: config.serviceClientSecret,
          });
        } catch (error) {
          if (!(error instanceof NetworkError)) {
            throw error;
          }

          throw new ApplicationError(
            503,
            "Keycloak 服务账户认证失败，请联系管理员",
            {
              cause: error,
            },
          );
        }
      }

      return client.accessToken;
    },
    { cacheResult: false },
  ),
});

async function request<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof NetworkError)) {
      throw error;
    }

    const status = error.response.status;
    switch (status) {
      case 401: {
        client.accessToken = undefined;

        break;
      }
      case 404: {
        throw new ApplicationError(404, "Keycloak 中的用户或组已不存在");
      }
      case 409: {
        throw new ApplicationError(409, "Keycloak 中已存在同名记录");
      }
      case 400:
      case 422: {
        throw new ApplicationError(422, "Keycloak 拒绝了此变更，请检查输入");
      }
    }

    throw new ApplicationError(
      503,
      `Keycloak 操作失败（HTTP ${status}），请联系管理员`,
      { cause: error },
    );
  }
}

async function allPages<T>(page: (first: number, max: number) => Promise<T[]>) {
  const records: T[] = [];

  for (let first = 0; ; first += 100) {
    const result = await page(first, 100);
    records.push(...result);
    if (result.length < 100) {
      return records;
    }
  }
}

export async function userRoles(id: string) {
  const roles = await request(() =>
    client.users.listCompositeRealmRoleMappings({ id }),
  );

  return roles.map((role) =>
    pick(role as Required<typeof role>, ["id", "name"]),
  );
}

export async function user(id: string) {
  const user = await request(() => client.users.findOne({ id }));

  return userSummary(user!);
}

export async function searchUsers(search: string, first: number) {
  const users = await request(() =>
    client.users.find({
      search,
      first,
      max: 50,
      briefRepresentation: true,
    }),
  );

  return users.map(userSummary);
}

export async function resolveUser(identifier: string) {
  const field = identifier.includes("@") ? "email" : "username";
  const users = await request(async () => {
    if (config.keycloakVersion === "9") {
      // FIXME: 9.0.0 ignores exact=true and returns substring matches
      const candidates = await allPages((first, max) =>
        client.users.find({ [field]: identifier, first, max }),
      );
      const normalized = identifier.toLowerCase();

      return candidates.filter(
        (user) => user[field]?.toLowerCase() === normalized,
      );
    }

    return client.users.find({ [field]: identifier, exact: true, max: 1 });
  });

  if (users.length === 0) {
    throw new ApplicationError(404, `找不到用户：${identifier}`);
  }

  return userSummary(users[0]!);
}

export async function groupsForUser(id: string) {
  const groups = await request(() =>
    allPages((first, max) =>
      client.users.listGroups({
        id,
        first,
        max,
        briefRepresentation: true,
      }),
    ),
  );

  return groups.map(groupSummary);
}

export async function group(id: string) {
  const group = await request(() => client.groups.findOne({ id }));

  return groupSummary(group!);
}

export async function searchGroups(search: string, first: number) {
  const groups = await request(() =>
    client.groups.find({
      search,
      first,
      max: 50,
      briefRepresentation: true,
      populateHierarchy: config.keycloakVersion === "26" ? false : undefined,
    }),
  );

  // 9.0.0 includes subGroups; expose only the matched groups.
  return groups.map(groupSummary);
}

export async function memberPage(id: string, first: number) {
  const users = await request(() =>
    client.groups.listMembers({
      id,
      first,
      max: 50,
      briefRepresentation: true,
    }),
  );

  return users.map(userSummary);
}

export async function members(id: string) {
  const users = await request(() =>
    allPages((first, max) =>
      client.groups.listMembers({
        id,
        first,
        max,
        briefRepresentation: true,
      }),
    ),
  );

  return users.map(userSummary);
}

export async function addMember(userId: string, groupId: string) {
  await request(() => client.users.addToGroup({ id: userId, groupId }));
}

export async function removeMember(userId: string, groupId: string) {
  await request(() => client.users.delFromGroup({ id: userId, groupId }));
}

export async function createGroup(name: string, parentId?: string) {
  const { id } = await request(() =>
    parentId
      ? client.groups.createChildGroup({ id: parentId }, { name })
      : client.groups.create({ name }),
  );

  return group(decodeURIComponent(id));
}
