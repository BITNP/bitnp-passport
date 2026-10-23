import * as account from "#backend/account";
import { ApplicationError } from "#backend/errors";
import { maxAvatarBytes } from "#shared/avatar";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  if (Number(getHeader(event, "content-length")) > maxAvatarBytes) {
    throw new ApplicationError(413, "头像文件不能超过 2 MiB");
  }

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of event.node.req.iterator({
    destroyOnReturn: false,
  })) {
    size += chunk.length;

    if (size > maxAvatarBytes) {
      event.node.req.resume();

      throw new ApplicationError(413, "头像文件不能超过 2 MiB");
    }

    chunks.push(chunk);
  }

  return account.updateAvatar(session, Buffer.concat(chunks, size));
});
