import Link from "next/link";
import { getNavigationGroups, type NavVariant } from "@/components/navigation";

export function Sidebar({ variant = "public" }: { variant?: NavVariant }) {
  const groups = getNavigationGroups(variant);
  const homeHref = variant === "student" ? "/student" : variant === "admin" ? "/admin" : "/";

  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-slate-950/70 p-4 lg:block">
      <Link href={homeHref} className="block rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
        <p className="text-xs font-bold uppercase text-amber-100">Chess Academy</p>
        <p className="mt-1 text-lg font-black text-white">Quest Board</p>
      </Link>
      <nav className="mt-6 space-y-5">
        {groups.map((group, index) => (
          <div key={group.title ?? `group-${index}`}>
            {group.title && <p className="mb-2 px-3 text-xs font-black uppercase text-slate-500">{group.title}</p>}
            <div className="space-y-1">
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white">
                  {link.icon && <span className="flex w-6 justify-center text-base">{link.icon}</span>}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
