"use client";

import { badges as seedBadges } from "@/data/badges";
import { classGroups as seedClassGroups } from "@/data/classGroups";
import { gameReviewSubmissions as seedGameReviewSubmissions } from "@/data/gameReviewSubmissions";
import { lichessConnections as seedLichessConnections, lichessSyncLogs as seedLichessSyncLogs, pendingAwards as seedPendingAwards, studentLichessAccounts as seedStudentLichessAccounts } from "@/data/lichessSync";
import { quests as seedQuests } from "@/data/quests";
import { resources as seedResources } from "@/data/resources";
import { students as seedStudents } from "@/data/students";
import { studentGameSubmissions as seedStudentGameSubmissions, studentScoreSubmissions as seedStudentScoreSubmissions } from "@/data/studentSubmissions";
import { studentTacticProgress as seedStudentTacticProgress } from "@/data/studentTacticProgress";
import { ADMIN_STORE_UPDATED_EVENT, readAdminStore } from "@/lib/mockStorage";
import type { Badge, ClassGroup, GameReviewSubmission, LichessConnection, LichessSyncLog, PendingAward, Quest, Resource, Student, StudentGameSubmission, StudentLichessAccount, StudentScoreSubmission, StudentTacticProgress } from "@/lib/types";
import { useEffect, useState } from "react";

function normalizeQuests(quests: Quest[]) {
  return quests.map((quest) => ({
    ...quest,
    isLive: quest.isLive ?? quest.status === "in-progress"
  }));
}

export function useMockAdminState() {
  const [students, setStudents] = useState<Student[]>(seedStudents);
  const [badges, setBadges] = useState<Badge[]>(seedBadges);
  const [quests, setQuests] = useState<Quest[]>(() => normalizeQuests(seedQuests));
  const [classGroups, setClassGroups] = useState<ClassGroup[]>(seedClassGroups);
  const [resources, setResources] = useState<Resource[]>(seedResources);
  const [studentTacticProgress, setStudentTacticProgress] = useState<StudentTacticProgress[]>(seedStudentTacticProgress);
  const [lichessConnections, setLichessConnections] = useState<LichessConnection[]>(seedLichessConnections);
  const [studentLichessAccounts, setStudentLichessAccounts] = useState<StudentLichessAccount[]>(seedStudentLichessAccounts);
  const [gameReviewSubmissions, setGameReviewSubmissions] = useState<GameReviewSubmission[]>(seedGameReviewSubmissions);
  const [studentGameSubmissions, setStudentGameSubmissions] = useState<StudentGameSubmission[]>(seedStudentGameSubmissions);
  const [studentScoreSubmissions, setStudentScoreSubmissions] = useState<StudentScoreSubmission[]>(seedStudentScoreSubmissions);
  const [pendingAwards, setPendingAwards] = useState<PendingAward[]>(seedPendingAwards);
  const [lichessSyncLogs, setLichessSyncLogs] = useState<LichessSyncLog[]>(seedLichessSyncLogs);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function loadState() {
    const parsed = readAdminStore();
    setStudents(parsed.students ?? seedStudents);
    setBadges(parsed.badges ?? seedBadges);
    setQuests(normalizeQuests(parsed.quests ?? seedQuests));
    setClassGroups(parsed.classGroups ?? seedClassGroups);
    setResources(parsed.resources ?? seedResources);
    setStudentTacticProgress(parsed.studentTacticProgress ?? seedStudentTacticProgress);
    setLichessConnections(parsed.lichessConnections ?? seedLichessConnections);
    setStudentLichessAccounts(parsed.studentLichessAccounts ?? seedStudentLichessAccounts);
    setGameReviewSubmissions(parsed.gameReviewSubmissions ?? seedGameReviewSubmissions);
    setStudentGameSubmissions(parsed.studentGameSubmissions ?? seedStudentGameSubmissions);
    setStudentScoreSubmissions(parsed.studentScoreSubmissions ?? seedStudentScoreSubmissions);
    setPendingAwards(parsed.pendingAwards ?? seedPendingAwards);
    setLichessSyncLogs(parsed.lichessSyncLogs ?? seedLichessSyncLogs);
    setLoaded(true);
    }

    loadState();
    window.addEventListener(ADMIN_STORE_UPDATED_EVENT, loadState);
    window.addEventListener("storage", loadState);
    return () => {
      window.removeEventListener(ADMIN_STORE_UPDATED_EVENT, loadState);
      window.removeEventListener("storage", loadState);
    };
  }, []);

  return { students, badges, quests, classGroups, resources, studentTacticProgress, lichessConnections, studentLichessAccounts, gameReviewSubmissions, studentGameSubmissions, studentScoreSubmissions, pendingAwards, lichessSyncLogs, loaded };
}
