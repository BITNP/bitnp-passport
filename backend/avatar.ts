import { maxAvatarBytes } from "#shared/avatar";

import { ApplicationError } from "./errors.ts";

const isJpeg = (data: Buffer) =>
  data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;

const isPng = (data: Buffer) =>
  data.length >= 8 &&
  data[0] === 0x89 &&
  data[1] === 0x50 &&
  data[2] === 0x4e &&
  data[3] === 0x47 &&
  data[4] === 0x0d &&
  data[5] === 0x0a &&
  data[6] === 0x1a &&
  data[7] === 0x0a;

const isWebp = (data: Buffer) =>
  data.length >= 12 &&
  data.toString("ascii", 0, 4) === "RIFF" &&
  data.toString("ascii", 8, 12) === "WEBP";

export function detectAvatarImage(data: Buffer) {
  if (data.length === 0) {
    throw new ApplicationError(400, "头像文件为空");
  }
  if (data.length > maxAvatarBytes) {
    throw new ApplicationError(413, "头像文件不能超过 2 MiB");
  }
  if (isJpeg(data)) {
    return "image/jpeg";
  }
  if (isPng(data)) {
    return "image/png";
  }
  if (isWebp(data)) {
    return "image/webp";
  }

  throw new ApplicationError(415, "仅支持 JPG、PNG 或 WebP 图片");
}
