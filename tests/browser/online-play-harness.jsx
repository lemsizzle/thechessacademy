import React from "react";
import { createRoot } from "react-dom/client";
import { OnlinePlayProvider } from "../../components/onlinePlay/OnlinePlayProvider";
import { OnlinePlayPanel } from "../../components/onlinePlay/OnlinePlayPanel";
import { CorrespondenceProvider } from "../../components/correspondence/CorrespondenceProvider";

const studentId = new URLSearchParams(location.search).get("student") === "b" ? "b" : "a";
const originalFetch = window.fetch.bind(window);
window.fetch = (url, options = {}) => originalFetch(url, { ...options, headers: { ...options.headers, "x-fixture-student": studentId } });
createRoot(document.getElementById("root")).render(
  <OnlinePlayProvider studentId={studentId}><CorrespondenceProvider studentId={studentId}>
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-black text-white">{studentId === "a" ? "Alex" : "Blair"} — local test</h1>
      <p id="navigation" className="break-words text-cyan-200" />
      <OnlinePlayPanel />
    </main>
  </CorrespondenceProvider></OnlinePlayProvider>
);
