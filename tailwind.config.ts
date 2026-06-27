import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0b1020",
        ink: "#10172a",
        rune: "#8b5cf6",
        mana: "#38bdf8",
        ember: "#f59e0b",
        jade: "#34d399"
      },
      boxShadow: {
        glow: "0 0 28px rgba(56, 189, 248, 0.24)",
        gold: "0 0 28px rgba(245, 158, 11, 0.24)"
      }
    }
  },
  plugins: []
};

export default config;
