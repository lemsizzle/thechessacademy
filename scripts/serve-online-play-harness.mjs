// Two-session browser fixture. No production credentials, students, or writes.
// Open :9418/?student=a and :9418/?student=b; database rules are tested separately.
import { build } from "esbuild";
import { createServer } from "node:http";
import postcss from "postcss";
import tailwind from "tailwindcss";

const mocks = {
  "next/navigation": "const router={push(url){document.querySelector('#navigation').textContent=url;}}; export const useRouter=()=>router; export const usePathname=()=>'/student';",
  "next/link": "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}",
  "@/lib/supabase/client": "export const getSupabaseClient=()=>null;"
};
const bundle = await build({ entryPoints: ["tests/browser/online-play-harness.jsx"], bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, alias: { "@": process.cwd() }, plugins: [{ name: "mocks", setup(b) {
  b.onResolve({ filter: /^(next\/|@\/)/ }, ({ path }) => path in mocks ? { path, namespace: "fixture" } : undefined);
  b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: mocks[path], resolveDir: process.cwd(), loader: "js" }));
} }] });
const css = await postcss([tailwind({ content: ["./components/onlinePlay/*.tsx", "./components/correspondence/CorrespondenceProvider.tsx", "./components/Button.tsx", "./tests/browser/online-play-harness.jsx"], theme: { extend: {} }, plugins: [] })]).process("@tailwind base;@tailwind components;@tailwind utilities;", { from: undefined });
const people = [{ id: "a", name: "Alex", busy: false }, { id: "b", name: "Blair", busy: false }];
const challenges = [];
function state(id) {
  const mapped = challenges.map((c) => ({ ...c, opponentName: people.find((p) => p.id === (c.challengerId === id ? c.recipientId : c.challengerId)).name }));
  return { students: people.filter((p) => p.id !== id), busy: people.find((p) => p.id === id).busy, incoming: mapped.filter((c) => c.recipientId === id), outgoing: mapped.filter((c) => c.challengerId === id) };
}
createServer(async (req, res) => {
  const id = req.headers["x-fixture-student"] === "b" ? "b" : "a";
  const json = (data, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.url === "/api/student/online-play") {
    if (req.method === "GET") return json({ state: state(id) });
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    if (body.action === "heartbeat") return json({ result: null });
    if (body.action === "challenge") {
      const c = { id: crypto.randomUUID(), challengerId: id, recipientId: body.recipientId, timeControlId: body.timeControlId, status: "pending", gameId: null, expiresAt: new Date(Date.now() + 120000).toISOString() };
      challenges.push(c); return json({ result: c.id });
    }
    const c = challenges.find((item) => item.id === body.challengeId);
    if (!c) return json({ error: "Challenge not found" }, 404);
    c.status = body.action === "accept" ? "accepted" : body.action === "decline" ? "declined" : "cancelled";
    if (body.action === "accept") { c.gameId = "fixture-game"; people.forEach((p) => p.busy = true); }
    return json({ result: { status: c.status, gameId: c.gameId } });
  }
  if (req.url.startsWith("/api/student/correspondence")) return json({ inbox: { incoming: [], outgoing: [], activeGames: [], unreadCount: 0, realtimeTopic: null } });
  if (req.url === "/bundle.js") { res.setHeader("content-type", "text/javascript"); return res.end(bundle.outputFiles[0].contents); }
  res.setHeader("content-type", "text/html");
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style></head><body style="background:#0f172a"><div id="root"></div><script src="/bundle.js"></script></body></html>`);
}).listen(9418, "127.0.0.1", () => console.log("Online-play fixture: http://127.0.0.1:9418/?student=a and ?student=b"));
