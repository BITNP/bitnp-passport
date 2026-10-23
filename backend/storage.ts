import { createHash } from "node:crypto";

import { AwsClient } from "aws4fetch";

import { config } from "./config.ts";
import { ApplicationError } from "./errors.ts";
import { logger } from "./logger.ts";

function createAvatarStorage({
  endpoint,
  bucket,
  accessKey,
  secretKey,
}: NonNullable<typeof config.storage>) {
  const baseUrl = new URL(endpoint);
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/${encodeURIComponent(bucket)}/`;
  baseUrl.search = "";
  baseUrl.hash = "";

  const client = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: "s3",
    region: "us-east-1",
  });

  function objectUrl(key: string) {
    const url = new URL(baseUrl);
    url.pathname += key.split("/").map(encodeURIComponent).join("/");

    return url;
  }

  async function request(url: URL, options: RequestInit) {
    let response: Response;

    try {
      response = await fetch(await client.sign(url, options), {
        signal: AbortSignal.timeout(10_000),
      });
    } catch (cause) {
      throw new ApplicationError(502, "头像存储服务不可用", { cause });
    }

    await response.body?.cancel();

    if (!response.ok) {
      throw new ApplicationError(502, "头像存储服务不可用");
    }
  }

  return {
    async put(subject: string, bytes: Buffer, contentType: string) {
      const hash = createHash("sha256")
        .update(bytes)
        .digest("hex")
        .slice(0, 16);
      const key = `avatars/${encodeURIComponent(subject)}/${hash}`;
      const url = objectUrl(key);

      await request(url, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
        body: new Uint8Array(bytes),
      });

      return url.href;
    },

    async delete(subject: string, avatarUrl: string | null) {
      if (!avatarUrl) {
        return;
      }

      const url = new URL(avatarUrl);
      const filename = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
      const key = `avatars/${encodeURIComponent(subject)}/${filename}`;

      if (url.href !== objectUrl(key).href) {
        return;
      }

      try {
        await request(url, { method: "DELETE" });
      } catch (err) {
        logger.warn({ err, avatarUrl }, "删除旧头像失败");
      }
    },
  };
}

export const avatarStorage = config.storage
  ? createAvatarStorage(config.storage)
  : null;
