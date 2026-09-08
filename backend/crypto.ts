import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { config } from "./config.ts";

export const randomToken = () => randomBytes(32).toString("base64url");

export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.encryptionKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decrypt(value: string) {
  const data = Buffer.from(value, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    config.encryptionKey,
    data.subarray(0, 12),
  );
  decipher.setAuthTag(data.subarray(12, 28));

  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
