import type { NextConfig } from "next";

const config: NextConfig = {
  // Arena computers run the existing single-thread WASM build in a bounded Node subprocess.
  outputFileTracingIncludes: {
    "/api/**": ["./public/vendor/stockfish/stockfish-18-lite-single.js", "./public/vendor/stockfish/stockfish-18-lite-single.wasm"]
  }
};

export default config;
