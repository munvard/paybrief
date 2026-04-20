import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyBytes(): Buffer {
  const s = process.env.FOUNDRY_ENC_KEY ?? "";
  if (s.length < 32) throw new Error("FOUNDRY_ENC_KEY must be >= 32 chars");
  return Buffer.from(s.slice(0, 32));
}

export function encryptString(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptString(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
