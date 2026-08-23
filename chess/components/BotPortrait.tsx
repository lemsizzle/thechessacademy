import Image from "next/image";

type BotPortraitProps = {
  src: string;
  size?: "card" | "panel";
  selected?: boolean;
};

const sizeClasses = {
  card: "h-24 w-full sm:h-28",
  panel: "h-11 w-11 sm:h-12 sm:w-12"
};

export function BotPortrait({ src, size = "panel", selected = false }: BotPortraitProps) {
  return (
    <span
      aria-hidden="true"
      className={`${sizeClasses[size]} relative block shrink-0 overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.14),rgba(15,23,42,0.88)_72%)] ${selected ? "border-amber-200/70 shadow-[0_0_22px_rgba(251,191,36,0.22)]" : "border-cyan-100/15"}`}
    >
      <Image
        src={src}
        alt=""
        width={180}
        height={180}
        sizes={size === "card" ? "(max-width: 640px) 42vw, (max-width: 1536px) 28vw, 160px" : "48px"}
        className="h-full w-full object-contain p-0.5 drop-shadow-[0_8px_12px_rgba(0,0,0,0.4)]"
      />
    </span>
  );
}
