import { readMultipartFormData } from "h3";

import * as account from "#backend/account";
import { ApplicationError } from "#backend/errors";

const maxBodyBytes = 3 * 1024 * 1024;

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const contentLength = Number(getHeader(event, "content-length") ?? 0);
  if (contentLength > maxBodyBytes) {
    throw new ApplicationError(413, "头像文件不能超过 2 MiB");
  }

  const parts = await readMultipartFormData(event);
  const files = parts?.filter((part) => part.name === "file") ?? [];
  if (files.length !== 1) {
    throw new ApplicationError(400, "请选择一张头像图片");
  }

  const file = files[0]!;
  if (!Buffer.isBuffer(file.data)) {
    throw new ApplicationError(400, "头像文件格式无效");
  }

  const result = await account.updateAvatar(session, file.data);
  try {
    await refreshPortalSession(event);
  } catch (error) {
    event.context.log.warn({ err: error }, "刷新头像会话失败");
  }

  return result;
});
