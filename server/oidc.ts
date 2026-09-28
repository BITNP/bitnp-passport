import * as oidc from "openid-client";

import { config } from "#backend/config";
import { createSharedAsync } from "#backend/utils";

export const identityClient = createSharedAsync(() =>
  oidc.discovery(
    new URL(config.issuer),
    config.clientId,
    config.clientSecret,
    undefined,
    {
      timeout: 10,
      // For local development
      execute: config.issuer.startsWith("http:")
        ? [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks]
        : [oidc.enableNonRepudiationChecks],
    },
  ),
);
