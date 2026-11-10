import { isError } from "h3";
import { FetchError } from "ofetch";

interface RequestErrorData {
  message?: unknown;
}

const responseError = (cause: unknown) =>
  isError<RequestErrorData>(cause) || cause instanceof FetchError
    ? cause
    : null;

export function requestErrorMessage(cause: unknown, fallback = "操作失败") {
  const responseMessage = responseError(cause)?.data?.message;

  if (typeof responseMessage === "string" && responseMessage) {
    return responseMessage;
  }

  return fallback;
}

export const requestStatusCode = (cause: unknown) =>
  responseError(cause)?.statusCode ?? null;
