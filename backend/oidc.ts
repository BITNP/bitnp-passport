import * as oidc from "openid-client";

import { config } from "./config.ts";

const discover = () =>
  oidc.discovery(
    new URL(config.issuer),
    config.clientId,
    config.clientSecret,
    undefined,
    {
      timeout: 10,
      execute: config.issuer.startsWith("http:")
        ? [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks]
        : [oidc.enableNonRepudiationChecks],
    },
  );

let identityClientPromise: ReturnType<typeof discover> | undefined;

export const identityClient = () =>
  (identityClientPromise ??= discover().catch((error) => {
    identityClientPromise = undefined;

    throw error;
  }));
