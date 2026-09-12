import type { NextConfig } from "next";

const config: NextConfig = {
  // Authentication actions carry credentials; never print their arguments in development.
  logging: { serverFunctions: false },
  // Arena computers run the existing single-thread WASM build in a bounded Node subprocess.
  outputFileTracingIncludes: {
    "/api/**": ["./public/vendor/stockfish/stockfish-18-lite-single.js", "./public/vendor/stockfish/stockfish-18-lite-single.wasm"]
  }
};

export default config;
