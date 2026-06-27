const PARENT_PROFILE_ACCESS_KEY = "quest-board-parent-profile-access";
const ACCESS_TTL_MS = 60 * 60 * 1000;

type ParentProfileAccess = {
  slug: string;
  grantedAt: number;
};

export function grantParentStudentProfileAccess(slug: string) {
  if (typeof window === "undefined") return;
  const access: ParentProfileAccess = {
    slug: slug.toLowerCase(),
    grantedAt: Date.now()
  };
  window.sessionStorage.setItem(PARENT_PROFILE_ACCESS_KEY, JSON.stringify(access));
}

export function hasParentStudentProfileAccess(slug: string) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(PARENT_PROFILE_ACCESS_KEY);
    if (!raw) return false;
    const access = JSON.parse(raw) as ParentProfileAccess;
    return access.slug === slug.toLowerCase() && Date.now() - access.grantedAt <= ACCESS_TTL_MS;
  } catch {
    window.sessionStorage.removeItem(PARENT_PROFILE_ACCESS_KEY);
    return false;
  }
}
