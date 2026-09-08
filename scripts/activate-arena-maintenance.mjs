// Run only after both migrations and the application deployment are verified.
// Never prints the token or writes it to disk.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());

if (!process.argv.includes("--activate")) {
  console.log("No changes made. After deployment: node scripts/activate-arena-maintenance.mjs --activate");
  process.exit(0);
}
const token = process.env.CRON_SECRET;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!token || token.length < 20 || !url || !key) throw new Error("Verified deployment credentials and a strong CRON_SECRET are required.");
if (new URL(url).hostname !== "yjtawpnflanerbodbieo.supabase.co") throw new Error("Maintenance activation must target the existing Academy production project.");
const response = await fetch("https://thechessacademy.vercel.app/api/cron/internal-arenas", {
  method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: "{}", signal: AbortSignal.timeout(60000)
});
if (!response.ok || (await response.json()).ok !== true) throw new Error("The deployed maintenance endpoint did not authenticate successfully. Scheduling remains unchanged.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const result = await client.rpc("configure_arena_maintenance", { p_secret: token });
if (result.error) throw new Error("Maintenance token configuration failed. Inspect server-side database permissions.");
console.log("Arena maintenance activated. Verify the next minute's job and HTTP response in Supabase.");
