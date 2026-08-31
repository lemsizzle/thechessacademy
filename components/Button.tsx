import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
} & Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel">;

const variants = {
  primary: "border-amber-200/70 bg-amber-300 text-slate-950 shadow-[0_8px_22px_rgba(251,191,36,.16)] hover:bg-amber-200",
  secondary: "border-cyan-200/30 bg-cyan-200/10 text-cyan-50 hover:border-cyan-200/50 hover:bg-cyan-200/15",
  ghost: "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 active:bg-white/15 active:shadow-none"
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export function Button({ href, children, variant = "primary", className = "", target, rel, ...props }: ButtonProps) {
  const classes = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition duration-150 ease-out active:translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 disabled:active:scale-100 ${variants[variant]} ${className}`;

  if (href) {
    if (isExternalHref(href)) {
      return (
        <a className={classes} href={href} target={target ?? "_blank"} rel={rel ?? "noopener noreferrer"}>
          {children}
        </a>
      );
    }

    return (
      <Link className={classes} href={href} target={target} rel={rel}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
