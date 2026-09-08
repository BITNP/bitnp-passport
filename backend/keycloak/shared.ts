import KcAdminClient, { NetworkError } from "@keycloak/keycloak-admin-client";

import { config } from "../config.ts";
import { ApplicationError } from "../errors.ts";
import { createSharedAsync } from "../utils.ts";

export type UserRepresentation = Awaited<
  ReturnType<KcAdminClient["users"]["find"]>
>[number];
export type GroupRepresentation = Awaited<
  ReturnType<KcAdminClient["groups"]["find"]>
>[number];

export const client = new KcAdminClient({
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
