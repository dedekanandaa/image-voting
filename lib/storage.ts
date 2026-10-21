import { randomUUID, createHash } from "crypto";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|gif|webp)$/;

export function resolveUploadPath(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error("INVALID_KEY");
  const full = path.join(UPLOAD_DIR, key);
  if (!full.startsWith(UPLOAD_DIR + path.sep)) throw new Error("INVALID_KEY");
  return full;
}

export async function uploadImage(file: File, _fileName: string): Promise<{ key: string; hash: string }> {
  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw new Error("UNSUPPORTED_TYPE");

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex");
  const key = `${randomUUID()}${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(resolveUploadPath(key), buffer, { flag: "wx" });

  return { key, hash };
}

export async function getPresignedUrl(key: string): Promise<string> {
  return `/api/files/${encodeURIComponent(key)}`;
}

export async function deleteImage(key: string): Promise<void> {
  await rm(resolveUploadPath(key), { force: true });
}
