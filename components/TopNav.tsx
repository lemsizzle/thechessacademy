import Link from "next/link";
import { getNavigationGroups, getTopNavActions, type NavVariant } from "@/components/navigation";

export function TopNav({ variant = "public" }: { variant?: NavVariant }) {
  const actions = getTopNavActions(variant);
  const groups = getNavigationGroups(variant);
  const homeHref = variant === "student" ? "/student" : variant === "admin" ? "/admin" : "/app";

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/78 px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={homeHref} className="font-black text-white">The Chess Academy Quest Board</Link>
        <div className="hidden items-center gap-2 text-xs font-bold sm:flex">
          {actions.map((link) => (
            <Link key={link.href} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10" href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
        <details className="relative sm:hidden">
          <summary className="list-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-100">Menu</summary>
          <div className="absolute right-0 top-11 z-30 w-72 rounded-lg border border-white/10 bg-slate-950 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
            <div className="space-y-4">
              {groups.map((group, index) => (
                <div key={group.title ?? `mobile-${index}`}>
                  {group.title && <p className="mb-2 text-xs font-black uppercase text-slate-500">{group.title}</p>}
                  <div className="grid gap-1">
                    {group.links.map((link) => (
                      <Link key={link.href} className="rounded-md px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10" href={link.href}>
                        {link.icon ? `${link.icon} ` : ""}{link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid gap-1 border-t border-white/10 pt-3">
                {actions.map((link) => (
                  <Link key={link.href} className="rounded-md px-3 py-2 text-sm font-bold text-cyan-100 hover:bg-white/10" href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
