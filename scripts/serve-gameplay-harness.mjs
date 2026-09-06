// Start a standalone, mocked browser fixture; never contacts production APIs.
import { build } from "esbuild";
import { createServer } from "node:http";

const mocks = {
  "next/navigation": "export const useRouter = () => ({push(){},replace(){}});",
  "next/link": "import React from 'react'; export default function Link({children,...props}) { return React.createElement('a',props,children); }",
  "next/image": "import React from 'react'; export default function Image({fill,priority,unoptimized,...props}) { return React.createElement('img',props); }",
  "@/lib/supabase/client": "export const getSupabaseClient = () => null;",
  "@/components/correspondence/CorrespondenceProvider": "export const useOptionalCorrespondence = () => null;",
  "@/chess/hooks/useLiveGameSounds": "const noop=()=>{}; export const useLiveGameSounds=()=>({muted:true,toggleMuted:noop,receiveGameSnapshot:noop,playClockWarning:noop,captureEffect:null});"
};
const result = await build({
  entryPoints: ["tests/browser/gameplay-harness.jsx"], bundle: true, write: false, format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "local-fixtures", setup(builder) {
    builder.onResolve({ filter: /^(next\/|@\/)/ }, ({ path }) => path in mocks ? { path, namespace: "fixture" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: mocks[path], loader: "js", resolveDir: process.cwd() }));
  } }],
  alias: { "@": process.cwd() },
  loader: { ".css": "empty" }
});
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px;background:#101827;color:white;font-family:Arial}.relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}.pointer-events-none{pointer-events:none}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.grid{display:grid}.grid-rows-8{grid-template-rows:repeat(8,1fr)}.grid-cols-8{grid-template-columns:repeat(8,1fr)}.h-full{height:100%}.w-full{width:100%}button{cursor:pointer}output{display:block}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
createServer((req, res) => { res.setHeader("Content-Type", req.url === "/bundle.js" ? "text/javascript" : "text/html"); res.end(req.url === "/bundle.js" ? result.outputFiles[0].contents : html); }).listen(9417, "127.0.0.1", () => console.log("Gameplay fixture: http://127.0.0.1:9417 (mocked data only)"));
