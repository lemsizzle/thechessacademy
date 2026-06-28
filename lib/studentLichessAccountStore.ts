"use client";

import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { withLichessActivityBaseline } from "@/lib/lichessXp";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import type { StudentLichessAccount } from "@/lib/types";

export const STUDENT_LICHESS_SYNC_EVENT = "quest-board-lichess-account-synced";

export function saveStudentLichessAccount(account: StudentLichessAccount) {
  const store = readAdminStore();
  const accounts = store.studentLichessAccounts ?? seedAccounts;
  const usernameKey = account.lichessUsername.toLowerCase();
  const userIdKey = account.lichessUserId.toLowerCase();
  const existing = accounts.find((item) => item.studentId === account.studentId);
  const nextAccount = withLichessActivityBaseline(account, existing);
  const nextAccounts = [
    nextAccount,
    ...accounts.filter((item) => (
      item.studentId !== account.studentId
      && item.lichessUsername.toLowerCase() !== usernameKey
      && item.lichessUserId.toLowerCase() !== userIdKey
    ))
  ];

  updateAdminStore({ studentLichessAccounts: nextAccounts });
  window.dispatchEvent(new CustomEvent(STUDENT_LICHESS_SYNC_EVENT, { detail: nextAccount }));
  return nextAccount;
}
