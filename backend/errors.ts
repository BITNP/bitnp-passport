import { H3Error } from "h3";

export class ApplicationError extends H3Error {
  constructor(statusCode: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.statusCode = statusCode;
  }
}

export const errorMessage = (error: unknown) =>
  error instanceof ApplicationError
    ? error.message
    : "服务暂时不可用，请稍后重试";
