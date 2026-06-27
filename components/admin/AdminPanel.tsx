"use client";

import { ActivityFeed } from "@/components/ActivityFeed";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { BadgeGeneratorPanel } from "@/components/admin/BadgeGeneratorPanel";
import { activity } from "@/data/activity";
import { allBadges as seedBadges, conceptThemes, tacticThemes } from "@/data/badges";
import { classGroups as seedClassGroups } from "@/data/classGroups";
import { gameReviewSubmissions as seedGameReviewSubmissions } from "@/data/gameReviewSubmissions";
import { lichessConnections as seedLichessConnections, lichessSyncLogs as seedLichessSyncLogs, pendingAwards as seedPendingAwards, studentLichessAccounts as seedStudentLichessAccounts } from "@/data/lichessSync";
import { quests as seedQuests } from "@/data/quests";
import { studentTacticProgress as seedTacticProgress } from "@/data/studentTacticProgress";
import { students as seedStudents } from "@/data/students";
import { mockArenaTournamentResults } from "@/data/tournamentResults";
import { ADMIN_STORE_KEY, readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { buildDefaultBadgeImagePrompt } from "@/lib/badges";
import { ALL_CLASSES, getClassGroupNames, getClassRoster, getClassStudentCount } from "@/lib/classes";
import { createPendingAwardsFromProgress, getTacticProgressCount, mergeTacticProgress } from "@/lib/lichess";
import { getStudentXpWithLichess, withLichessActivityBaseline } from "@/lib/lichessXp";
import { getStudentArenaPoints } from "@/lib/tournaments/getStudentArenaPoints";
import { getConditionsForSource, getQuestConditionLabel, getQuestCountLabel, getQuestSourceLabel, questSources, questTacticThemes, questTimeWindows } from "@/lib/quests/questOptions";
import type { ArenaTournamentResult, Badge, BadgeCategory, BadgeTier, ClassGroup, ConceptTheme, GameReviewSubmission, LichessConnection, LichessSyncLog, PendingAward, Quest, QuestConditionType, QuestSource, QuestStatus, QuestTimeWindow, QuestType, Student, StudentLichessAccount, StudentTacticProgress, TacticTheme } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type AdminMode = "overview" | "students" | "classes" | "badges" | "xp" | "quests" | "activity" | "resources";
type DeleteStudentAction = (input: { id: string; slug?: string; lichessUsername?: string }) => Promise<{ ok: boolean; error?: string; deleted?: boolean; skipped?: boolean; count?: number; mode?: "local-only" }>;
const badgeCategories: BadgeCategory[] = ["Tactics", "Concepts", "Checkmates", "Openings", "Endgames", "Tournament", "Sportsmanship", "Creativity", "Boss Achievements"];
const badgeTiers: BadgeTier[] = ["Bronze", "Silver", "Gold", "Platinum"];
const questTypes: QuestType[] = ["weekly", "boss"];
const questStatuses: QuestStatus[] = ["available", "in-progress", "completed"];

const emptyStudent = (count: number, classGroup = "Unassigned"): Student => ({
  id: `local-student-${Date.now()}`,
  slug: `student-${count + 1}`,
  lichessUsername: `student-${count + 1}`,
  name: `New Student ${count + 1}`,
  avatar: "N",
  classGroup,
  totalXp: 0,
  badgeIds: [],
  completedQuestIds: [],
  encouragement: "A fresh quest begins. Build strong habits one move at a time."
});

const emptyBadge = (count: number): Badge => ({
  id: `local-badge-${Date.now()}`,
  name: `Custom Badge ${count + 1}`,
  description: "A teacher-created classroom achievement.",
  category: "Tactics",
  tacticTheme: "Fork",
  tier: "Bronze",
  xpValue: 10,
  unlockRequirement: "Solve 10 fork puzzles.",
  requiredPuzzleCount: 10,
  visualTheme: "bronze glow, beginner magical emblem, knight fork and two targets",
  imagePrompt: "",
  artImageUrl: null,
  finalImageUrl: null,
  generationStatus: "pending",
  isActive: true,
  isLegacy: false,
  createdAt: new Date().toISOString().slice(0, 10)
});

const emptyQuest = (count: number): Quest => ({
  id: `local-quest-${Date.now()}`,
  title: `New Quest ${count + 1}`,
  description: "A new classroom challenge.",
  type: "weekly",
  status: "available",
  isLive: false,
  xpReward: 100,
  badgeRewardId: undefined,
  classGroup: "",
  source: "manual",
  conditionType: "manual",
  timeWindow: "weekly",
  requiredCount: 1,
  approvalRequired: true,
  isActive: true,
  isRepeatable: false,
  cooldownDays: 0
});

function fieldClass(extra = "") {
  return `rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60 ${extra}`;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `student-${Date.now()}`;
}

function cleanLichessUsername(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function mergeSeedBadges(savedBadges: Badge[] = []) {
  const savedById = new Map(savedBadges.map((badge) => [badge.id, badge]));
  const merged = seedBadges.map((badge) => ({ ...badge, ...savedById.get(badge.id) }));
  const extraSaved = savedBadges.filter((badge) => !seedBadges.some((seed) => seed.id === badge.id));
  return [...merged, ...extraSaved];
}

function normalizeQuests(quests: Quest[]) {
  return quests.map((quest) => ({
    ...quest,
    isLive: quest.isLive ?? quest.status === "in-progress"
  }));
}

export function AdminPanel({
  mode = "overview",
  requestedStudent,
  initialStudents,
  deleteStudentAction
}: {
  mode?: AdminMode;
  requestedStudent?: string;
  initialStudents?: Student[];
  deleteStudentAction?: DeleteStudentAction;
}) {
  const [students, setStudents] = useState<Student[]>(initialStudents ?? seedStudents);
  const [badges, setBadges] = useState<Badge[]>(seedBadges);
  const [quests, setQuests] = useState<Quest[]>(seedQuests);
  const [tacticProgress, setTacticProgress] = useState<StudentTacticProgress[]>(seedTacticProgress);
  const [lichessConnections, setLichessConnections] = useState<LichessConnection[]>(seedLichessConnections);
  const [studentLichessAccounts, setStudentLichessAccounts] = useState<StudentLichessAccount[]>(seedStudentLichessAccounts);
  const [arenaTournamentResults, setArenaTournamentResults] = useState<ArenaTournamentResult[]>(mockArenaTournamentResults);
  const [gameReviewSubmissions, setGameReviewSubmissions] = useState<GameReviewSubmission[]>(seedGameReviewSubmissions);
  const [pendingAwards, setPendingAwards] = useState<PendingAward[]>(seedPendingAwards);
  const [lichessSyncLogs, setLichessSyncLogs] = useState<LichessSyncLog[]>(seedLichessSyncLogs);
  const [outschoolGroups, setOutschoolGroups] = useState<ClassGroup[]>(seedClassGroups);
  const [classDrafts, setClassDrafts] = useState<ClassGroup[]>(seedClassGroups);
  const [selectedStudent, setSelectedStudent] = useState(initialStudents?.[0]?.id ?? seedStudents[0]?.id ?? "");
  const [selectedClassGroup, setSelectedClassGroup] = useState(ALL_CLASSES);
  const [selectedBadge, setSelectedBadge] = useState(seedBadges[0]?.id ?? "");
  const [badgeDraft, setBadgeDraft] = useState<Badge>(seedBadges[0]);
  const [selectedQuest, setSelectedQuest] = useState(seedQuests[0]?.id ?? "");
  const [questDraft, setQuestDraft] = useState<Quest>(seedQuests[0]);
  const [badgeToAward, setBadgeToAward] = useState(seedBadges[0]?.id ?? "");
  const [badgeCategoryFilter, setBadgeCategoryFilter] = useState<"All" | BadgeCategory>("All");
  const [badgeThemeFilter, setBadgeThemeFilter] = useState<"All" | TacticTheme>("All");
  const [badgeConceptFilter, setBadgeConceptFilter] = useState<"All" | ConceptTheme>("All");
  const [badgeTierFilter, setBadgeTierFilter] = useState<"All" | BadgeTier>("All");
  const [showLegacyBadges, setShowLegacyBadges] = useState(false);
  const [xpAmount, setXpAmount] = useState(50);
  const [xpReason, setXpReason] = useState("Class achievement");
  const [selectedOutschoolGroup, setSelectedOutschoolGroup] = useState(seedClassGroups[0]?.id ?? "");
  const [newClassName, setNewClassName] = useState("New Chess Class");
  const [outschoolStudentName, setOutschoolStudentName] = useState("New Outschool Student");
  const [log, setLog] = useState<string[]>(["Admin mock workspace ready."]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const parsed = readAdminStore();
    if (initialStudents) {
      setStudents(initialStudents);
      setSelectedStudent(initialStudents[0]?.id ?? "");
      setLog((items) => [`Loaded ${initialStudents.length} student${initialStudents.length === 1 ? "" : "s"} from Supabase.`, ...items].slice(0, 10));
    } else if (parsed.students) {
      setStudents(parsed.students);
      setSelectedStudent(parsed.students[0]?.id ?? "");
    }
    if (parsed.badges) {
      const mergedBadges = mergeSeedBadges(parsed.badges);
      setBadges(mergedBadges);
      setSelectedBadge(mergedBadges[0]?.id ?? "");
      if (mergedBadges[0]) setBadgeDraft(mergedBadges[0]);
      setBadgeToAward(mergedBadges[0]?.id ?? "");
    }
    if (parsed.quests) {
      const normalizedQuests = normalizeQuests(parsed.quests);
      setQuests(normalizedQuests);
      setSelectedQuest(normalizedQuests[0]?.id ?? "");
      if (normalizedQuests[0]) setQuestDraft(normalizedQuests[0]);
    }
    if (parsed.studentTacticProgress) setTacticProgress(parsed.studentTacticProgress);
    if (parsed.lichessConnections) setLichessConnections(parsed.lichessConnections);
    if (parsed.studentLichessAccounts) setStudentLichessAccounts(parsed.studentLichessAccounts);
    if (parsed.arenaTournamentResults) setArenaTournamentResults(parsed.arenaTournamentResults);
    if (parsed.gameReviewSubmissions) setGameReviewSubmissions(parsed.gameReviewSubmissions);
    if (parsed.pendingAwards) setPendingAwards(parsed.pendingAwards);
    if (parsed.lichessSyncLogs) setLichessSyncLogs(parsed.lichessSyncLogs);
    if (parsed.classGroups) {
      setOutschoolGroups(parsed.classGroups);
      setClassDrafts(parsed.classGroups);
      setSelectedOutschoolGroup(parsed.classGroups[0]?.id ?? "");
    }
    if (parsed.log) setLog(parsed.log);
    setLoaded(true);
  }, [initialStudents]);

  useEffect(() => {
    if (!loaded) return;
    updateAdminStore({ students, badges, quests, classGroups: outschoolGroups, studentTacticProgress: tacticProgress, lichessConnections, studentLichessAccounts, gameReviewSubmissions, pendingAwards, lichessSyncLogs, log });
  }, [badges, loaded, log, outschoolGroups, quests, students, tacticProgress, lichessConnections, studentLichessAccounts, gameReviewSubmissions, pendingAwards, lichessSyncLogs]);

  useEffect(() => {
    if (!requestedStudent || !students.length) return;
    const match = students.find((student) => student.id === requestedStudent || student.slug === requestedStudent || student.lichessUsername === requestedStudent);
    if (match) {
      setSelectedStudent(match.id);
      setSelectedClassGroup(match.classGroup || ALL_CLASSES);
    }
  }, [requestedStudent, students]);

  const classGroups = useMemo(() => getClassGroupNames(outschoolGroups, students), [outschoolGroups, students]);
  const classRoster = useMemo(() => getClassRoster(students, selectedClassGroup), [selectedClassGroup, students]);
  const selectedClassDetails = outschoolGroups.find((group) => group.name === selectedClassGroup);
  const currentStudent = classRoster.find((student) => student.id === selectedStudent) ?? classRoster[0] ?? (selectedClassGroup === ALL_CLASSES ? students[0] : undefined);
  const currentBadge = badges.find((badge) => badge.id === selectedBadge) ?? badges[0];
  const currentQuest = quests.find((quest) => quest.id === selectedQuest) ?? quests[0];
  const filteredBadges = useMemo(() => badges.filter((badge) => (
    (showLegacyBadges ? true : badge.isLegacy !== true && badge.isActive !== false) &&
    (badgeCategoryFilter === "All" || badge.category === badgeCategoryFilter) &&
    (badgeThemeFilter === "All" || badge.tacticTheme === badgeThemeFilter) &&
    (badgeConceptFilter === "All" || badge.conceptTheme === badgeConceptFilter) &&
    (badgeTierFilter === "All" || badge.tier === badgeTierFilter)
  )), [badgeCategoryFilter, badgeConceptFilter, badgeThemeFilter, badgeTierFilter, badges, showLegacyBadges]);
  const currentStudentLichessProgress = tacticProgress.filter((item) => item.studentId === currentStudent?.id);
  const currentStudentConnection = lichessConnections.find((item) => item.studentId === currentStudent?.id);
  const currentStudentLichessAccount = studentLichessAccounts.find((item) => item.studentId === currentStudent?.id);
  const currentStudentArenaPoints = getStudentArenaPoints(currentStudentLichessAccount, arenaTournamentResults);
  const currentStudentXp = currentStudent ? getStudentXpWithLichess(currentStudent, currentStudentLichessAccount) : undefined;
  const currentStudentPendingAwards = pendingAwards.filter((award) => award.studentId === currentStudent?.id && award.status === "pending");
  const currentStudentLichessPuzzleTotal = currentStudentLichessProgress.reduce((total, item) => total + getTacticProgressCount(item), 0);

  useEffect(() => {
    if (currentQuest) setQuestDraft({ ...currentQuest });
  }, [currentQuest?.id]);

  useEffect(() => {
    if (currentBadge) setBadgeDraft({ ...currentBadge });
  }, [currentBadge?.id]);

  useEffect(() => {
    if (selectedClassGroup !== ALL_CLASSES && !classGroups.includes(selectedClassGroup)) {
      setSelectedClassGroup(ALL_CLASSES);
    }
  }, [classGroups, selectedClassGroup]);

  useEffect(() => {
    if (!classRoster.length) return;
    if (!classRoster.some((student) => student.id === selectedStudent)) {
      setSelectedStudent(classRoster[0].id);
    }
  }, [classRoster, selectedStudent]);

  const pushLog = (message: string) => setLog((items) => [`${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${message}`, ...items].slice(0, 10));
  const pushSyncLog = (message: string, level: LichessSyncLog["level"] = "info", studentId?: string) => {
    setLichessSyncLogs((items) => [{ id: `lichess-log-${Date.now()}`, studentId, level, message, createdAt: new Date().toISOString().slice(0, 10) }, ...items].slice(0, 20));
  };

  function updateStudent(patch: Partial<Student>) {
    if (!currentStudent) return;
    setStudents((items) => items.map((student) => student.id === currentStudent.id ? { ...student, ...patch } : student));
  }

  function saveStudent() {
    if (!currentStudent) return;
    const lichessUsername = cleanLichessUsername(currentStudent.lichessUsername || currentStudent.slug || currentStudent.name);
    const slug = slugify(lichessUsername);
    updateStudent({ lichessUsername, slug });
    pushLog(`Saved ${currentStudent.name}.`);
  }

  function addStudent() {
    const classGroup = selectedClassGroup === ALL_CLASSES ? outschoolGroups[0]?.name ?? "Unassigned" : selectedClassGroup;
    const student = emptyStudent(students.length, classGroup);
    setStudents((items) => [student, ...items]);
    setSelectedClassGroup(classGroup);
    setSelectedStudent(student.id);
    pushLog(`Added ${student.name}.`);
  }

  async function deleteStudent() {
    if (!currentStudent || !window.confirm(`Delete ${currentStudent.name}? This removes the student from Supabase and the local admin view.`)) return;
    try {
      const data = deleteStudentAction
        ? await deleteStudentAction({
          id: currentStudent.id,
          slug: currentStudent.slug,
          lichessUsername: currentStudent.lichessUsername
        })
        : await fetch(`/api/admin/students/${encodeURIComponent(currentStudent.id)}?${new URLSearchParams({
          slug: currentStudent.slug ?? "",
          lichessUsername: currentStudent.lichessUsername ?? ""
        }).toString()}`, {
          method: "DELETE",
          credentials: "include"
        }).then((response) => response.json().then((body) => ({ ...body, ok: response.ok })));
      if (!data.ok) {
        window.alert(data.error ?? "Could not delete student from Supabase.");
        return;
      }
      if (data.skipped) {
        window.alert("No matching Supabase student row was found for this student. The local admin view will still remove it.");
        pushLog(`No matching Supabase row found for ${currentStudent.name}.`);
      }
      if (data.deleted) pushLog(`Deleted ${data.count ?? 1} Supabase row${(data.count ?? 1) === 1 ? "" : "s"} for ${currentStudent.name}.`);
      if (data.mode === "local-only") pushLog("Supabase is not configured, so only local data was updated.");
    } catch {
      window.alert("Could not reach the student delete route.");
      return;
    }

    const remaining = students.filter((student) => student.id !== currentStudent.id);
    setStudents(remaining);
    setSelectedStudent(remaining[0]?.id ?? "");
    pushLog(`Deleted ${currentStudent.name}.`);
  }

  function updateOutschoolGroup(id: string, patch: Partial<ClassGroup>) {
    setClassDrafts((items) => items.map((group) => group.id === id ? { ...group, ...patch } : group));
  }

  function addClassGroup() {
    const name = newClassName.trim();
    if (!name || classDrafts.some((group) => group.name.toLowerCase() === name.toLowerCase())) return;
    const group: ClassGroup = {
      id: `${slugify(name)}-${Date.now()}`,
      name,
      outschoolClassUrl: "",
      outschoolSectionId: "",
      syncStatus: "not-connected"
    };
    setClassDrafts((items) => [...items, group]);
    setSelectedOutschoolGroup(group.id);
    setNewClassName("New Chess Class");
    pushLog(`Added class ${name} to draft. Click Save Classes to publish it.`);
  }

  function deleteClassGroup(id: string) {
    const group = classDrafts.find((item) => item.id === id);
    if (!group) return;
    if (!window.confirm(`Delete class ${group.name}? Click Save Classes afterward to publish the change.`)) return;
    const remaining = classDrafts.filter((item) => item.id !== id);
    setClassDrafts(remaining);
    setSelectedOutschoolGroup((current) => current === id ? remaining[0]?.id ?? "" : current);
    pushLog(`Deleted class ${group.name} from draft. Click Save Classes to publish it.`);
  }

  function addCurrentClassGroupLink() {
    const name = currentStudent?.classGroup?.trim();
    if (!name || classDrafts.some((group) => group.name === name)) return;
    const group: ClassGroup = {
      id: slugify(name),
      name,
      outschoolClassUrl: "",
      outschoolSectionId: "",
      syncStatus: "not-connected"
    };
    setClassDrafts((items) => [...items, group]);
    setSelectedOutschoolGroup(group.id);
    pushLog(`Created class draft for ${name}. Click Save Classes to publish it.`);
  }

  function saveClassGroups() {
    const renamedPairs = classDrafts
      .map((draft) => ({ before: outschoolGroups.find((group) => group.id === draft.id)?.name, after: draft.name }))
      .filter((pair) => pair.before && pair.before !== pair.after);
    const deletedNames = outschoolGroups
      .filter((group) => !classDrafts.some((draft) => draft.id === group.id))
      .map((group) => group.name);

    setStudents((items) => items.map((student) => {
      const renamed = renamedPairs.find((pair) => pair.before === student.classGroup);
      if (renamed?.after) return { ...student, classGroup: renamed.after };
      if (deletedNames.includes(student.classGroup)) return { ...student, classGroup: "Unassigned" };
      return student;
    }));
    setOutschoolGroups(classDrafts);
    setSelectedOutschoolGroup((current) => classDrafts.some((group) => group.id === current) ? current : classDrafts[0]?.id ?? "");
    pushLog("Saved class changes.");
  }

  function importMockOutschoolRegistration() {
    const group = outschoolGroups.find((item) => item.id === selectedOutschoolGroup);
    const name = outschoolStudentName.trim();
    if (!group || !name) return;

    const student: Student = {
      id: `outschool-${Date.now()}`,
      slug: slugify(name),
      lichessUsername: cleanLichessUsername(name),
      name,
      avatar: name.slice(0, 1).toUpperCase(),
      classGroup: group.name,
      source: "outschool",
      outschoolLearnerId: `mock-${Date.now()}`,
      totalXp: 0,
      badgeIds: [],
      completedQuestIds: [],
      encouragement: "Welcome to the academy. Your first quest is to learn the board and enjoy the game."
    };

    setStudents((items) => [student, ...items]);
    setSelectedStudent(student.id);
    setOutschoolGroups((items) => items.map((item) => item.id === group.id ? { ...item, syncStatus: "mock-sync", lastSyncedAt: new Date().toISOString().slice(0, 10) } : item));
    setOutschoolStudentName("New Outschool Student");
    pushLog(`Imported mock Outschool registration for ${student.name} into ${group.name}.`);
  }

  function changeXp(multiplier: 1 | -1) {
    if (!currentStudent) return;
    const amount = Math.max(0, Number(xpAmount) || 0);
    setStudents((items) => items.map((student) => student.id === currentStudent.id ? { ...student, totalXp: Math.max(0, student.totalXp + amount * multiplier) } : student));
    pushLog(`${multiplier > 0 ? "Added" : "Subtracted"} ${amount} XP for ${currentStudent.name}: ${xpReason}.`);
  }

  function awardBadge() {
    if (!currentStudent) return;
    const badge = badges.find((item) => item.id === badgeToAward);
    if (!badge) return;
    if (currentStudent.badgeIds.includes(badge.id)) {
      pushLog(`${currentStudent.name} already has ${badge.name}.`);
      return;
    }
    setStudents((items) => items.map((student) => student.id === currentStudent.id ? {
      ...student,
      totalXp: student.totalXp + badge.xpValue,
      badgeIds: [...student.badgeIds, badge.id]
    } : student));
    pushLog(`Awarded ${badge.name} to ${currentStudent.name} and added ${badge.xpValue} XP.`);
  }

  function removeBadge() {
    if (!currentStudent) return;
    const badge = badges.find((item) => item.id === badgeToAward);
    if (!badge) return;
    const hadBadge = currentStudent.badgeIds.includes(badge.id);
    setStudents((items) => items.map((student) => student.id === currentStudent.id ? {
      ...student,
      totalXp: hadBadge ? Math.max(0, student.totalXp - badge.xpValue) : student.totalXp,
      badgeIds: student.badgeIds.filter((id) => id !== badge.id)
    } : student));
    pushLog(`Removed ${badge.name} from ${currentStudent.name}${hadBadge ? ` and subtracted ${badge.xpValue} XP` : ""}.`);
  }

  async function syncCurrentStudentLichess() {
    if (!currentStudent) return;
    const username = currentStudent.lichessUsername || currentStudent.slug;
    try {
      const response = await fetch("/api/lichess/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, studentId: currentStudent.id, includeGames: true })
      });
      const result = await response.json() as {
        mode?: "mock" | "connected";
        counts?: Array<{ tacticTheme: TacticTheme; puzzlesSolved: number }>;
        ratings?: StudentLichessAccount;
        message?: string;
      };
      const counts = new Map((result.counts ?? []).map((item) => [item.tacticTheme, item.puzzlesSolved] as const));
      const mergedProgress = mergeTacticProgress(tacticProgress, currentStudent.id, counts);
      const newAwards = createPendingAwardsFromProgress(currentStudent, mergedProgress, pendingAwards);
      setTacticProgress(mergedProgress);
      setPendingAwards((items) => [...newAwards, ...items]);
      if (result.ratings) {
        const previousAccount = studentLichessAccounts.find((item) => item.studentId === currentStudent.id);
        const nextAccount: StudentLichessAccount = withLichessActivityBaseline({ ...result.ratings, studentId: currentStudent.id, lastGameSyncAt: new Date().toISOString().slice(0, 10) }, previousAccount);
        setStudentLichessAccounts((items) => items.some((item) => item.studentId === currentStudent.id)
          ? items.map((item) => item.studentId === currentStudent.id ? nextAccount : item)
          : [nextAccount, ...items]);
      }
      setLichessConnections((items) => {
        const nextConnection: LichessConnection = {
          studentId: currentStudent.id,
          lichessUsername: username,
          connectedAt: currentStudentConnection?.connectedAt ?? new Date().toISOString().slice(0, 10),
          lastSyncedAt: new Date().toISOString().slice(0, 10),
          status: result.mode ?? "mock"
        };
        return items.some((item) => item.studentId === currentStudent.id)
          ? items.map((item) => item.studentId === currentStudent.id ? nextConnection : item)
          : [nextConnection, ...items];
      });
      const message = `${result.message ?? "Lichess sync complete"} Created ${newAwards.length} pending award${newAwards.length === 1 ? "" : "s"}.`;
      pushSyncLog(message, result.mode === "mock" ? "warning" : "info", currentStudent.id);
      pushLog(message);
    } catch {
      pushSyncLog("Lichess sync failed. Mock data is still available for manual testing.", "error", currentStudent.id);
    }
  }

  function unlinkCurrentStudentLichess() {
    if (!currentStudent) return;
    if (!window.confirm(`Unlink Lichess for ${currentStudent.name}?`)) return;
    setStudentLichessAccounts((items) => items.filter((item) => item.studentId !== currentStudent.id));
    setLichessConnections((items) => items.filter((item) => item.studentId !== currentStudent.id));
    setStudents((items) => items.map((student) => student.id === currentStudent.id ? { ...student, lichessUsername: "" } : student));
    pushLog(`Unlinked Lichess from ${currentStudent.name}.`);
  }

  function resetCurrentStudentOnboarding() {
    if (!currentStudent) return;
    setStudents((items) => items.map((student) => student.id === currentStudent.id ? { ...student, onboardingCompleted: false } : student));
    pushLog(`Reset onboarding for ${currentStudent.name}.`);
  }

  function approvePendingAward(awardId: string) {
    const award = pendingAwards.find((item) => item.id === awardId);
    if (!award) return;
    const student = students.find((item) => item.id === award.studentId);
    if (!student) return;
    const alreadyHasBadge = student.badgeIds.includes(award.badgeId);
    setStudents((items) => items.map((item) => item.id === award.studentId ? {
      ...item,
      badgeIds: alreadyHasBadge ? item.badgeIds : [...item.badgeIds, award.badgeId],
      totalXp: alreadyHasBadge ? item.totalXp : item.totalXp + award.xpValue
    } : item));
    setPendingAwards((items) => items.map((item) => item.id === awardId ? { ...item, status: "approved" } : item));
    pushSyncLog(`${alreadyHasBadge ? "Skipped duplicate" : "Approved"} ${award.badgeName} for ${student.name}.`, "info", student.id);
  }

  function rejectPendingAward(awardId: string) {
    const award = pendingAwards.find((item) => item.id === awardId);
    setPendingAwards((items) => items.map((item) => item.id === awardId ? { ...item, status: "rejected" } : item));
    if (award) pushSyncLog(`Rejected ${award.badgeName}.`, "warning", award.studentId);
  }

  function markStudentQuestComplete(questId: string) {
    if (!currentStudent) return;
    const quest = quests.find((item) => item.id === questId);
    if (!quest) return;

    setStudents((items) => items.map((student) => student.id === currentStudent.id ? {
      ...student,
      completedQuestIds: Array.from(new Set([...(student.completedQuestIds ?? []), quest.id])),
      totalXp: student.completedQuestIds?.includes(quest.id) ? student.totalXp : student.totalXp + quest.xpReward,
      badgeIds: quest.badgeRewardId ? Array.from(new Set([...student.badgeIds, quest.badgeRewardId])) : student.badgeIds
    } : student));
    pushLog(`Marked ${quest.title} complete for ${currentStudent.name}.`);
  }

  function removeStudentQuestCompletion(questId: string) {
    if (!currentStudent) return;
    const quest = quests.find((item) => item.id === questId);
    if (!quest) return;

    setStudents((items) => items.map((student) => student.id === currentStudent.id ? {
      ...student,
      completedQuestIds: (student.completedQuestIds ?? []).filter((id) => id !== quest.id),
      totalXp: Math.max(0, student.totalXp - quest.xpReward),
      badgeIds: quest.badgeRewardId ? student.badgeIds.filter((id) => id !== quest.badgeRewardId) : student.badgeIds
    } : student));
    pushLog(`Removed ${quest.title} completion from ${currentStudent.name}.`);
  }

  function updateBadgeDraft(patch: Partial<Badge>) {
    setBadgeDraft((badge) => ({ ...badge, ...patch }));
  }

  function addBadge() {
    const badge = emptyBadge(badges.length);
    setBadges((items) => [badge, ...items]);
    setSelectedBadge(badge.id);
    setBadgeDraft(badge);
    setBadgeToAward(badge.id);
    pushLog(`Created ${badge.name}.`);
  }

  function saveBadge() {
    if (!currentBadge) return;
    setBadges((items) => items.map((badge) => badge.id === currentBadge.id ? { ...badgeDraft, id: currentBadge.id } : badge));
    setBadgeToAward(currentBadge.id);
    pushLog(`Saved badge ${badgeDraft.name}.`);
  }

  function updateQuestDraft(patch: Partial<Quest>) {
    setQuestDraft((quest) => ({ ...quest, ...patch }));
  }

  function updateQuestSource(source: QuestSource) {
    const defaultCondition = getConditionsForSource(source)[0]?.value ?? "manual";
    setQuestDraft((quest) => ({
      ...quest,
      source,
      category: source.startsWith("lichess_") ? "Lichess" : quest.category,
      conditionType: defaultCondition,
      timeWindow: source === "lichess_tournaments" ? "tournament" : quest.timeWindow ?? "weekly",
      requiredCount: quest.requiredCount ?? 1,
      approvalRequired: source.startsWith("lichess_") ? true : quest.approvalRequired,
      isActive: true,
      isRepeatable: source.startsWith("lichess_") ? true : quest.isRepeatable ?? false,
      cooldownDays: source === "lichess_tournaments" ? 0 : quest.cooldownDays ?? 7
    }));
  }

  function applyQuestPreset(preset: "rated-win" | "ten-puzzles") {
    if (preset === "rated-win") {
      setQuestDraft((quest) => ({
        ...quest,
        title: quest.title.startsWith("New Quest") ? "Win 1 Rated Game" : quest.title,
        description: "Win 1 rated Lichess game after logging in. Games under 10 moves do not count.",
        source: "lichess_games",
        conditionType: "rated_win_count",
        category: "Lichess",
        status: "in-progress",
        isLive: true,
        timeWindow: "weekly",
        requiredCount: 1,
        xpReward: quest.xpReward || 100,
        approvalRequired: true,
        isActive: true,
        isRepeatable: true,
        cooldownDays: 1
      }));
      return;
    }

    setQuestDraft((quest) => ({
      ...quest,
      title: quest.title.startsWith("New Quest") ? "Solve 10 Puzzles" : quest.title,
      description: "Solve 10 Lichess puzzles after logging in.",
      source: "lichess_puzzles",
      conditionType: "puzzle_solved_count",
      category: "Lichess",
      status: "in-progress",
      isLive: true,
      timeWindow: "weekly",
      requiredCount: 10,
      xpReward: quest.xpReward || 100,
      approvalRequired: true,
      isActive: true,
      isRepeatable: true,
      cooldownDays: 1
    }));
  }

  function saveQuest() {
    if (!currentQuest) return;
    const savedQuest = {
      ...questDraft,
      id: currentQuest.id,
      updatedAt: new Date().toISOString(),
      status: questDraft.isLive && questDraft.status === "completed" ? "in-progress" as const : questDraft.status,
      source: questDraft.source ?? "manual",
      conditionType: questDraft.conditionType ?? "manual"
    };
    setQuests((items) => items.map((quest) => quest.id === currentQuest.id ? savedQuest : quest));
    setQuestDraft(savedQuest);
    pushLog(`Saved quest ${questDraft.title}.`);
  }

  function addQuest() {
    const quest = emptyQuest(quests.length);
    setQuests((items) => [quest, ...items]);
    setSelectedQuest(quest.id);
    setQuestDraft(quest);
    pushLog(`Created ${quest.title}.`);
  }

  function deleteQuest() {
    if (!currentQuest || !window.confirm(`Delete quest ${currentQuest.title}? This removes it from local mock storage.`)) return;
    const remaining = quests.filter((quest) => quest.id !== currentQuest.id);
    setQuests(remaining);
    setSelectedQuest(remaining[0]?.id ?? "");
    setQuestDraft(remaining[0] ?? emptyQuest(0));
    pushLog(`Deleted quest ${currentQuest.title}.`);
  }

  function completeQuest() {
    if (!currentQuest) return;
    setQuests((items) => items.map((quest) => quest.id === currentQuest.id ? { ...quest, status: "completed", isLive: false } : quest));
    setQuestDraft((quest) => ({ ...quest, status: "completed", isLive: false }));
    pushLog(`Marked ${currentQuest.title} complete.`);
  }

  function resetLocalData() {
    window.localStorage.removeItem(ADMIN_STORE_KEY);
    setStudents(seedStudents);
    setBadges(seedBadges);
    setQuests(seedQuests);
    setTacticProgress(seedTacticProgress);
    setLichessConnections(seedLichessConnections);
    setStudentLichessAccounts(seedStudentLichessAccounts);
    setArenaTournamentResults(mockArenaTournamentResults);
    setGameReviewSubmissions(seedGameReviewSubmissions);
    setPendingAwards(seedPendingAwards);
    setLichessSyncLogs(seedLichessSyncLogs);
    setOutschoolGroups(seedClassGroups);
    setClassDrafts(seedClassGroups);
    setSelectedStudent(seedStudents[0]?.id ?? "");
    setSelectedClassGroup(ALL_CLASSES);
    setSelectedBadge(seedBadges[0]?.id ?? "");
    setBadgeDraft(seedBadges[0]);
    setSelectedQuest(seedQuests[0]?.id ?? "");
    setQuestDraft(seedQuests[0]);
    setBadgeToAward(seedBadges[0]?.id ?? "");
    setBadgeCategoryFilter("All");
    setBadgeThemeFilter("All");
    setBadgeConceptFilter("All");
    setBadgeTierFilter("All");
    setShowLegacyBadges(false);
    setSelectedOutschoolGroup(seedClassGroups[0]?.id ?? "");
    setNewClassName("New Chess Class");
    setOutschoolStudentName("New Outschool Student");
    setLog(["Admin mock workspace reset to seed data."]);
  }

  const studentEditor = (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-black text-white">Student Editor</h2>
          <p className="mt-1 text-sm text-slate-400">Choose a class, then manage that roster from one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={addStudent}>Add Student</Button>
          <Button variant="secondary" onClick={saveStudent}>Save Student</Button>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Class
              <select className={fieldClass("normal-case")} value={selectedClassGroup} onChange={(event) => setSelectedClassGroup(event.target.value)}>
                {[ALL_CLASSES, ...classGroups].map((group) => (
                  <option key={group} value={group}>
                    {group} ({getClassStudentCount(students, group)})
                  </option>
                ))}
              </select>
            </label>
            <Button href="/admin/classes" variant="ghost">Manage Classes</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-300">
            <span className="rounded bg-cyan-300/10 px-2 py-1 text-cyan-100">{getClassStudentCount(students, selectedClassGroup)} student{getClassStudentCount(students, selectedClassGroup) === 1 ? "" : "s"}</span>
            {selectedClassDetails?.outschoolClassUrl && (
              <a className="rounded bg-amber-300/10 px-2 py-1 text-amber-100 hover:text-amber-50" href={selectedClassDetails.outschoolClassUrl} target="_blank" rel="noreferrer">
                Open class link
              </a>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-cyan-100">{classRoster.length} student{classRoster.length === 1 ? "" : "s"} in {selectedClassGroup}</p>
            </div>
            {selectedClassGroup !== ALL_CLASSES && <Button variant="ghost" onClick={() => setSelectedClassGroup(ALL_CLASSES)}>Show All</Button>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {classRoster.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => setSelectedStudent(student.id)}
                className={`rounded-md border px-3 py-2 text-left transition active:translate-y-px active:scale-[0.99] ${student.id === currentStudent?.id ? "border-cyan-200/70 bg-cyan-300/15 text-white shadow-glow" : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-cyan-300/30 hover:bg-white/10"}`}
              >
                <span className="block text-sm font-black">{student.name}</span>
                <span className="mt-1 block text-xs text-slate-400">{student.lichessUsername || student.slug} - {student.totalXp.toLocaleString()} base XP</span>
              </button>
            ))}
          </div>
          {!classRoster.length && <p className="mt-3 text-sm text-slate-300">No students in this class yet. Add Student will place the new student here.</p>}
        </div>
      </div>
      {currentStudent ? (
        <>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-slate-300">Name
          <input className={fieldClass()} value={currentStudent.name} onChange={(event) => updateStudent({ name: event.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">Lichess Username
          <input
            className={fieldClass()}
            value={currentStudent.lichessUsername ?? currentStudent.slug}
            onChange={(event) => {
              const lichessUsername = cleanLichessUsername(event.target.value);
              updateStudent({ lichessUsername, slug: slugify(lichessUsername) });
            }}
          />
          <span className="text-[11px] font-normal text-slate-500">Profile link: /app/students/{currentStudent.slug}</span>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">Class Group
          <select className={fieldClass()} value={currentStudent.classGroup} onChange={(event) => {
            updateStudent({ classGroup: event.target.value });
            setSelectedClassGroup(event.target.value);
          }}>
            {classGroups.map((group) => <option key={group} value={group}>{group}</option>)}
            {!classGroups.includes(currentStudent.classGroup) && <option value={currentStudent.classGroup}>{currentStudent.classGroup}</option>}
          </select>
        </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Base XP
            <input className={fieldClass()} type="number" value={currentStudent.totalXp} onChange={(event) => updateStudent({ totalXp: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300 md:col-span-2">Encouraging Message
          <textarea className={fieldClass("min-h-24")} value={currentStudent.encouragement} onChange={(event) => updateStudent({ encouragement: event.target.value })} />
        </label>
      </div>
      <div className="mt-5 rounded-lg border border-red-300/20 bg-red-500/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-red-100">Delete {currentStudent.name}</p>
          <Button variant="ghost" onClick={deleteStudent}>Delete Student</Button>
        </div>
        <p className="mt-2 text-xs text-red-100/75">Click Delete Student and confirm in the popup. Supabase students are removed from the database; local-only mock students are removed from this browser.</p>
      </div>
      <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
        <h3 className="font-black text-white">Student XP</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-[140px_1fr_auto_auto]">
          <input className={fieldClass()} type="number" value={xpAmount} onChange={(event) => setXpAmount(Number(event.target.value))} />
          <input className={fieldClass()} value={xpReason} onChange={(event) => setXpReason(event.target.value)} />
          <Button onClick={() => changeXp(1)}>Add XP</Button>
          <Button variant="ghost" onClick={() => changeXp(-1)}>Take XP</Button>
        </div>
        <p className="mt-3 text-xs text-amber-100/80">
          Current XP: {currentStudentXp?.totalXp.toLocaleString() ?? currentStudent.totalXp.toLocaleString()}
          {currentStudentXp?.lichessXp ? ` (${currentStudent.totalXp.toLocaleString()} base + ${currentStudentXp.lichessXp.toLocaleString()} Lichess)` : ""}
        </p>
      </div>
      <div className="mt-5 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
        <h3 className="font-black text-white">Student Badges</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <select className={fieldClass()} value={badgeToAward} onChange={(event) => setBadgeToAward(event.target.value)}>
            {badges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}</option>)}
          </select>
          <Button variant="secondary" onClick={awardBadge}>Award Badge</Button>
          <Button variant="ghost" onClick={removeBadge}>Remove Badge</Button>
        </div>
        <p className="mt-3 text-xs text-cyan-100/80">Current badges: {currentStudent.badgeIds.length ? currentStudent.badgeIds.map((id) => badges.find((badge) => badge.id === id)?.name ?? id).join(", ") : "None yet"}</p>
      </div>
      <div className="mt-5 rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10 p-4">
        <h3 className="font-black text-white">Student Quests</h3>
        <div className="mt-3 grid gap-3">
          {quests.map((quest) => {
            const completed = currentStudent.completedQuestIds?.includes(quest.id) ?? false;
            const rewardBadge = badges.find((badge) => badge.id === quest.badgeRewardId);
            return (
              <div key={quest.id} className="grid gap-3 rounded-md border border-white/10 bg-black/20 p-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div>
                  <p className="font-bold text-white">{quest.title}</p>
                  <p className="text-xs text-slate-400">{quest.xpReward} XP{rewardBadge ? ` · ${rewardBadge.name}` : ""}</p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-bold ${completed ? "bg-emerald-300/15 text-emerald-100" : "bg-white/10 text-slate-300"}`}>
                  {completed ? "Completed" : "Open"}
                </span>
                {completed ? (
                  <Button variant="ghost" onClick={() => removeStudentQuestCompletion(quest.id)}>Remove</Button>
                ) : (
                  <Button variant="secondary" onClick={() => markStudentQuestComplete(quest.id)}>Complete</Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
        </>
      ) : (
        <div className="mt-5 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
          <h3 className="font-black text-white">No Students In This Class</h3>
          <p className="mt-2 text-sm text-slate-300">Use Add Student to create a new student directly inside {selectedClassGroup}.</p>
        </div>
      )}
    </Card>
  );

  const xpEditor = currentStudent && (
    <Card className="p-4">
      <h2 className="font-black text-white">XP and Badge Awards</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_140px_1fr_auto_auto]">
        <select className={fieldClass()} value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)}>
          {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
        </select>
        <input className={fieldClass()} type="number" value={xpAmount} onChange={(event) => setXpAmount(Number(event.target.value))} />
        <input className={fieldClass()} value={xpReason} onChange={(event) => setXpReason(event.target.value)} />
        <Button onClick={() => changeXp(1)}>Add XP</Button>
        <Button variant="ghost" onClick={() => changeXp(-1)}>Subtract</Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <select className={fieldClass()} value={badgeToAward} onChange={(event) => setBadgeToAward(event.target.value)}>
          {badges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}</option>)}
        </select>
        <Button variant="secondary" onClick={awardBadge}>Award Badge</Button>
        <Button variant="ghost" onClick={removeBadge}>Remove Badge</Button>
      </div>
      <p className="mt-3 text-xs text-slate-400">Current badges: {currentStudent.badgeIds.length ? currentStudent.badgeIds.map((id) => badges.find((badge) => badge.id === id)?.name ?? id).join(", ") : "None yet"}</p>
    </Card>
  );

  const lichessSyncPanel = currentStudent && (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-black text-white">Lichess Sync</h2>
          <p className="text-sm text-slate-400">Sync Lichess activity for {currentStudent.lichessUsername ?? currentStudent.slug}. Tokens stay server-side; mock fallback data is used when no Lichess token is connected.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/api/auth/lichess/start?returnTo=/admin/students" variant="secondary">Connect Lichess</Button>
          <Button onClick={syncCurrentStudentLichess}>Sync Lichess</Button>
          <Button onClick={resetCurrentStudentOnboarding} variant="ghost">Reset Onboarding</Button>
          <Button onClick={unlinkCurrentStudentLichess} variant="ghost">Unlink</Button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-black text-white">Lichess Ratings & Puzzles</h3>
            <p className="text-sm text-cyan-50/80">{currentStudent.lichessUsername || currentStudent.slug} - {currentStudentConnection?.status ?? currentStudentLichessAccount?.syncStatus ?? "not connected"} - {currentStudent.onboardingCompleted === false ? "onboarding needed" : "onboarded"}</p>
          </div>
          <p className="text-xs font-bold text-slate-300">Last sync: {currentStudentConnection?.lastSyncedAt ?? currentStudentLichessAccount?.lastRatingSyncAt ?? "Never"}</p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[420px_1fr]">
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-bold uppercase text-slate-400">Ratings</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-bold text-slate-400">Blitz</p>
                <p className="mt-1 text-xl font-black text-white">{currentStudentLichessAccount?.blitzRating ?? "Not synced"}</p>
                <p className="mt-1 text-xs text-slate-400">{currentStudentLichessAccount?.blitzGames ?? 0} games</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-bold text-slate-400">Rapid</p>
                <p className="mt-1 text-xl font-black text-white">{currentStudentLichessAccount?.rapidRating ?? "Not synced"}</p>
                <p className="mt-1 text-xs text-slate-400">{currentStudentLichessAccount?.rapidGames ?? 0} games</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-bold text-slate-400">Puzzle</p>
                <p className="mt-1 text-xl font-black text-white">{currentStudentLichessAccount?.puzzleRating ?? "Not synced"}</p>
                <p className="mt-1 text-xs text-slate-400">{currentStudentLichessAccount?.puzzleGames ?? 0} puzzles</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-bold text-slate-400">Arena Points</p>
                <p className="mt-1 text-xl font-black text-white">{currentStudentArenaPoints.totalPoints}</p>
                <p className="mt-1 text-xs text-slate-400">{currentStudentArenaPoints.tournamentsPlayed} tournaments after first login</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-300">
              <p><span className="font-bold text-cyan-100">{currentStudentPendingAwards.length}</span> pending awards</p>
              <p><span className="font-bold text-cyan-100">{currentStudentXp?.lichessXp.toLocaleString() ?? 0}</span> Lichess XP added to level</p>
              <p>Rating XP: Blitz {currentStudentXp?.lichess.blitzRatingXp ?? 0}, Rapid {currentStudentXp?.lichess.rapidRatingXp ?? 0}, Puzzle {currentStudentXp?.lichess.puzzleRatingXp ?? 0}</p>
              <p>{currentStudentXp?.lichess.ratedGamesAfterLogin ?? 0} rated games and {currentStudentXp?.lichess.puzzlesAfterLogin ?? 0} puzzles counted after first login</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase text-slate-400">Puzzle / Tactic Progress</p>
              <p className="text-xs font-bold text-cyan-100">{currentStudentLichessPuzzleTotal} counted</p>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
              {currentStudentLichessProgress.map((item) => (
                <div key={`${item.studentId}-${item.tacticTheme}`} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <span>{item.tacticTheme}</span>
                  <span className="font-bold text-cyan-100">{getTacticProgressCount(item)}</span>
                </div>
              ))}
              {currentStudentLichessProgress.length === 0 && <p>No synced puzzle progress yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div>
          <h3 className="font-black text-white">Pending Badge Awards</h3>
          <div className="mt-3 space-y-2">
            {currentStudentPendingAwards.map((award) => (
              <div key={award.id} className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-white">{award.badgeName}</p>
                    <p className="text-xs text-amber-100">{award.puzzlesSolved} {award.tacticTheme} puzzles - {award.xpValue} XP</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => approvePendingAward(award.id)}>Approve</Button>
                    <Button variant="ghost" onClick={() => rejectPendingAward(award.id)}>Reject</Button>
                  </div>
                </div>
              </div>
            ))}
            {currentStudentPendingAwards.length === 0 && <p className="text-sm text-slate-300">No pending awards for this student.</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
        <h3 className="font-black text-white">Sync Logs</h3>
        <div className="mt-2 space-y-1 text-xs text-slate-300">
          {lichessSyncLogs.slice(0, 6).map((item) => <p key={item.id}>{item.createdAt} - {item.level}: {item.message}</p>)}
        </div>
      </div>
    </Card>
  );

  const outschoolPanel = (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-black text-white">Classes and Outschool Links</h2>
          <p className="text-sm text-slate-400">Edit class groups as a draft, then click Save Classes to publish changes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={saveClassGroups}>Save Classes</Button>
          <Button variant="ghost" onClick={addCurrentClassGroupLink}>Add Current Group</Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input className={fieldClass()} value={newClassName} onChange={(event) => setNewClassName(event.target.value)} placeholder="Class name" />
        <Button onClick={addClassGroup}>Add Class</Button>
      </div>
      <div className="mt-4 space-y-3">
        {classDrafts.map((group) => (
          <div key={group.id} className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 xl:grid-cols-[180px_1fr_180px_auto]">
            <input className={fieldClass()} value={group.name} onChange={(event) => updateOutschoolGroup(group.id, { name: event.target.value })} />
            <input
              className={fieldClass()}
              value={group.outschoolClassUrl}
              onChange={(event) => updateOutschoolGroup(group.id, { outschoolClassUrl: event.target.value, syncStatus: event.target.value ? "linked" : "not-connected" })}
              placeholder="https://outschool.com/classes/..."
            />
            <input className={fieldClass()} value={group.outschoolSectionId ?? ""} onChange={(event) => updateOutschoolGroup(group.id, { outschoolSectionId: event.target.value })} placeholder="Section ID optional" />
            <Button variant="ghost" onClick={() => deleteClassGroup(group.id)}>Delete Class</Button>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <select className={fieldClass()} value={selectedOutschoolGroup} onChange={(event) => setSelectedOutschoolGroup(event.target.value)}>
          {outschoolGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <input className={fieldClass()} value={outschoolStudentName} onChange={(event) => setOutschoolStudentName(event.target.value)} placeholder="Learner name from Outschool" />
        <Button onClick={importMockOutschoolRegistration}>Mock Import Registration</Button>
      </div>
    </Card>
  );

  const badgeEditor = currentBadge && (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-black text-white">Badge Editor</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={addBadge}>Create Badge</Button>
            <Button variant="secondary" onClick={saveBadge}>Save Badge</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="grid gap-1 text-xs font-bold text-slate-300">Category Filter
            <select className={fieldClass()} value={badgeCategoryFilter} onChange={(event) => setBadgeCategoryFilter(event.target.value as "All" | BadgeCategory)}>
              <option>All</option>
              {badgeCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Tactic Filter
            <select className={fieldClass()} value={badgeThemeFilter} onChange={(event) => setBadgeThemeFilter(event.target.value as "All" | TacticTheme)}>
              <option>All</option>
              {tacticThemes.map((theme) => <option key={theme}>{theme}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Concept Filter
            <select className={fieldClass()} value={badgeConceptFilter} onChange={(event) => setBadgeConceptFilter(event.target.value as "All" | ConceptTheme)}>
              <option>All</option>
              {conceptThemes.map((theme) => <option key={theme}>{theme}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs font-bold text-slate-300">
            <input type="checkbox" checked={showLegacyBadges} onChange={(event) => setShowLegacyBadges(event.target.checked)} className="h-4 w-4 accent-cyan-300" />
            Show legacy
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-slate-300">Tier Filter
            <select className={fieldClass()} value={badgeTierFilter} onChange={(event) => setBadgeTierFilter(event.target.value as "All" | BadgeTier)}>
              <option>All</option>
              {badgeTiers.map((tier) => <option key={tier}>{tier}</option>)}
              {(["C", "B", "A", "S"] as BadgeTier[]).map((tier) => <option key={tier}>{tier}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-slate-300 md:col-span-2">Choose Badge
            <select className={fieldClass()} value={selectedBadge} onChange={(event) => setSelectedBadge(event.target.value)}>
              {filteredBadges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}{badge.isLegacy ? " (legacy)" : ""}</option>)}
              {!filteredBadges.some((badge) => badge.id === selectedBadge) && currentBadge && <option value={currentBadge.id}>{currentBadge.name}</option>}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Name
            <input className={fieldClass()} value={badgeDraft.name} onChange={(event) => updateBadgeDraft({ name: event.target.value })} />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Category
            <select className={fieldClass()} value={badgeDraft.category} onChange={(event) => {
              const category = event.target.value as BadgeCategory;
              updateBadgeDraft({
                category,
                tacticTheme: category === "Tactics" ? badgeDraft.tacticTheme ?? "Fork" : undefined,
                conceptTheme: category === "Concepts" ? badgeDraft.conceptTheme ?? "Opening Principles" : undefined,
                tier: category === "Concepts" ? undefined : badgeDraft.tier ?? "Bronze",
                requiredPuzzleCount: category === "Concepts" ? undefined : badgeDraft.requiredPuzzleCount ?? 10
              });
            }}>
              {badgeCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          {badgeDraft.category === "Tactics" && (
            <label className="grid gap-1 text-xs font-bold text-slate-300">Tactic Theme
              <select className={fieldClass()} value={badgeDraft.tacticTheme ?? ""} onChange={(event) => updateBadgeDraft({ tacticTheme: (event.target.value || undefined) as TacticTheme | undefined })}>
                <option value="">None</option>
                {tacticThemes.map((theme) => <option key={theme}>{theme}</option>)}
              </select>
            </label>
          )}
          {badgeDraft.category === "Concepts" && (
            <label className="grid gap-1 text-xs font-bold text-slate-300">Concept Theme
              <select className={fieldClass()} value={badgeDraft.conceptTheme ?? ""} onChange={(event) => updateBadgeDraft({ conceptTheme: (event.target.value || undefined) as ConceptTheme | undefined })}>
                <option value="">None</option>
                {conceptThemes.map((theme) => <option key={theme}>{theme}</option>)}
              </select>
            </label>
          )}
          {badgeDraft.category !== "Concepts" && (
            <label className="grid gap-1 text-xs font-bold text-slate-300">Tier
              <select className={fieldClass()} value={badgeDraft.tier ?? ""} onChange={(event) => updateBadgeDraft({ tier: (event.target.value || undefined) as BadgeTier | undefined })}>
                {[...badgeTiers, ...(["C", "B", "A", "S"] as BadgeTier[])].map((tier) => <option key={tier}>{tier}</option>)}
              </select>
            </label>
          )}
          <label className="grid gap-1 text-xs font-bold text-slate-300">XP Value
            <input className={fieldClass()} type="number" value={badgeDraft.xpValue} onChange={(event) => updateBadgeDraft({ xpValue: Number(event.target.value) || 0 })} />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300 md:col-span-2">Description
            <textarea className={fieldClass("min-h-20")} value={badgeDraft.description} onChange={(event) => updateBadgeDraft({ description: event.target.value })} />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Unlock Requirement
            <input className={fieldClass()} value={badgeDraft.unlockRequirement} onChange={(event) => updateBadgeDraft({ unlockRequirement: event.target.value })} />
          </label>
          {badgeDraft.category !== "Concepts" && (
            <label className="grid gap-1 text-xs font-bold text-slate-300">Required Puzzle Count
              <input className={fieldClass()} type="number" value={badgeDraft.requiredPuzzleCount ?? 0} onChange={(event) => updateBadgeDraft({ requiredPuzzleCount: Number(event.target.value) || 0 })} />
            </label>
          )}
          <label className="grid gap-1 text-xs font-bold text-slate-300">Visual Theme
            <input className={fieldClass()} value={badgeDraft.visualTheme} onChange={(event) => updateBadgeDraft({ visualTheme: event.target.value })} />
          </label>
          <div className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={badgeDraft.isActive !== false} onChange={(event) => updateBadgeDraft({ isActive: event.target.checked })} className="h-4 w-4 accent-cyan-300" />
              Active
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={badgeDraft.isLegacy === true} onChange={(event) => updateBadgeDraft({ isLegacy: event.target.checked })} className="h-4 w-4 accent-cyan-300" />
              Legacy
            </label>
          </div>
          <label className="grid gap-1 text-xs font-bold text-slate-300 md:col-span-2">Image Generation Prompt
            <textarea
              className={fieldClass("min-h-40 font-mono text-xs leading-relaxed")}
              value={badgeDraft.imagePrompt ?? buildDefaultBadgeImagePrompt(badgeDraft)}
              onChange={(event) => updateBadgeDraft({ imagePrompt: event.target.value })}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">Badge edits and prompt changes stay as a draft until you press Save Badge.</p>
          <Button variant="ghost" onClick={() => updateBadgeDraft({ imagePrompt: buildDefaultBadgeImagePrompt(badgeDraft) })}>Reset Prompt</Button>
        </div>
      </Card>
      <BadgeGeneratorPanel
        badge={badgeDraft}
        onSave={(imageUrl) => {
          const updated = { ...badgeDraft, finalImageUrl: imageUrl, artImageUrl: imageUrl, generationStatus: "selected" as const };
          setBadgeDraft(updated);
          setBadges((items) => items.map((badge) => badge.id === currentBadge.id ? updated : badge));
          pushLog(`Saved generated art for ${updated.name}.`);
        }}
      />
    </div>
  );

  const questEditor = currentQuest && (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-black text-white">Quest Editor</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={addQuest}>Create Quest</Button>
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-xs font-black uppercase tracking-wide text-slate-400">All Quests</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {quests.map((quest) => {
            const isSelected = quest.id === selectedQuest;
            const rewardBadge = badges.find((badge) => badge.id === quest.badgeRewardId);
            return (
              <div
                key={quest.id}
                className={`rounded-lg border p-3 ${isSelected ? "border-cyan-200/60 bg-cyan-300/10" : "border-white/10 bg-white/5"}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase">
                      <span className="rounded bg-white/10 px-2 py-1 text-slate-200">{quest.type}</span>
                      <span className="rounded bg-white/10 px-2 py-1 text-slate-200">{quest.status}</span>
                      <span className={`rounded px-2 py-1 ${quest.isLive ? "bg-cyan-300/15 text-cyan-100" : "bg-slate-700/50 text-slate-300"}`}>
                        {quest.isLive ? "Live" : "Hidden"}
                      </span>
                      <span className="rounded bg-white/10 px-2 py-1 text-slate-200">{getQuestSourceLabel(quest.source)}</span>
                    </div>
                    <p className="mt-2 font-black text-white">{quest.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{quest.description}</p>
                    <p className="mt-2 text-xs text-amber-100">{quest.xpReward} XP{rewardBadge ? ` - ${rewardBadge.name}` : ""}</p>
                    {quest.source?.startsWith("lichess_") && <p className="mt-1 text-xs text-cyan-100">{getQuestConditionLabel(quest.conditionType)} - {quest.requiredCount ?? quest.requiredScore ?? 1} required</p>}
                  </div>
                  <Button variant={isSelected ? "secondary" : "ghost"} onClick={() => setSelectedQuest(quest.id)}>
                    {isSelected ? "Editing" : "Edit"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-black text-white">Edit Selected Quest</h3>
            <p className="mt-1 text-xs text-slate-400">Manual quests are completed by you. Lichess quests sync activity, then wait for teacher approval before awarding XP.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={saveQuest}>Save Quest</Button>
            <Button variant="secondary" onClick={completeQuest}>Mark Complete</Button>
            <Button variant="ghost" onClick={deleteQuest}>Delete Quest</Button>
          </div>
        </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-slate-300">Title
          <input className={fieldClass()} value={questDraft.title} onChange={(event) => updateQuestDraft({ title: event.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">XP Reward
          <input className={fieldClass()} type="number" value={questDraft.xpReward} onChange={(event) => updateQuestDraft({ xpReward: Number(event.target.value) || 0 })} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">Type
          <select className={fieldClass()} value={questDraft.type} onChange={(event) => updateQuestDraft({ type: event.target.value as QuestType })}>
            {questTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">Status
          <select className={fieldClass()} value={questDraft.status} onChange={(event) => updateQuestDraft({ status: event.target.value as QuestStatus })}>
            {questStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">Tracking
          <select className={fieldClass()} value={questDraft.source ?? "manual"} onChange={(event) => updateQuestSource(event.target.value as QuestSource)}>
            {questSources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
          </select>
          <span className="text-[11px] font-normal text-slate-500">{questSources.find((source) => source.value === (questDraft.source ?? "manual"))?.description}</span>
        </label>
        <div className="grid gap-2 rounded-md border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-300">
          <p className="uppercase text-slate-400">Lichess Quick Goals</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => applyQuestPreset("rated-win")}>Win 1 Rated Game</Button>
            <Button variant="secondary" onClick={() => applyQuestPreset("ten-puzzles")}>Solve 10 Puzzles</Button>
          </div>
        </div>
        <label className="grid gap-1 text-xs font-bold text-slate-300">Goal
          <select className={fieldClass()} value={questDraft.conditionType ?? "manual"} onChange={(event) => updateQuestDraft({ conditionType: event.target.value as QuestConditionType })}>
            {getConditionsForSource(questDraft.source ?? "manual").map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}
          </select>
        </label>
        {questDraft.source?.startsWith("lichess_") && (
          <>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Time Window
              <select className={fieldClass()} value={questDraft.timeWindow ?? "weekly"} onChange={(event) => updateQuestDraft({ timeWindow: event.target.value as QuestTimeWindow })}>
                {questTimeWindows.map((window) => <option key={window} value={window}>{window.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">{getQuestCountLabel(questDraft.conditionType)}
              <input className={fieldClass()} type="number" min={0} value={questDraft.requiredCount ?? 1} onChange={(event) => updateQuestDraft({ requiredCount: Math.max(0, Number(event.target.value) || 0) })} />
            </label>
            {(questDraft.conditionType === "arena_score_threshold" || questDraft.conditionType === "rating_peak") && (
              <label className="grid gap-1 text-xs font-bold text-slate-300">Required Score / Rating
                <input className={fieldClass()} type="number" min={0} value={questDraft.requiredScore ?? 0} onChange={(event) => updateQuestDraft({ requiredScore: Math.max(0, Number(event.target.value) || 0) })} />
              </label>
            )}
            {questDraft.conditionType === "puzzle_accuracy_threshold" && (
              <label className="grid gap-1 text-xs font-bold text-slate-300">Required Accuracy %
                <input className={fieldClass()} type="number" min={0} max={100} value={questDraft.requiredAccuracy ?? 80} onChange={(event) => updateQuestDraft({ requiredAccuracy: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} />
              </label>
            )}
            {questDraft.conditionType === "puzzle_theme_solved_count" && (
              <label className="grid gap-1 text-xs font-bold text-slate-300">Tactic Theme
                <select className={fieldClass()} value={questDraft.requiredTheme ?? ""} onChange={(event) => updateQuestDraft({ requiredTheme: (event.target.value || undefined) as TacticTheme | undefined })}>
                  <option value="">Any theme</option>
                  {questTacticThemes.map((theme) => <option key={theme}>{theme}</option>)}
                </select>
              </label>
            )}
          </>
        )}
        <label className="flex items-center gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-50">
          <input
            type="checkbox"
            checked={questDraft.isLive === true}
            onChange={(event) => updateQuestDraft({ isLive: event.target.checked, status: event.target.checked && questDraft.status === "completed" ? "in-progress" : questDraft.status })}
            className="h-4 w-4 accent-cyan-300"
          />
          Live for students
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">Badge Reward
          <select className={fieldClass()} value={questDraft.badgeRewardId ?? ""} onChange={(event) => updateQuestDraft({ badgeRewardId: event.target.value || undefined })}>
            <option value="">No badge reward</option>
            {badges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">Class Group
          <input className={fieldClass()} list="class-groups" value={questDraft.classGroup ?? ""} onChange={(event) => updateQuestDraft({ classGroup: event.target.value })} />
          <datalist id="class-groups">{classGroups.map((group) => <option key={group} value={group} />)}</datalist>
        </label>
        {questDraft.source?.startsWith("lichess_") && (
          <div className="grid gap-2 rounded-md border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={questDraft.isActive !== false} onChange={(event) => updateQuestDraft({ isActive: event.target.checked })} className="h-4 w-4 accent-cyan-300" />
              Active for Lichess sync
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={questDraft.isRepeatable === true} onChange={(event) => updateQuestDraft({ isRepeatable: event.target.checked })} className="h-4 w-4 accent-cyan-300" />
              Repeatable
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={questDraft.approvalRequired !== false} onChange={(event) => updateQuestDraft({ approvalRequired: event.target.checked })} className="h-4 w-4 accent-cyan-300" />
              Teacher approval required
            </label>
            <label className="grid gap-1">Cooldown Days
              <input className={fieldClass()} type="number" min={0} value={questDraft.cooldownDays ?? 0} onChange={(event) => updateQuestDraft({ cooldownDays: Math.max(0, Number(event.target.value) || 0) })} />
            </label>
          </div>
        )}
        <label className="grid gap-1 text-xs font-bold text-slate-300 md:col-span-2">Description
          <textarea className={fieldClass("min-h-24")} value={questDraft.description} onChange={(event) => updateQuestDraft({ description: event.target.value })} />
        </label>
      </div>
        <p className="mt-3 text-xs text-slate-400">Quest edits stay as a draft until you press Save Quest.</p>
      </div>
    </Card>
  );

  const localTools = (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-black text-white">Local Mock Storage</h2>
          <p className="text-sm text-slate-400">Admin changes save in this browser and survive refreshes until reset.</p>
        </div>
        <Button variant="ghost" onClick={resetLocalData}>Reset Mock Data</Button>
      </div>
    </Card>
  );

  const logPanel = (
    <Card className="p-4">
      <h2 className="font-black text-white">Mock Activity Log</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-300">{log.map((item, index) => <p key={`${item}-${index}`}>- {item}</p>)}</div>
    </Card>
  );

  if (mode === "activity") return <ActivityFeed events={activity} />;
  if (mode === "students") return <div className="space-y-5">{studentEditor}{lichessSyncPanel}{localTools}{logPanel}</div>;
  if (mode === "classes") return <div className="space-y-5">{outschoolPanel}{localTools}{logPanel}</div>;
  if (mode === "badges") return <div className="space-y-5">{badgeEditor}{localTools}{logPanel}</div>;
  if (mode === "xp") return <div className="space-y-5">{xpEditor}{localTools}{logPanel}</div>;
  if (mode === "quests") return <div className="space-y-5">{questEditor}{localTools}{logPanel}</div>;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        {studentEditor}
        {outschoolPanel}
        {xpEditor}
        {badgeEditor}
        {questEditor}
      </div>
      {localTools}
      {logPanel}
    </div>
  );
}
