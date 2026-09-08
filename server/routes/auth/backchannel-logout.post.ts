import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { z } from "zod";

import { config } from "#backend/config";
import { ApplicationError } from "#backend/errors";

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

const logoutEvent = "http://schemas.openid.net/event/backchannel-logout";
const logoutClaims = z.object({
  jti: z.string().min(1),
  iat: z.number().int(),
  sub: z.string().min(1),
  sid: z.string().min(1).optional(),
  nonce: z.never().optional(),
  events: z.object({ [logoutEvent]: z.strictObject({}) }),
});

const input = z.object({ logout_token: z.string().min(1) });

export default defineEventHandler(async (event) => {
  const { logout_token: token } = await readValidatedBody(event, input.parse);

  if (!jwks) {
    const uri = (await identityClient()).serverMetadata().jwks_uri;

    jwks = createRemoteJWKSet(new URL(uri!), { timeoutDuration: 10_000 });
  }

  let claims: z.infer<typeof logoutClaims>;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.clientId,
      maxTokenAge: "5m",
      clockTolerance: 5,
    });

    claims = logoutClaims.parse(payload);
  } catch (error) {
    if (
      [
        z.ZodError,
        errors.JOSENotSupported,
        errors.JWKSNoMatchingKey,
        errors.JWSInvalid,
        errors.JWSSignatureVerificationFailed,
        errors.JWTClaimValidationFailed,
        errors.JWTExpired,
        errors.JWTInvalid,
      ].some((type) => error instanceof type)
    ) {
      throw new ApplicationError(400, "无效的注销令牌");
    }

    throw error;
  }

  await revokeSessions({
    jti: claims.jti,
    subject: claims.sub,
    oidcSid: claims.sid,
    issuedAt: new Date(claims.iat * 1000),
  });
  setResponseStatus(event, 204);
});
