import { createHash } from "node:crypto";

import { AwsClient } from "aws4fetch";

import { config } from "./config.ts";
import { ApplicationError } from "./errors.ts";
import { logger } from "./logger.ts";

const storage = config.storage && {
  ...config.storage,
  client: new AwsClient({
    accessKeyId: config.storage.accessKey,
    secretAccessKey: config.storage.secretKey,
    service: "s3",
    region: "us-east-1",
    retries: 0,
  }),
};

type Storage = NonNullable<typeof storage>;

function objectUrl(storage: Storage, key: string) {
  const url = new URL(storage.endpoint);
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = `${path}/${encodeURIComponent(storage.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  url.search = "";
  url.hash = "";

  return url;
}

async function request(storage: Storage, key: string, options: RequestInit) {
  let response: Response;

  try {
    response = await storage.client.fetch(objectUrl(storage, key), {
      ...options,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new ApplicationError(502, "头像存储服务不可用", { cause });
  }

  await response.body?.cancel();

  if (
    !response.ok &&
    (options.method !== "DELETE" || response.status !== 404)
  ) {
    throw new ApplicationError(502, "头像存储服务不可用");
  }
}

export async function putAvatar(
  subject: string,
  bytes: Buffer,
  contentType: string,
) {
  if (!storage) {
    throw new ApplicationError(503, "头像存储未配置");
  }

  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const key = `avatars/${encodeURIComponent(subject)}/${hash}`;

  await request(storage, key, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: new Uint8Array(bytes),
  });

  return objectUrl(storage, key).href;
}

export async function deleteAvatar(subject: string, avatarUrl: string | null) {
  if (!storage || !avatarUrl) {
    return;
  }

  const directory = `avatars/${encodeURIComponent(subject)}/`;
  const prefix = objectUrl(storage, directory).href;
  const hash = avatarUrl.slice(prefix.length);

  if (!avatarUrl.startsWith(prefix) || !/^[a-f0-9]{16}$/.test(hash)) {
    return;
  }

  const key = `${directory}${hash}`;

  try {
    await request(storage, key, { method: "DELETE" });
  } catch (err) {
    logger.warn({ err, key }, "删除旧头像失败");
  }
}
