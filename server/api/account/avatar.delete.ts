import * as account from "#backend/account";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);
  const result = await account.removeAvatar(session);
  try {
    await refreshPortalSession(event);
  } catch (error) {
    event.context.log.warn({ err: error }, "刷新头像会话失败");
  }

  return result;
});
