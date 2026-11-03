import { useId } from "react";
import styles from "./StoreRewards.module.css";

// Unique paint IDs keep store, modal and Trophy Case instances independent.
function RewardPaint({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor="#fff9d5" />
        <stop offset=".2" stopColor="#ffe49c" />
        <stop offset=".48" stopColor="#b87828" />
        <stop offset=".7" stopColor="#ffe7a1" />
        <stop offset="1" stopColor="#8b501e" />
      </linearGradient>
      <linearGradient id={`${id}-edge`} x2="0" y2="1">
        <stop stopColor="#fff5bc" />
        <stop offset="1" stopColor="#c48332" />
      </linearGradient>
      <linearGradient id={`${id}-velvet`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#6248a0" />
        <stop offset=".45" stopColor="#302954" />
        <stop offset="1" stopColor="#111b32" />
      </linearGradient>
      <linearGradient id={`${id}-lid`} x2=".2" y2="1">
        <stop stopColor="#9e81d4" />
        <stop offset=".45" stopColor="#4d3c7b" />
        <stop offset="1" stopColor="#20203e" />
      </linearGradient>
      <linearGradient id={`${id}-crystal`} x2=".7" y2="1">
        <stop stopColor="#efffff" />
        <stop offset=".3" stopColor="#88f3ed" />
        <stop offset=".6" stopColor="#35b4d6" />
        <stop offset="1" stopColor="#286aab" />
      </linearGradient>
      <radialGradient id={`${id}-halo`}>
        <stop stopColor="#9971f3" stopOpacity=".5" />
        <stop offset=".5" stopColor="#584baf" stopOpacity=".2" />
        <stop offset="1" stopColor="#584baf" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-seal`} cx=".45" cy=".25" r=".85">
        <stop stopColor="#695099" />
        <stop offset=".65" stopColor="#24253f" />
        <stop offset="1" stopColor="#101b30" />
      </radialGradient>
      <filter id={`${id}-shadow`} x="-40%" y="-30%" width="180%" height="180%">
        <feDropShadow
          dx="0"
          dy="5"
          stdDeviation="4"
          floodColor="#020617"
          floodOpacity=".65"
        />
      </filter>
      <filter id={`${id}-light`} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
  );
}
function Glint({
  x,
  y,
  size = 7,
  color = "#fff4c9",
}: {
  x: number;
  y: number;
  size?: number;
  color?: string;
}) {
  return (
    <path
      d={`M${x} ${y - size} ${x + size * 0.28} ${y - size * 0.28} ${x + size} ${y} ${x + size * 0.28} ${y + size * 0.28} ${x} ${y + size} ${x - size * 0.28} ${y + size * 0.28} ${x - size} ${y} ${x - size * 0.28} ${y - size * 0.28}Z`}
      fill={color}
    />
  );
}
export function MysteryChestArt() {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;
  return (
    <svg viewBox="0 0 300 240" className={styles.chest} aria-hidden="true">
      <RewardPaint id={id} />
      <ellipse cx="152" cy="130" rx="143" ry="111" fill={paint("halo")} />
      <ellipse
        cx="152"
        cy="213"
        rx="104"
        ry="12"
        fill="#020617"
        opacity=".48"
      />
      <ellipse
        cx="152"
        cy="204"
        rx="128"
        ry="22"
        fill="none"
        stroke="#8ecbdf"
        strokeOpacity=".25"
      />
      <path
        d="m30 203 8-4m24 19 6-5m81 15v-5m80-6-5-5m44-11-8-2"
        fill="none"
        stroke="#b5f4f5"
        strokeWidth="2"
        opacity=".45"
      />
      <g filter={paint("shadow")}>
        <path
          d="m49 104 168-16 40 29-8 72-166 22-34-29Z"
          fill="#101526"
          stroke="#9b6a30"
          strokeWidth="3"
        />
        <path
          d="m52 106 165-16 37 27-163 22Z"
          fill="#080e20"
          stroke="#f5d68a"
          strokeWidth="2"
        />
        <path
          className={styles.chestCore}
          d="m66 107 147-12 31 20-154 18Z"
          fill="#a8f8ff"
        />
        <path
          d="m51 112 166-17v92L84 210l-33-26Z"
          fill={paint("velvet")}
          stroke={paint("gold")}
          strokeWidth="5"
        />
        <path
          d="m217 95 39 23-7 71-32-2Z"
          fill="#1b2038"
          stroke={paint("gold")}
          strokeWidth="5"
        />
        <path
          d="m62 125 141-15v64L85 195l-23-19Z"
          fill="#24213c"
          stroke="#9480b3"
          strokeOpacity=".45"
        />
        <path
          d="m72 138 119-13v37L87 179l-15-10Z"
          fill={paint("velvet")}
          stroke="#ddbe7b"
          strokeOpacity=".5"
        />
        <path
          d="m77 113 13-2v91l-13-2Zm101-11 13-1v90l-13 2Z"
          fill={paint("gold")}
        />
        <path
          d="m81 116 4-.5v81m97-89 4-.5v80"
          fill="none"
          stroke="#fff3bf"
          strokeOpacity=".65"
        />
        <path d="m226 120 22 13-3 40-19-2Z" fill="#343352" stroke="#c99b56" />
        <path d="m235 132 7 4-1 25-6-1Z" fill="#0c1527" stroke="#76639c" />
        <path
          d="m52 169 13 10v14l-14-10Zm145 14 20-3v12l-20 4Zm42-6 11 2-1 10-10 2Z"
          fill={paint("gold")}
        />
        <path
          d="m65 198 16 9-2 10-16-10Zm132-5 16-3-1 10-15 3Zm41-2 10-2-2 9-9 2Z"
          fill="#b18247"
        />
        {[82, 183].map((x) => (
          <g key={x} fill="#fff3b7" stroke="#8d5c2b">
            <circle cx={x} cy={x === 82 ? 126 : 116} r="2.5" />
            <circle cx={x} cy={x === 82 ? 185 : 172} r="2.5" />
          </g>
        ))}
        <path
          d="m99 159 9-10 8 4m-11 10 8-9m39-9 9 5 9-10m-9 0 3 10m-66 27 14-3m42-6 14-3"
          fill="none"
          stroke="#c7b083"
          strokeWidth="1.6"
          opacity=".65"
        />
        <g className={styles.chestLid}>
          <path
            d="M48 109V89q0-28 27-37l124-14q26 0 33 25l23 37v18l-39-23-166 19Z"
            fill={paint("lid")}
            stroke={paint("gold")}
            strokeWidth="5"
          />
          <path
            d="M61 99V86q0-19 18-24l119-13q17 2 22 18l11 23-18-8Z"
            fill="#362b59"
            stroke="#baa0df"
            strokeOpacity=".65"
            strokeWidth="1.5"
          />
          <path
            d="M81 57q-15 11-13 32v20l14-1V86q-1-20 13-31m86-11q-14 14-11 33v23l14-2V77q-2-21 10-34"
            fill={paint("gold")}
          />
          <path
            d="m50 104 166-18 38 25v9l-39-25-165 20Z"
            fill={paint("edge")}
          />
          <path
            d="m93 70 35-4 21 13 10-1m-55 7 18-3 7-12 9-1m49-17 11 11 3 10"
            fill="none"
            stroke="#b39ac9"
            strokeWidth="1.5"
            opacity=".8"
          />
          <path d="m127 53 8-12 8 10-7 14Z" fill={paint("gold")} />
          <path d="m130 53 5-8 5 7-4 9Z" fill={paint("crystal")} />
          <path
            d="m218 53 18 22-10-4"
            fill="none"
            stroke="#ffe7a5"
            strokeWidth="2"
          />
        </g>
        <g className={styles.chestLatch}>
          <path
            d="m129 92 20-3 9 21-7 31-23 3-10-29Z"
            fill="#b4f6ff"
            opacity=".55"
            filter={paint("light")}
          />
          <path
            d="m130 93 18-2 11 22-9 29-22 3-10-28Z"
            fill={paint("gold")}
            stroke="#fff1be"
            strokeWidth="1.5"
          />
          <path
            d="m132 100 12-2 9 17-8 21-13 2-8-22Z"
            fill={paint("crystal")}
          />
          <path d="m132 100 6 16-6 22-8-22Z" fill="#d5ffff" opacity=".6" />
          <path d="m138 116 15-1-8 21-13 2Z" fill="#2486bc" opacity=".65" />
          <circle cx="139" cy="112" r="4" fill="#152b4c" />
          <path d="m137 114-2 10 7-1-2-9Z" fill="#152b4c" />
        </g>
      </g>
      <g className={styles.idleGlints}>
        <Glint x={40} y={72} size={8} />
        <Glint x={256} y={59} size={6} color="#9cf4ef" />
        <Glint x={273} y={153} size={8} />
        <Glint x={107} y={33} size={4} color="#bcabff" />
      </g>
    </svg>
  );
}
export function FreeClassCouponArt() {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;
  return (
    <svg
      viewBox="0 0 240 240"
      role="img"
      aria-label="FREE class coupon badge"
      className="h-full w-full"
    >
      <RewardPaint id={id} />
      <circle cx="120" cy="112" r="110" fill={paint("halo")} />
      <circle
        cx="120"
        cy="112"
        r="93"
        fill="none"
        stroke="#9ba7d9"
        strokeOpacity=".3"
        strokeWidth=".7"
      />
      <circle
        cx="120"
        cy="112"
        r="103"
        fill="none"
        stroke="#95d7df"
        strokeOpacity=".35"
        strokeDasharray="2 13"
      />
      <g filter={paint("shadow")}>
        <path
          d="M75 84 14 56l12 38 16 5-11-24 21 30-22-10 16 28 16 4-11-15 19 12-26-2 21 25 19-4M165 84l61-28-12 38-16 5 11-24-21 30 22-10-16 28-16 4 11-15-19 12 26-2-21 25-19-4"
          fill={paint("gold")}
          stroke="#fee9b0"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="m24 67 40 23M39 84l28 17m-18 8 18 8m149-50-40 23m25-6-28 17m18 8-18 8"
          fill="none"
          stroke="#725232"
          strokeWidth="2"
        />
        <path
          d="m77 156-14 66 29-13 20 23 13-61m38-15 14 66-29-13-20 23-13-61"
          fill={paint("velvet")}
          stroke={paint("gold")}
          strokeWidth="2.5"
        />
        <path
          d="m83 176-8 31 16-6 13 17 7-35m46-7 8 31-16-6-13 17-7-35"
          fill="none"
          stroke="#b7a1eb"
          strokeWidth="1.2"
        />
        <path
          d="M120 31 183 60v64q-1 44-63 78-62-34-63-78V60Z"
          fill={paint("gold")}
          stroke="#fff0bf"
          strokeWidth="2"
        />
        <path
          d="m120 41 53 25v58q0 37-53 67-53-30-53-67V66Z"
          fill={paint("seal")}
          stroke="#70502e"
          strokeWidth="2"
        />
        <path
          d="m120 48 46 22v54q0 31-46 59-46-28-46-59V70Z"
          fill="none"
          stroke="#caa968"
          strokeWidth=".9"
        />
        <path
          d="M83 76q-6 29 0 48m74-48q6 29 0 48"
          fill="none"
          stroke="#c2a6f2"
          strokeOpacity=".4"
        />
        <path
          d="m96 49-7-24 20 10 11-21 11 21 20-10-7 24Z"
          fill={paint("gold")}
          stroke="#fff2bf"
          strokeWidth="1.4"
        />
        <path d="m98 42 44 0-2 7-40 0Z" fill="#7c5531" />
        <path
          d="m120 25 6 10-6 10-6-10Z"
          fill={paint("crystal")}
          stroke="#deffff"
        />
        <circle cx="89" cy="24" r="3" fill="#ffe9a1" />
        <circle cx="151" cy="24" r="3" fill="#ffe9a1" />
        <circle cx="120" cy="84" r="23" fill="#151e34" stroke="#9b7944" />
        <path
          d="m108 98 2-11-8-2 9-15 5 2 2-8 12 10 4 13-5 11Zm-2 1h27v5h-27Z"
          fill={paint("edge")}
        />
        <circle cx="114" cy="78" r="1.6" fill="#1a2840" />
        <path
          d="m125 75 4 11-6 10"
          fill="none"
          stroke="#8a632f"
          strokeWidth="1.3"
        />
        <path
          d="m46 111-17 12 14 12-8 19 29-6m130-37 17 12-14 12 8 19-29-6"
          fill="#a67232"
          stroke="#efd092"
          strokeWidth="1.5"
        />
        <path
          d="m50 108q70 9 140 0v44q-70 9-140 0Z"
          fill={paint("gold")}
          stroke="#fff1b7"
          strokeWidth="1.5"
        />
        <path
          d="m55 114q65 8 130 0m-130 32q65 8 130 0"
          fill="none"
          stroke="#fff5c8"
          opacity=".75"
        />
        <text
          x="120"
          y="143"
          textAnchor="middle"
          fill="#20223b"
          fontSize="38"
          fontWeight="900"
          fontFamily="Arial, sans-serif"
          letterSpacing="1"
        >
          FREE
        </text>
        <text
          x="120"
          y="173"
          textAnchor="middle"
          fill="#fff2c1"
          fontSize="12"
          fontWeight="800"
          fontFamily="Arial, sans-serif"
          letterSpacing="1.5"
        >
          ONE CLASS
        </text>
        <path d="m120 178 3 4-3 4-3-4Z" fill={paint("crystal")} />
      </g>
      <Glint x={40} y={43} size={6} />
      <Glint x={202} y={44} size={7} color="#b1f7fa" />
      <Glint x={24} y={172} size={5} color="#c7b6ff" />
      <Glint x={206} y={177} size={5} />
    </svg>
  );
}
