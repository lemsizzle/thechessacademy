export const ADMIN_SESSION_COOKIE = "quest_board_admin_session";
const ADMIN_SESSION_PREFIX = "quest-board-admin-v1";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || (process.env.NODE_ENV === "production" ? "" : "academy");
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createAdminSessionValue(password = getAdminPassword()) {
  if (!password) return "";
  return `${ADMIN_SESSION_PREFIX}.${await sha256Hex(`${ADMIN_SESSION_PREFIX}:${password}`)}`;
}

export async function isValidAdminSession(value?: string | null) {
  const expected = await createAdminSessionValue();
  return Boolean(value && expected && value === expected);
}
