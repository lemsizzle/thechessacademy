// First-time setup only. Secret exists only in process memory, Vercel and Vault.
// node scripts/provision-arena-maintenance.mjs <vercel-cli-entrypoint> --provision
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());
if (!process.argv.includes("--provision") || !process.argv[2]) throw new Error("Explicit first-time provisioning and a Vercel CLI entrypoint are required.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || new URL(url).hostname !== "yjtawpnflanerbodbieo.supabase.co" || !key) throw new Error("Academy production credentials are required.");
const token = randomBytes(32).toString("base64url");
const added = spawnSync(process.execPath, [process.argv[2], "env", "add", "ARENA_MAINTENANCE_SECRET", "production", "--sensitive", "--yes", "--project", "prj_U9niNGcK1eJdHfGCAhwfl8KkD3Pt", "--scope", "team_fPdvU9TNf37nFhkOVOErVDla"], { input: token + "\n", encoding: "utf8", timeout: 60000, windowsHide: true });
if (added.status !== 0) throw new Error("Secret provisioning failed; existing values were not overwritten. Check Vercel access or whether the Arena secret already exists.");
console.log("Dedicated secret added. Waiting for the new application deployment before activating maintenance.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch("https://thechessacademy.vercel.app/api/cron/internal-arenas", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(10000) });
    if (response.ok && (await response.json()).ok === true) {
      const result = await client.rpc("configure_arena_maintenance", { p_secret: token });
      if (result.error) throw new Error("Vault configuration failed.");
      console.log("Maintenance authenticated and activated. Verify the next scheduled HTTP response.");
      process.exit(0);
    }
  } catch { /* Deployment/network transitions are retried without logging credentials. */ }
  await new Promise(resolve => setTimeout(resolve, 5000));
}
throw new Error("Deployment verification timed out; maintenance was not activated. The new Vercel secret remains configured.");
