import type { FetchOptions } from "ofetch";
import { ofetch } from "ofetch";

import { config } from "#backend/config";

const client = ofetch.create({
  baseURL: config.issuer,
  headers: { Accept: "application/json" },
  redirect: "error",
  timeout: 10_000,
  retry: 0,
});

export const request = <T = void>(
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
