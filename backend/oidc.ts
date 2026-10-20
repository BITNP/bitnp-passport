import * as oidc from "openid-client";

import { config } from "./config.ts";
import { createSharedAsync } from "./utils.ts";

export const identityClient = createSharedAsync(() =>
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
  ),
);
