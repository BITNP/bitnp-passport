import { createHash, createHmac } from "node:crypto";

import { config } from "./config.ts";
import { ApplicationError } from "./errors.ts";
import { logger } from "./logger.ts";

const region = "us-east-1";
const service = "s3";
const requestTimeout = 10_000;
const hashLength = 16;

type Storage = NonNullable<typeof config.storage>;

const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();

function endpointUrl(storage: Storage) {
  const url = new URL(storage.endpoint);
  url.search = "";
  url.hash = "";

  return url;
}

function basePath(storage: Storage) {
  const path = endpointUrl(storage).pathname.replace(/\/+$/, "");

  return `${path}/${encodeRfc3986(storage.bucket)}`;
}

const canonicalPath = (storage: Storage, key: string) =>
  `${basePath(storage)}/${key.split("/").map(encodeRfc3986).join("/")}`;

function publicUrl(storage: Storage, key: string) {
  const endpoint = endpointUrl(storage);

  return `${endpoint.origin}${canonicalPath(storage, key)}`;
}

function keyFromAvatarUrl(storage: Storage, url: string, subject: string) {
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(url);
    base = new URL(publicUrl(storage, ""));
  } catch {
    return null;
  }

  const prefix = `${base.pathname.replace(/\/+$/, "")}/`;
  if (parsed.origin !== base.origin || !parsed.pathname.startsWith(prefix)) {
    return null;
  }

  let key: string;
  try {
    key = decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return null;
  }

  const avatarPrefix = `avatars/${subject}`;
  if (key !== avatarPrefix && !key.startsWith(`${avatarPrefix}/`)) {
    return null;
  }

  return key;
}

async function signedRequest(
  method: "PUT" | "DELETE",
  storage: Storage,
  key: string,
  body?: Buffer,
  contentType?: string,
) {
  const endpoint = endpointUrl(storage);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? Buffer.alloc(0));
  const uri = canonicalPath(storage, key);
  const cacheControl =
    method === "PUT" ? "public, max-age=31536000, immutable" : undefined;
  const headers: [string, string][] = [
    ["host", endpoint.host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", amzDate],
  ];
  if (contentType) {
    headers.push(["content-type", contentType]);
  }
  if (cacheControl) {
    headers.push(["cache-control", cacheControl]);
  }
  headers.sort(([left], [right]) => left.localeCompare(right));

  const canonicalHeaders = headers
    .map(([name, value]) => `${name}:${value}\n`)
    .join("");
  const signedHeaders = headers.map(([name]) => name).join(";");
  const canonicalRequest = [
    method,
    uri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${storage.secretKey}`, dateStamp), region), service),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${storage.accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(`${endpoint.origin}${uri}`, {
      method,
      headers: {
        "Authorization": authorization,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
      },
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(requestTimeout),
    });
  } catch (error) {
    logger.warn({ err: error, key, method }, "S3 请求失败");

    throw new ApplicationError(502, "头像存储服务不可用", { cause: error });
  }

  if (!response.ok) {
    await response.text().catch(() => "");
    if (method === "DELETE" && response.status === 404) {
      return;
    }

    logger.warn({ key, method, status: response.status }, "S3 请求失败");

    throw new ApplicationError(502, "头像存储服务不可用");
  }
}

export const avatarStorageConfigured = () => config.storage !== null;

export async function putAvatar(
  subject: string,
  bytes: Buffer,
  contentType: string,
) {
  const storage = config.storage;
  if (!storage) {
    throw new ApplicationError(503, "头像存储未配置");
  }
  if (!/^[a-z0-9-]+$/i.test(subject)) {
    throw new ApplicationError(500, "用户标识无效");
  }

  const hash = createHash("sha256")
    .update(bytes)
    .digest("hex")
    .slice(0, hashLength);
  const key = `avatars/${subject}/${hash}`;

  await signedRequest("PUT", storage, key, bytes, contentType);

  return publicUrl(storage, key);
}

export async function removeAvatar(
  subject: string,
  url: string | null | undefined,
) {
  const storage = config.storage;
  if (!storage || !url) {
    return;
  }

  const key = keyFromAvatarUrl(storage, url, subject);
  if (!key) {
    return;
  }

  try {
    await signedRequest("DELETE", storage, key);
  } catch (error) {
    logger.warn({ err: error, key }, "删除旧头像失败");
  }
}
