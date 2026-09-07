import { z } from "zod";

const httpUrl = z.url({ protocol: /^https?$/ });

const settings = z.object({
  APP_URL: httpUrl,
  OIDC_ISSUER_URL: httpUrl,
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_VERSION: z.enum(["9", "26"]),
  KEYCLOAK_SERVICE_CLIENT_ID: z.string().min(1),
  KEYCLOAK_SERVICE_CLIENT_SECRET: z.string().min(1),
  SESSION_ENCRYPTION_KEY: z
    .base64()
    .refine((value) => Buffer.from(value, "base64").length === 32),
  ALLOW_REGISTRATION: z.enum(["true", "false"]).default("false"),
  ACTIVE_MEMBER_ROLE: z.string().min(1).default("bitnp-active"),
  SUPPORT_URL: httpUrl.optional(),
  SERVICE_LINKS: z.string().default("[]"),
});

const serviceLinks = z
  .array(
    z.object({
      name: z.string().min(1).max(80),
      description: z.string().max(200).default(""),
      url: httpUrl,
    }),
  )
  .max(30);

function readSettings() {
  const value = settings.parse(process.env);
  const appUrl = new URL(value.APP_URL);

  const links = serviceLinks.parse(JSON.parse(value.SERVICE_LINKS));

  return {
    appUrl: appUrl.origin,
    issuer: value.OIDC_ISSUER_URL,
    clientId: value.OIDC_CLIENT_ID,
    clientSecret: value.OIDC_CLIENT_SECRET,
    keycloakVersion: value.KEYCLOAK_VERSION,
    serviceClientId: value.KEYCLOAK_SERVICE_CLIENT_ID,
    serviceClientSecret: value.KEYCLOAK_SERVICE_CLIENT_SECRET,
    encryptionKey: Buffer.from(value.SESSION_ENCRYPTION_KEY, "base64"),
    registration: value.ALLOW_REGISTRATION === "true",
    activeRole: value.ACTIVE_MEMBER_ROLE,
    supportUrl: value.SUPPORT_URL,
    services: links,
    secureCookies: appUrl.protocol === "https:",
  };
}

let cached: ReturnType<typeof readSettings> | undefined;

export function configuration() {
  cached ??= readSettings();

  return cached;
}

export const databaseUrl = () =>
  z.url({ protocol: /^postgres(?:ql)?$/ }).parse(process.env.DATABASE_URL);
