import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const scrypt = promisify(scryptCallback);
const USERNAME_PATTERN = /^[a-z0-9_-]{3,24}$/;

export function normalizeStudentUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateStudentUsername(value: string) {
  return USERNAME_PATTERN.test(normalizeStudentUsername(value));
}

export async function hashStudentPassword(password: string) {
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (password.length > 256) throw new Error("Password must be at most 256 characters.");
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return `${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
}

export async function verifyStudentPassword(password: string, storedHash: string) {
  if (password.length > 256 || !/^[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/.test(storedHash)) return false;
  const [saltValue, hashValue] = storedHash.split(":");
  if (!saltValue || !hashValue) return false;

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "base64url");
    const actual = await scrypt(password, salt, expected.length) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function authenticateAcademyStudent(usernameInput: string, password: string) {
  const username = normalizeStudentUsername(usernameInput);
  if (!validateStudentUsername(username) || !password || password.length > 256) return null;

  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const { data: credential, error: credentialError } = await supabase
    .from("student_login_credentials")
    .select("student_id,username,password_hash")
    .eq("username", username)
    .maybeSingle();

  if (credentialError) throw new Error(credentialError.message);
  // Unknown users still pay the password derivation cost; never expose account existence.
  const fallbackHash = `${Buffer.alloc(16).toString("base64url")}:${Buffer.alloc(64).toString("base64url")}`;
  const verified = await verifyStudentPassword(password, credential?.password_hash ?? fallbackHash);
  if (!credential || !verified) return null;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,display_name,public_slug,is_active")
    .eq("id", String(credential.student_id))
    .eq("is_active", true)
    .maybeSingle();

  if (studentError) throw new Error(studentError.message);
  if (!student) return null;

  return {
    studentId: String(student.id),
    displayName: String(student.display_name),
    publicSlug: String(student.public_slug),
    username
  };
}

export async function createAcademyStudentCredential(
  studentId: string,
  usernameInput: string,
  password: string
) {
  const username = normalizeStudentUsername(usernameInput);

  if (!validateStudentUsername(username)) {
    throw new Error("Username must be 3–24 characters using only letters, numbers, underscores, or hyphens.");
  }

  const passwordHash = await hashStudentPassword(password);
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const { error } = await supabase
    .from("student_login_credentials")
    .insert({
      student_id: studentId,
      username,
      password_hash: passwordHash,
      must_change_password: false
    });

  if (error) {
    if (error.code === "23505") throw new Error("That username is already in use.");
    throw new Error(error.message);
  }

  return { username };
}
