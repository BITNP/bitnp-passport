import { z } from "zod";

const httpUrl = z.url({ protocol: /^https?$/ });

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
  ACTIVE_MEMBER_ROLE: z.string().min(1).default("bitnp-active"),
});

const value = settings.parse(process.env);
const appUrl = new URL(value.APP_URL);

export const config = {
  appUrl: appUrl.origin,
  issuer: value.OIDC_ISSUER_URL,
  clientId: value.OIDC_CLIENT_ID,
  clientSecret: value.OIDC_CLIENT_SECRET,
  serviceClientId: value.KEYCLOAK_SERVICE_CLIENT_ID,
  serviceClientSecret: value.KEYCLOAK_SERVICE_CLIENT_SECRET,
  encryptionKey: Buffer.from(value.SESSION_ENCRYPTION_KEY, "base64"),
  activeRole: value.ACTIVE_MEMBER_ROLE,
  secureCookies: appUrl.protocol === "https:",
};
