import { H3Error } from "h3";

export class ApplicationError extends H3Error {
  constructor(statusCode: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.statusCode = statusCode;
  }
}

export const errorMessage = (error: unknown) =>
  error instanceof ApplicationError ? error.message : "操作失败";
