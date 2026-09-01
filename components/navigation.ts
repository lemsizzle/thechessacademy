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

export type StudentNavHub = NavLink & {
  branches: NavLink[];
};

const exploreLinks: NavLink[] = [
  { href: "/app", label: "Students", icon: "\u265F\uFE0F" },
  { href: "/app/tournaments", label: "Tournaments", icon: "\u{1F3DF}\uFE0F" },
  { href: "/app/resources", label: "Resources FAQ", icon: "\u{1F517}" }
];

const studentNavigationHubs: StudentNavHub[] = [
  {
    href: "/student/training",
    label: "Train",
    icon: "\u{1F9E9}",
    branches: [{ href: "/student/studies", label: "Studies", icon: "\u{1F4D3}" }]
  },
  {
    href: "/student/play",
    label: "Play",
    icon: "\u265E",
    branches: [
      { href: "/student/play/correspondence", label: "Correspondence", icon: "\u2709\uFE0F" },
      { href: "/student/play/history", label: "Game History", icon: "\u{1F4CA}" },
      { href: "/student/tournaments", label: "Tournaments", icon: "\u{1F3DF}\uFE0F" }
    ]
  },
  {
    href: "/student/quests",
    label: "Quests",
    icon: "\u{1F4DC}",
    branches: [{ href: "/student/submit", label: "Submit Work", icon: "\u{1F4DD}" }]
  },
  {
    href: "/student/avatar",
    label: "Avatar Store",
    icon: "\u{1F9D9}",
    branches: []
  }
];

const studentMoreLinks: NavLink[] = [
  { href: "/student", label: "Dashboard", icon: "\u{1F9ED}" },
  { href: "/student?progress=overview", label: "Stats", icon: "\u{1F4C8}" },
  { href: "/student/leaderboard", label: "Leaderboard", icon: "\u{1F3C6}" },
  { href: "/student/resources", label: "Resources FAQ", icon: "\u{1F517}" }
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
  { href: "/admin/live-games", label: "Live Games", icon: "\u{1F441}\uFE0F" },
  { href: "/admin/game-analyzer", label: "Game Analyzer", icon: "\u{1F50D}" },
  { href: "/admin/chess-performance", label: "Chess Performance", icon: "\u{1F4CA}" },
  { href: "/admin/adaptive-training", label: "Adaptive Training", icon: "\u{1F9E0}" },
  { href: "/admin/chess-ratings", label: "Chess Ratings", icon: "\u{1F3C5}" },
  { href: "/admin/studies", label: "Chess Studies", icon: "\u{1F4D3}" },
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
      ...studentNavigationHubs.map((hub) => ({
        title: hub.label,
        links: [{ href: hub.href, label: hub.label, icon: hub.icon }, ...hub.branches]
      })),
      { title: "More", links: studentMoreLinks }
    ];
  }

  return [{ links: exploreLinks }];
}

export function getTopNavActions(variant: NavVariant): NavLink[] {
  if (variant === "admin") return [{ href: "/app", label: "View Portal" }, { href: "/api/admin/logout", label: "Log Out" }];
  if (variant === "student") return [];
  return [{ href: "/api/auth/lichess/start", label: "Log in with Lichess" }];
}

export function getStudentMobilePrimaryLinks(): NavLink[] {
  return studentNavigationHubs.map(({ href, label, icon }) => ({ href, label, icon }));
}

export function getStudentMobileMoreLinks(): NavLink[] {
  return getStudentMobileMoreGroups().flatMap((group) => group.links);
}

export function getStudentNavigationHubs(): StudentNavHub[] {
  return studentNavigationHubs.map((hub) => ({
    ...hub,
    branches: hub.branches.map((branch) => ({ ...branch }))
  }));
}

export function getStudentMoreLinks(): NavLink[] {
  return studentMoreLinks.map((link) => ({ ...link }));
}

export function getStudentMobileMoreGroups(): NavGroup[] {
  return [
    ...studentNavigationHubs
      .filter((hub) => hub.branches.length > 0)
      .map((hub) => ({ title: hub.label, links: hub.branches.map((branch) => ({ ...branch })) })),
    { title: "More", links: getStudentMoreLinks() }
  ];
}
