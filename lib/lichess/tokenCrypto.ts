import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getSecret() {
  const secret = process.env.LICHESS_ENCRYPTION_SECRET ?? process.env.ADMIN_PASSWORD ?? "local-dev-lichess-token-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptLichessToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptLichessToken(payload: string) {
  const [ivText, tagText, encryptedText] = payload.split(".");
  if (!ivText || !tagText || !encryptedText) return null;

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getSecret(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
