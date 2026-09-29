import React from "react";
import { createRoot } from "react-dom/client";
import { OnlinePlayProvider } from "../../components/onlinePlay/OnlinePlayProvider";
import { OnlinePlayPanel } from "../../components/onlinePlay/OnlinePlayPanel";
import { CorrespondenceProvider } from "../../components/correspondence/CorrespondenceProvider";

const studentId = new URLSearchParams(location.search).get("student") === "b" ? "b" : "a";
const originalFetch = window.fetch.bind(window);
const requestCounts = { reads: 0, heartbeats: 0, actions: 0 };
window.fetch = (url, options = {}) => {
  if (url === "/api/student/online-play") {
    if (options.method !== "POST") requestCounts.reads++;
    else if (JSON.parse(options.body || "{}").action === "heartbeat") requestCounts.heartbeats++;
    else requestCounts.actions++;
    const output = document.querySelector("#request-counts");
    if (output) output.textContent = `Online requests — reads: ${requestCounts.reads}, heartbeats: ${requestCounts.heartbeats}, actions: ${requestCounts.actions}`;
  }
  return originalFetch(url, { ...options, headers: { ...options.headers, "x-fixture-student": studentId } });
};
createRoot(document.getElementById("root")).render(
  <OnlinePlayProvider studentId={studentId}><CorrespondenceProvider studentId={studentId}>
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-black text-white">{studentId === "a" ? "Alex" : "Blair"} — local test</h1>
      <p id="navigation" className="break-words text-cyan-200" />
      <p id="request-counts" className="text-sm text-slate-300" />
      <OnlinePlayPanel />
    </main>
  </CorrespondenceProvider></OnlinePlayProvider>
);
