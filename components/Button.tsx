import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
} & Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel">;

const variants = {
  primary: "border-amber-300/60 bg-amber-300 text-slate-950 shadow-gold hover:bg-amber-200 active:shadow-[0_0_10px_rgba(251,191,36,0.25)]",
  secondary: "border-sky-300/50 bg-sky-300/10 text-sky-50 shadow-glow hover:bg-sky-300/20 active:shadow-[0_0_10px_rgba(56,189,248,0.22)]",
  ghost: "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 active:bg-white/15 active:shadow-none"
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export function Button({ href, children, variant = "primary", className = "", target, rel, ...props }: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-bold transition duration-150 ease-out active:translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 disabled:active:scale-100 ${variants[variant]} ${className}`;

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
