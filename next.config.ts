import type { NextConfig } from "next";

const config: NextConfig = {
  async redirects() {
    // Keep old bookmarks on the public domain. In-flight OAuth callbacks and APIs
    // retain their original host so their host-only cookies remain readable.
    return ["thechessacademy.vercel.app", "thechessacademy-sizzle13.vercel.app", "www.chessquest.app"].flatMap((host) => [
      { source: "/:path((?!api/|_next/).*)", has: [{ type: "host" as const, value: host }], destination: "https://chessquest.app/:path", permanent: true },
      { source: "/api/auth/:provider(lichess|google)/start", has: [{ type: "host" as const, value: host }], destination: "https://chessquest.app/api/auth/:provider/start", permanent: false }
    ]);
  },
  // Authentication actions carry credentials; never print their arguments in development.
  logging: { serverFunctions: false },
  // Arena computers run the existing single-thread WASM build in a bounded Node subprocess.
  outputFileTracingIncludes: {
    "/api/**": ["./public/vendor/stockfish/stockfish-18-lite-single.js", "./public/vendor/stockfish/stockfish-18-lite-single.wasm"]
  }
};

export default config;
