import KcAdminClient, { NetworkError } from "@keycloak/keycloak-admin-client";

import { config } from "../config.ts";
import { ApplicationError } from "../errors.ts";

export type UserRepresentation = Awaited<
  ReturnType<KcAdminClient["users"]["find"]>
>[number];
export type KeycloakGroup = Awaited<
  ReturnType<KcAdminClient["groups"]["find"]>
>[number];
export type KeycloakUser = UserRepresentation &
  Required<
    Pick<UserRepresentation, "id" | "username" | "enabled" | "emailVerified">
  >;
export type Group = KeycloakGroup &
  Required<Pick<KeycloakGroup, "id" | "name" | "path">>;

// These are Keycloak's read models. The Admin API always supplies these fields
// for returned users and groups, so required fields are established once here
// instead of being rechecked by every caller.
export const asKeycloakUser = (user: UserRepresentation) =>
  user as KeycloakUser;
export const asGroup = (group: KeycloakGroup) => group as Group;

const issuerUrl = new URL(config.issuer);
const realmSegment = issuerUrl.pathname.split("/").findLast(Boolean);
if (!realmSegment) {
  throw new Error("OIDC_ISSUER_URL 缺少 realm 路径");
}
const realmName = decodeURIComponent(realmSegment);

export const client = new KcAdminClient({
  baseUrl: new URL("../..", `${config.issuer}/`).href,
  realmName,
  requestOptions: { redirect: "error" },
  requestArgOptions: { catchNotFound: false },
  timeout: 10_000,
});

let authentication: Promise<string | undefined> | undefined;

async function authenticate() {
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

    throw new ApplicationError(503, "Keycloak 服务账户认证失败，请联系管理员", {
      cause: error,
    });
  }

  return client.accessToken;
}

client.registerTokenProvider({
  getAccessToken() {
    if (client.accessToken && !client.isTokenExpired()) {
      return Promise.resolve(client.accessToken);
    }

    authentication ??= authenticate().finally(() => {
      authentication = undefined;
    });

    return authentication;
  },
});

export async function request<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof NetworkError)) {
      throw error;
    }

    const status = error.response.status;
    if (status === 401) {
      client.accessToken = undefined;
    }

    let statusCode = status;
    if (status === 400) {
      statusCode = 422;
    } else if (![404, 409, 422].includes(status)) {
      statusCode = 503;
    }

    throw new ApplicationError(
      statusCode,
      `Keycloak 请求失败（HTTP ${status}）`,
      { cause: error },
    );
  }
}

export async function allPages<T>(
  page: (first: number, max: number) => Promise<T[]>,
) {
  const records: T[] = [];

  for (let first = 0; ; first += 100) {
    const result = await page(first, 100);
    records.push(...result);
    if (result.length < 100) {
      return records;
    }
  }
}
