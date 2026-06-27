import { KNOWN_LICHESS_STUDENTS_COOKIE } from "@/lib/auth/roles";
import type { Student } from "@/lib/types";
import { NextResponse } from "next/server";

export type KnownLichessStudent = {
  studentId: string;
  lichessUserId: string;
  lichessUsername: string;
  name: string;
  classGroup: string;
  slug: string;
};

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(value: string): KnownLichessStudent[] {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as KnownLichessStudent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readKnownLichessStudents(cookieStore: { get: (name: string) => { value: string } | undefined }) {
  const raw = cookieStore.get(KNOWN_LICHESS_STUDENTS_COOKIE)?.value;
  return raw ? decode(raw) : [];
}

export function findKnownLichessStudent(cookieStore: { get: (name: string) => { value: string } | undefined }, lichessUserId: string, lichessUsername: string) {
  const userId = lichessUserId.toLowerCase();
  const username = lichessUsername.toLowerCase();
  return readKnownLichessStudents(cookieStore).find((student) => (
    student.lichessUserId.toLowerCase() === userId ||
    student.lichessUsername.toLowerCase() === username
  )) ?? null;
}

export function rememberKnownLichessStudent(response: NextResponse, cookieStore: { get: (name: string) => { value: string } | undefined }, student: Student, lichessUserId: string, lichessUsername: string) {
  const existing = readKnownLichessStudents(cookieStore);
  const next: KnownLichessStudent = {
    studentId: student.id,
    lichessUserId,
    lichessUsername,
    name: student.name,
    classGroup: student.classGroup,
    slug: student.slug
  };
  const merged = [next, ...existing.filter((item) => item.lichessUserId.toLowerCase() !== lichessUserId.toLowerCase() && item.lichessUsername.toLowerCase() !== lichessUsername.toLowerCase())].slice(0, 25);
  response.cookies.set(KNOWN_LICHESS_STUDENTS_COOKIE, encode(merged), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}

export function clearKnownLichessStudents(response: NextResponse) {
  response.cookies.delete(KNOWN_LICHESS_STUDENTS_COOKIE);
}
