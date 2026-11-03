import { useId } from "react";
export function FreeClassCouponArt() {
  const goldId = useId();
  return (
    <svg
      viewBox="0 0 200 180"
      role="img"
      aria-label="FREE class coupon badge"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id={goldId} x2="1" y2="1">
          <stop stopColor="#fff4bd" />
          <stop offset=".5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#b7791f" />
        </linearGradient>
      </defs>
      <path
        d="M55 111 39 171 72 157 92 178 105 122M145 111 161 171 128 157 108 178 95 122"
        fill="#7c3aed"
        stroke="#c4b5fd"
        strokeWidth="3"
      />
      <path
        d="m100 8 17 10 20 1 11 16 17 10 1 20 10 18-10 18-1 20-17 10-11 16-20 1-17 10-17-10-20-1-11-16-17-10-1-20-10-18 10-18 1-20 17-10 11-16 20-1Z"
        fill={`url(#${goldId})`}
      />
      <circle
        cx="100"
        cy="83"
        r="57"
        fill="#26143f"
        stroke="#fff1b4"
        strokeWidth="3"
      />
      <text
        x="100"
        y="60"
        textAnchor="middle"
        fill="#fde68a"
        fontSize="12"
        fontWeight="800"
        fontFamily="sans-serif"
      >
        CHESS QUEST
      </text>
      <text
        x="100"
        y="96"
        textAnchor="middle"
        fill="#fff8d5"
        fontSize="34"
        fontWeight="900"
        fontFamily="sans-serif"
      >
        FREE
      </text>
      <text
        x="100"
        y="118"
        textAnchor="middle"
        fill="#fde68a"
        fontSize="14"
        fontWeight="800"
        fontFamily="sans-serif"
      >
        ONE CLASS
      </text>
    </svg>
  );
}
