import { z } from "zod";

import * as account from "#backend/account";

const input = z.object({ id: z.string().min(1).max(200).optional() });

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const { id } = await readValidatedBody(event, input.parse);
  const removed = await account.signOut(session.accessToken, id);

  await revokeAccountSessions(
    session.subject,
    removed.map((session) => session.id),
  );

  return { signedOut: removed.some((session) => session.current) };
});
