export type NavVariant = "public" | "admin" | "student";

export type NavLink = {
  href: string;
  label: string;
  icon?: string;
};

export type NavGroup = {
  title?: string;
  links: NavLink[];
};

const exploreLinks: NavLink[] = [
  { href: "/app", label: "Students", icon: "\u265F\uFE0F" },
  { href: "/app/tournaments", label: "Tournaments", icon: "\u{1F3DF}\uFE0F" },
  { href: "/app/resources", label: "Resources FAQ", icon: "\u{1F517}" }
];

const studentExploreLinks: NavLink[] = [
  { href: "/student/training", label: "Puzzle Training", icon: "\u{1F9E9}" },
  { href: "/student/leaderboard", label: "Leaderboard", icon: "\u{1F3C6}" },
  { href: "/student/quests", label: "Quests & Lichess", icon: "\u{1F4DC}" },
  { href: "/student/tournaments", label: "Tournaments", icon: "\u{1F3DF}\uFE0F" },
  { href: "/student/resources", label: "Resources FAQ", icon: "\u{1F517}" }
];

const studentQuestLinks: NavLink[] = [
  { href: "/student/avatar", label: "Avatar & Store", icon: "\u{1F9D9}" },
  { href: "/student/submit", label: "Submit Work", icon: "\u{1F4DD}" }
];

const teacherCoreLinks: NavLink[] = [
  { href: "/admin", label: "Dashboard", icon: "\u{1F9ED}" },
  { href: "/admin/submissions", label: "Submissions", icon: "\u{1F4E5}" },
  { href: "/admin/students", label: "Students", icon: "\u265F\uFE0F" },
  { href: "/admin/leaderboard", label: "Leaderboard", icon: "\u{1F3C6}" }
];

const teacherSetupLinks: NavLink[] = [
  { href: "/admin/classes", label: "Classes", icon: "\u{1F3EB}" },
  { href: "/admin/badges", label: "Badges", icon: "\u{1F396}\uFE0F" },
  { href: "/admin/quests", label: "Quests", icon: "\u{1F4DC}" },
  { href: "/admin/tournaments", label: "Tournaments", icon: "\u{1F3DF}\uFE0F" },
  { href: "/admin/resources", label: "Resources", icon: "\u{1F517}" },
  { href: "/admin/avatar", label: "Avatar Studio", icon: "\u{1F9D9}" }
];

const teacherToolLinks: NavLink[] = [
  { href: "/admin/game-analyzer", label: "Game Analyzer", icon: "\u{1F50D}" },
  { href: "/admin/activity", label: "Activity", icon: "\u{1F4D2}" }
];

export function getNavigationGroups(variant: NavVariant): NavGroup[] {
  if (variant === "admin") {
    return [
      { title: "Teacher", links: teacherCoreLinks },
      { title: "Setup", links: teacherSetupLinks },
      { title: "Tools", links: teacherToolLinks }
    ];
  }

  if (variant === "student") {
    return [
      { title: "Student", links: [{ href: "/student", label: "Dashboard", icon: "\u{1F9ED}" }] },
      { title: "My Quest Board", links: studentQuestLinks },
      { title: "Academy", links: studentExploreLinks }
    ];
  }

  return [{ links: exploreLinks }];
}

export function getTopNavActions(variant: NavVariant): NavLink[] {
  if (variant === "admin") return [{ href: "/app", label: "View Portal" }, { href: "/api/admin/logout", label: "Log Out" }];
  if (variant === "student") return [];
  return [{ href: "/api/auth/lichess/start", label: "Log in with Lichess" }];
}
