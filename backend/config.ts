import { z } from "zod";

const httpUrl = z.url({ protocol: /^https?$/ });

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const optionalHttpUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  httpUrl.optional(),
);

const settings = z.object({
  APP_URL: httpUrl,
  OIDC_ISSUER_URL: httpUrl,
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_SERVICE_CLIENT_ID: z.string().min(1),
  KEYCLOAK_SERVICE_CLIENT_SECRET: z.string().min(1),
  SESSION_ENCRYPTION_KEY: z
    .base64()
    .refine((value) => Buffer.from(value, "base64").length === 32),
});

const storageSettings = z.object({
  S3_ENDPOINT: optionalHttpUrl,
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_BUCKET: optionalString,
});

const value = settings.parse(process.env);
const storageValue = storageSettings.parse(process.env);
const storageParts = [
  storageValue.S3_ENDPOINT,
  storageValue.S3_ACCESS_KEY,
  storageValue.S3_SECRET_KEY,
  storageValue.S3_BUCKET,
];
if (storageParts.some(Boolean) && !storageParts.every(Boolean)) {
  throw new Error(
    "S3_ENDPOINT、S3_ACCESS_KEY、S3_SECRET_KEY 和 S3_BUCKET 必须同时配置",
  );
}
const storage = storageParts.every(Boolean)
  ? {
      endpoint: storageValue.S3_ENDPOINT!,
      accessKey: storageValue.S3_ACCESS_KEY!,
      secretKey: storageValue.S3_SECRET_KEY!,
      bucket: storageValue.S3_BUCKET!,
    }
  : null;
const appUrl = new URL(value.APP_URL);

export const config = {
  appUrl: appUrl.origin,
  issuer: value.OIDC_ISSUER_URL,
  clientId: value.OIDC_CLIENT_ID,
  clientSecret: value.OIDC_CLIENT_SECRET,
  serviceClientId: value.KEYCLOAK_SERVICE_CLIENT_ID,
  serviceClientSecret: value.KEYCLOAK_SERVICE_CLIENT_SECRET,
  encryptionKey: Buffer.from(value.SESSION_ENCRYPTION_KEY, "base64"),
  secureCookies: appUrl.protocol === "https:",
  storage,
};
