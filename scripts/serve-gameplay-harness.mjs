// Start a standalone, mocked browser fixture; never contacts production APIs.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const mocks = {
  "next/navigation": "export const useRouter = () => ({push(){},replace(){},refresh(){}}); export const useSearchParams=()=>new URLSearchParams(location.search);",
  "next/link": "import React from 'react'; export default function Link({children,...props}) { return React.createElement('a',props,children); }",
  "next/image": "import React from 'react'; export default function Image({fill,priority,unoptimized,...props}) { return React.createElement('img',props); }",
  "@/lib/supabase/client": "export const getSupabaseClient = () => null;",
  "@/components/correspondence/CorrespondenceProvider": "export const useOptionalCorrespondence = () => null;",
  "@/chess/hooks/useLiveGameSounds": "const noop=()=>{}; export const useLiveGameSounds=()=>({muted:true,toggleMuted:noop,receiveGameSnapshot:noop,playClockWarning:noop,captureEffect:null});"
};
if (process.env.GAMEPLAY_MOCK_ENGINE === "1") {
  mocks["@/chess/hooks/useStockfish"] = "import {Chess} from 'chess.js'; const noop=()=>{}; const requestMove=async(fen)=>{const m=new Chess(fen).moves({verbose:true})[0]; return m ? m.from+m.to+(m.promotion||'') : null}; export const useStockfish=()=>({requestMove,thinking:false,engineError:'',stop:noop,clearEngineError:noop});";
  mocks["@/chess/hooks/useAnalysisEngine"] = "const noop=()=>{}; const state={lines:[],loading:false,error:'',analyze:noop,stop:noop,clear:noop}; export const useAnalysisEngine=()=>state;";
}
const result = await build({
  entryPoints: [process.env.GAMEPLAY_FIXTURE || "tests/browser/gameplay-harness.jsx"], outfile: "bundle.js", bundle: true, write: false, format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "local-fixtures", setup(builder) {
    builder.onResolve({ filter: /^(next\/|@\/)/ }, ({ path }) => path in mocks ? { path, namespace: "fixture" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: mocks[path], loader: "js", resolveDir: process.cwd() }));
  } }],
  alias: { "@": process.cwd() }
});
const css = await postcss([tailwindcss({ content: ["./chess/**/*.tsx", "./components/**/*.tsx", "./tests/browser/**/*.jsx", "./work/gameplay-audit/*.jsx"] })]).process(readFileSync("app/globals.css", "utf8"), { from: "app/globals.css" });
const js = result.outputFiles.find((file) => file.path.endsWith(".js")).contents;
const boardCss = result.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "";
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"></head><body><main class="mx-auto max-w-7xl p-4"><div id="root"></div></main><script src="/bundle.js"></script></body></html>';
createServer((req, res) => {
  const engineAssets = new Map([
    ["/vendor/stockfish/stockfish-18-lite-single.js", "text/javascript"],
    ["/vendor/stockfish/stockfish-18-lite-single.wasm", "application/wasm"]
  ]);
  if (engineAssets.has(req.url)) {
    res.setHeader("Content-Type", engineAssets.get(req.url));
    res.end(readFileSync("public" + req.url));
    return;
  }
  const isJs = req.url === "/bundle.js";
  const isCss = req.url === "/bundle.css";
  res.setHeader("Content-Type", isJs ? "text/javascript" : isCss ? "text/css" : "text/html");
  res.end(isJs ? js : isCss ? css.css + "\n" + boardCss : html);
}).listen(Number(process.env.GAMEPLAY_PORT || 9417), "127.0.0.1", () => console.log("Gameplay fixture ready (mocked data only)"));
