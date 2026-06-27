import type { UserRole } from "@/lib/types";

export const STUDENT_SESSION_KEY = "quest-board-student-session";
export const STUDENT_SESSION_USER_KEY = "quest-board-student-session-user";
export const STUDENT_APP_SESSION_COOKIE = "quest_board_student_session";
export const KNOWN_LICHESS_STUDENTS_COOKIE = "quest_board_known_lichess_students";
export const LICHESS_TOKEN_COOKIE = "quest_board_lichess_token";
export const LICHESS_OAUTH_STATE_COOKIE = "quest_board_lichess_oauth_state";
export const LICHESS_PKCE_COOKIE = "quest_board_lichess_pkce";
export const LICHESS_OAUTH_CONTEXT_COOKIE = "quest_board_lichess_context";

export const roles: Record<UserRole, UserRole> = {
  admin: "admin",
  student: "student"
};
